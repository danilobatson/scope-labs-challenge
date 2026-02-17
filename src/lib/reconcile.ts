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

function makeKey(normalizedTitle: string, startTime: string): string {
  return `${normalizedTitle}|${new Date(startTime).toISOString()}`;
}

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

    // For date fields, compare ISO strings
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

export function reconcile(
  csvRows: ShowtimeRow[],
  existingShowtimes: Showtime[]
): ReconciliationResult {
  // Step 1: Parse & clean CSV rows
  const cleanedRows = csvRows
    .filter((row) => row.movie_title && row.start_time)
    .map(csvRowToShowtimeData);

  // Step 2: Deduplicate CSV rows by normalized title + start_time
  const deduped = new Map<string, ShowtimeData>();
  for (const row of cleanedRows) {
    const key = makeKey(normalizeTitle(row.movieTitle), row.startTime);
    if (!deduped.has(key)) {
      deduped.set(key, row);
    }
  }

  // Step 3: Build map of existing active showtimes
  const existingMap = new Map<string, { id: number; data: ShowtimeData }>();
  for (const s of existingShowtimes) {
    const key = makeKey(
      normalizeTitle(s.movieTitle),
      s.startTime.toISOString()
    );
    existingMap.set(key, { id: s.id, data: existingToShowtimeData(s) });
  }

  // Step 4: Categorize
  const adds: AddAction[] = [];
  const updates: UpdateAction[] = [];
  const matchedExistingKeys = new Set<string>();

  for (const [key, csvData] of deduped) {
    const existing = existingMap.get(key);
    if (existing) {
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
    } else {
      adds.push({ type: "add", data: csvData });
    }
  }

  // Archives: existing showtimes not matched by any CSV row
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
