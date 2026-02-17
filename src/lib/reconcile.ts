import { normalizeTitle } from "./normalize";
import {
  ShowtimeRow,
  ShowtimeData,
  AddAction,
  UpdateAction,
  ArchiveAction,
  ReconciliationResult,
  FieldDiff,
} from "./types";
import { Showtime } from "@prisma/client";

/**
 * Converts a raw CSV row (snake_case) into a cleaned ShowtimeData object (camelCase).
 * All fields are trimmed and null-coalesced to empty strings to guard against
 * missing columns in the CSV.
 */
function csvRowToShowtimeData(row: ShowtimeRow): ShowtimeData {
  return {
    theaterName: (row.theater_name || "").trim(),
    movieTitle: (row.movie_title || "").trim(),
    auditorium: (row.auditorium || "").trim(),
    startTime: (row.start_time || "").trim(),
    endTime: (row.end_time || "").trim(),
    language: (row.language || "").trim(),
    format: (row.format || "").trim(),
    rating: (row.rating || "").trim(),
    lastUpdated: (row.last_updated || "").trim(),
  };
}

/**
 * Creates a composite key for matching showtimes: normalizedTitle + ISO start time.
 * This is the core matching logic — two showtimes are considered "the same" if they
 * have the same normalized movie title playing at the same start time.
 */
function makeKey(normalizedTitle: string, startTime: string): string {
  return `${normalizedTitle}|${new Date(startTime).toISOString()}`;
}

/** Converts a Prisma Showtime record (with Date objects) into a ShowtimeData (all strings). */
function existingToShowtimeData(s: Showtime): ShowtimeData {
  return {
    theaterName: s.theaterName,
    movieTitle: s.movieTitle,
    auditorium: s.auditorium,
    startTime: s.startTime.toISOString(),
    endTime: s.endTime.toISOString(),
    language: s.language,
    format: s.format,
    rating: s.rating,
    lastUpdated: s.lastUpdated.toISOString(),
  };
}

/**
 * Compares two matched showtimes field-by-field and returns an array of diffs.
 * startTime is intentionally excluded since it's part of the composite key
 * (if it changed, the showtimes wouldn't have matched in the first place).
 * Date fields are normalized to ISO strings before comparison to handle
 * timezone format variations (e.g., "Z" vs "+00:00").
 */
function computeDiffs(
  existing: ShowtimeData,
  incoming: ShowtimeData
): FieldDiff[] {
  const diffs: FieldDiff[] = [];
  const fields: (keyof ShowtimeData)[] = [
    "theaterName",
    "movieTitle",
    "auditorium",
    "endTime",
    "language",
    "format",
    "rating",
    "lastUpdated",
  ];

  for (const field of fields) {
    let oldVal = existing[field];
    let newVal = incoming[field];

    // Normalize date strings to ISO format so "2025-03-15T20:13:00Z" and
    // "2025-03-15T20:13:00+00:00" compare as equal
    if (field === "endTime" || field === "lastUpdated") {
      oldVal = new Date(oldVal).toISOString();
      newVal = new Date(newVal).toISOString();
    }

    if (oldVal !== newVal) {
      diffs.push({ field, oldValue: oldVal, newValue: newVal });
    }
  }

  return diffs;
}

/**
 * Core reconciliation algorithm. Compares an incoming CSV against the current
 * active schedule and categorizes every showtime into one of three buckets:
 *
 *   - ADD:     In CSV but not in the database → new showtime to create
 *   - UPDATE:  In both CSV and database, but with field-level differences
 *   - ARCHIVE: In the database but not in the CSV → no longer showing, soft-delete
 *
 * The algorithm:
 *   1. Filter out CSV rows missing required fields (title, start time).
 *      Uses trim() before truthiness check so whitespace-only values are excluded.
 *   2. Deduplicate CSV rows by composite key (normalizedTitle + startTime).
 *      First occurrence wins — subsequent duplicates are silently dropped.
 *   3. Build a lookup map of existing active showtimes by the same composite key.
 *   4. Walk through deduped CSV rows:
 *      - If the key exists in the existing map → check for field diffs → UPDATE (if any)
 *      - If the key doesn't exist → ADD
 *   5. Any existing showtime whose key was never matched → ARCHIVE
 *
 * Returns a preview result (no DB mutations). The apply endpoint uses this
 * result to execute all changes in a single Prisma transaction.
 */
export function reconcile(
  csvRows: ShowtimeRow[],
  existingShowtimes: Showtime[]
): ReconciliationResult {
  // Step 1: Filter out rows missing required fields.
  // We trim before checking truthiness so whitespace-only strings like "   " are excluded.
  const cleanedRows = csvRows
    .filter(
      (row) =>
        (row.movie_title || "").trim() && (row.start_time || "").trim()
    )
    .map(csvRowToShowtimeData);

  // Step 2: Deduplicate CSV rows by composite key (normalizedTitle|startTime).
  // Uses a Map so first occurrence wins — subsequent duplicates are dropped.
  const deduped = new Map<string, ShowtimeData>();
  for (const row of cleanedRows) {
    const key = makeKey(normalizeTitle(row.movieTitle), row.startTime);
    if (!deduped.has(key)) {
      deduped.set(key, row);
    }
  }

  // Step 3: Build lookup map of existing active showtimes by the same composite key
  const existingMap = new Map<string, { id: number; data: ShowtimeData }>();
  for (const s of existingShowtimes) {
    const key = makeKey(
      normalizeTitle(s.movieTitle),
      s.startTime.toISOString()
    );
    existingMap.set(key, { id: s.id, data: existingToShowtimeData(s) });
  }

  // Step 4: Categorize each CSV row as an ADD or UPDATE
  const adds: AddAction[] = [];
  const updates: UpdateAction[] = [];
  const matchedExistingKeys = new Set<string>();

  for (const [key, csvData] of deduped) {
    const existing = existingMap.get(key);
    if (existing) {
      // This CSV row matched an existing showtime — check for field-level diffs
      matchedExistingKeys.add(key);
      const diffs = computeDiffs(existing.data, csvData);
      if (diffs.length > 0) {
        updates.push({
          type: "update",
          existingId: existing.id,
          data: csvData,
          diffs,
        });
      }
      // If no diffs, the showtime is unchanged — no action needed
    } else {
      // No match in existing schedule — this is a new showtime
      adds.push({ type: "add", data: csvData });
    }
  }

  // Step 5: Any existing showtime not matched by a CSV row gets archived.
  // These are showtimes that were in the schedule but are no longer in the partner's feed.
  const archives: ArchiveAction[] = [];
  for (const [key, existing] of existingMap) {
    if (!matchedExistingKeys.has(key)) {
      archives.push({
        type: "archive",
        existingId: existing.id,
        data: existing.data,
      });
    }
  }

  return { adds, updates, archives };
}
