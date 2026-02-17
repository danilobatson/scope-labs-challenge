"use client";

import { ReconciliationResult, ShowtimeData, FieldDiff } from "@/lib/types";

interface Props {
  preview: ReconciliationResult;
  onApply: () => void;
  onCancel: () => void;
  applying?: boolean;
}

/**
 * Maps internal camelCase field names to human-readable labels for the diff display.
 * Used in DiffRow to show "End Time" instead of "endTime" when showing field changes.
 */
const FIELD_LABELS: Record<string, string> = {
  theaterName: "Theater",
  movieTitle: "Movie Title",
  auditorium: "Auditorium",
  startTime: "Start Time",
  endTime: "End Time",
  language: "Language",
  format: "Format",
  rating: "Rating",
  lastUpdated: "Last Updated",
};

/** Compact row showing a showtime's key info. Used in the ADD and ARCHIVE sections. */
function ShowtimeRow({ data }: { data: ShowtimeData }) {
  return (
    <div className="grid grid-cols-4 gap-2 text-sm py-2">
      <div className="font-medium text-gray-900">{data.movieTitle}</div>
      <div className="text-gray-700">{data.auditorium}</div>
      <div className="text-gray-700">
        {new Date(data.startTime).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}
      </div>
      <div className="text-gray-700">
        {data.format} · {data.language} · {data.rating}
      </div>
    </div>
  );
}

/**
 * Row showing field-level diffs for an UPDATE action.
 * Each changed field is displayed as: "Field Label: old value → new value"
 * with strikethrough on old values (red) and bold on new values (green).
 */
function DiffRow({ data, diffs }: { data: ShowtimeData; diffs: FieldDiff[] }) {
  return (
    <div className="py-2">
      <div className="font-medium text-gray-900 text-sm mb-1">
        {data.movieTitle}
      </div>
      <div className="space-y-1">
        {diffs.map((diff) => (
          <div key={diff.field} className="text-xs flex items-center gap-2">
            <span className="text-gray-500 w-24">
              {FIELD_LABELS[diff.field] || diff.field}:
            </span>
            <span className="line-through text-red-600">{diff.oldValue}</span>
            <span className="text-gray-400">→</span>
            <span className="text-green-700 font-medium">{diff.newValue}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Modal that displays the reconciliation preview after a CSV upload.
 * Shows three color-coded sections:
 *   - Green (ADD):    New showtimes that will be created
 *   - Amber (UPDATE): Existing showtimes with field-level changes
 *   - Red (ARCHIVE):  Existing showtimes that will be soft-deleted
 *
 * No database changes happen until the user clicks "Apply Changes".
 * If no changes are detected, shows a message and only offers "Cancel".
 */
export default function PreviewModal({ preview, onApply, onCancel, applying }: Props) {
  const { adds, updates, archives } = preview;
  const totalChanges = adds.length + updates.length + archives.length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col">
        {/* Modal header with total change count */}
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900">Preview Changes</h2>
          <p className="text-sm text-gray-500 mt-1">
            {totalChanges} change{totalChanges !== 1 ? "s" : ""} detected
          </p>
        </div>

        {/* Scrollable content area with color-coded change sections */}
        <div className="overflow-y-auto flex-1 p-6 space-y-6">
          {/* New showtimes to be added (green) */}
          {adds.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-green-800 bg-green-100 px-3 py-2 rounded-t border border-green-200">
                ADD ({adds.length})
              </h3>
              <div className="border border-t-0 border-green-200 rounded-b p-3 bg-green-50 divide-y divide-green-200">
                {adds.map((add, i) => (
                  <ShowtimeRow key={i} data={add.data} />
                ))}
              </div>
            </div>
          )}

          {/* Existing showtimes with field changes (amber) */}
          {updates.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-amber-800 bg-amber-100 px-3 py-2 rounded-t border border-amber-200">
                UPDATE ({updates.length})
              </h3>
              <div className="border border-t-0 border-amber-200 rounded-b p-3 bg-amber-50 divide-y divide-amber-200">
                {updates.map((update, i) => (
                  <DiffRow key={i} data={update.data} diffs={update.diffs} />
                ))}
              </div>
            </div>
          )}

          {/* Showtimes to be archived / soft-deleted (red) */}
          {archives.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-red-800 bg-red-100 px-3 py-2 rounded-t border border-red-200">
                ARCHIVE ({archives.length})
              </h3>
              <div className="border border-t-0 border-red-200 rounded-b p-3 bg-red-50 divide-y divide-red-200">
                {archives.map((archive, i) => (
                  <ShowtimeRow key={i} data={archive.data} />
                ))}
              </div>
            </div>
          )}

          {totalChanges === 0 && (
            <p className="text-center text-gray-500 py-8">
              No changes detected. The CSV matches the current schedule.
            </p>
          )}
        </div>

        {/* Modal footer with Cancel and Apply buttons */}
        <div className="p-6 border-t flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={applying}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
          >
            Cancel
          </button>
          {/* Only show Apply button when there are actual changes to apply */}
          {totalChanges > 0 && (
            <button
              onClick={onApply}
              disabled={applying}
              className={`px-4 py-2 text-sm font-medium text-white rounded ${
                applying
                  ? "bg-blue-400 cursor-wait"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {applying ? "Applying..." : "Apply Changes"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
