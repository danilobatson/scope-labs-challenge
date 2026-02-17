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

export interface FieldDiff {
  field: string;
  oldValue: string;
  newValue: string;
}

export interface AddAction {
  type: "add";
  data: ShowtimeData;
}

export interface UpdateAction {
  type: "update";
  existingId: number;
  data: ShowtimeData;
  diffs: FieldDiff[];
}

export interface ArchiveAction {
  type: "archive";
  existingId: number;
  data: ShowtimeData;
}

export type ReconciliationAction = AddAction | UpdateAction | ArchiveAction;

export interface ReconciliationResult {
  adds: AddAction[];
  updates: UpdateAction[];
  archives: ArchiveAction[];
}
