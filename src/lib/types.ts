/**
 * Raw CSV row shape as parsed by Papa Parse (snake_case column headers).
 * This mirrors the partner's CSV format exactly before any transformation.
 */
export interface ShowtimeRow {
  theater_name: string;
  movie_title: string;
  auditorium: string;
  start_time: string;
  end_time: string;
  language: string;
  format: string;
  rating: string;
  last_updated: string;
}

/**
 * Cleaned showtime data in camelCase format, used throughout the app after
 * CSV rows are parsed and trimmed. All values are strings (dates as ISO strings).
 */
export interface ShowtimeData {
  theaterName: string;
  movieTitle: string;
  auditorium: string;
  startTime: string;
  endTime: string;
  language: string;
  format: string;
  rating: string;
  lastUpdated: string;
}

/** Represents a single field-level change between an existing and incoming showtime. */
export interface FieldDiff {
  field: keyof ShowtimeData;
  oldValue: string;
  newValue: string;
}

/** A showtime in the CSV that doesn't exist in the current schedule — will be created. */
export interface AddAction {
  type: "add";
  data: ShowtimeData;
}

/** A showtime that exists but has field-level differences — will be updated. */
export interface UpdateAction {
  type: "update";
  existingId: number;
  data: ShowtimeData;
  diffs: FieldDiff[];
}

/** A showtime in the current schedule not present in the CSV — will be soft-deleted. */
export interface ArchiveAction {
  type: "archive";
  existingId: number;
  data: ShowtimeData;
}

export type ReconciliationAction = AddAction | UpdateAction | ArchiveAction;

/**
 * The full reconciliation result returned by the upload endpoint.
 * This is the preview payload — no database mutations happen until the user
 * explicitly confirms and the apply endpoint is called with this data.
 */
export interface ReconciliationResult {
  adds: AddAction[];
  updates: UpdateAction[];
  archives: ArchiveAction[];
}

/** Standard error response shape returned by all API endpoints on failure. */
export interface ApiErrorResponse {
  error: string;
}

/** Response from the seed endpoint on success. */
export interface SeedResponse {
  success: boolean;
  count: number;
}

/** Response from mutation endpoints (apply, clear) on success. */
export interface MutationResponse {
  success: boolean;
}
