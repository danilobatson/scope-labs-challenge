"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  ReconciliationResult,
  ApiErrorResponse,
  SeedResponse,
} from "@/lib/types";
import PreviewModal from "./PreviewModal";

/** Shape of a showtime record as returned by the GET /api/showtimes endpoint. */
interface Showtime {
  id: number;
  theaterName: string;
  movieTitle: string;
  auditorium: string;
  startTime: string;
  endTime: string;
  language: string;
  format: string;
  rating: string;
  lastUpdated: string;
  status: string;
}

/** Columns the table can be sorted by. Maps to Prisma model field names. */
type SortField =
  | "movieTitle"
  | "auditorium"
  | "startTime"
  | "endTime"
  | "language"
  | "format"
  | "rating";

// Polling interval for auto-refreshing the table (catches external changes like curl calls)
const POLL_INTERVAL_MS = 5000;
// Delay before filter input triggers a new API request (avoids hammering the server on every keystroke)
const FILTER_DEBOUNCE_MS = 300;
// How long success/error toast messages are shown before auto-dismissing
const MESSAGE_AUTO_DISMISS_MS = 5000;

/** Formats an ISO date string into a human-readable format like "Mar 15, 6:00 PM". */
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Main page component — renders the showtimes admin dashboard.
 *
 * Key behaviors:
 *   - Fetches and displays active showtimes in a sortable, filterable table
 *   - Polls every 5s for external changes (paused while preview modal is open)
 *   - Supports CSV upload → preview → apply two-phase reconciliation flow
 *   - Provides seed and clear actions for demo/testing
 */
export default function Home() {
  const [showtimes, setShowtimes] = useState<Showtime[]>([]);
  // `initialLoad` prevents showing "No showtimes" flash before the first fetch completes.
  // Unlike a generic `loading` flag, this only affects the first render — subsequent
  // fetches (from polling or sort/filter changes) don't trigger a loading state.
  const [initialLoad, setInitialLoad] = useState(true);
  const [filter, setFilter] = useState("");
  // Debounced version of filter — only updates after FILTER_DEBOUNCE_MS of inactivity,
  // preventing excessive API calls while the user is still typing
  const [debouncedFilter, setDebouncedFilter] = useState("");
  const [sortField, setSortField] = useState<SortField>("startTime");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  // Holds the reconciliation preview returned by /upload. When non-null, the PreviewModal is shown.
  const [preview, setPreview] = useState<ReconciliationResult | null>(null);
  // Per-action loading states — each button gets its own flag so the UI accurately reflects
  // which operation is in progress (prevents confusion when multiple actions are available)
  const [uploading, setUploading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [clearing, setClearing] = useState(false);
  // Toast message shown after actions complete (success or error)
  const [message, setMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);
  // Ref to track the auto-dismiss timer — using a ref instead of state because we
  // need to clear the previous timer without triggering a re-render
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Shows a toast message that auto-dismisses after MESSAGE_AUTO_DISMISS_MS.
   * Clears any existing timer first so rapid successive messages don't stack.
   */
  const showMessage = useCallback(
    (text: string, type: "success" | "error") => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
      setMessage({ text, type });
      dismissTimer.current = setTimeout(
        () => setMessage(null),
        MESSAGE_AUTO_DISMISS_MS
      );
    },
    []
  );

  // Debounce the filter input: wait FILTER_DEBOUNCE_MS after the user stops typing
  // before updating debouncedFilter, which triggers a new API request via fetchShowtimes
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedFilter(filter), FILTER_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [filter]);

  /**
   * Fetches showtimes from the API with current sort/filter params.
   * Wrapped in useCallback so it can be used as a dependency for both the
   * sort/filter effect and the polling interval without causing infinite loops.
   * Errors are silently swallowed during polling to avoid distracting the user.
   */
  const fetchShowtimes = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        sort: sortField,
        order: sortOrder,
        filter: debouncedFilter,
      });
      const res = await fetch(`/api/showtimes?${params}`);
      const data: Showtime[] = await res.json();
      setShowtimes(data);
    } catch {
      // Silently ignore errors during polling — network blips shouldn't
      // interrupt the user's workflow with error toasts every 5 seconds
    } finally {
      setInitialLoad(false);
    }
  }, [sortField, sortOrder, debouncedFilter]);

  // Re-fetch whenever sort or filter changes
  useEffect(() => {
    fetchShowtimes();
  }, [fetchShowtimes]);

  // Poll for external changes every POLL_INTERVAL_MS.
  // Polling is paused while the preview modal is open to prevent stale-state conflicts —
  // if the underlying data changed during preview, the reconciliation result could
  // be out of date, leading to confusing apply behavior.
  useEffect(() => {
    if (preview) return;
    const interval = setInterval(fetchShowtimes, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchShowtimes, preview]);

  /** Toggles sort direction if same column clicked, otherwise sorts by new column ascending. */
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  /** Returns a ▲/▼ indicator for the currently sorted column, empty string for others. */
  const sortIndicator = (field: SortField) => {
    if (sortField !== field) return "";
    return sortOrder === "asc" ? " ▲" : " ▼";
  };

  /**
   * Handles CSV file selection. Sends the file to /upload, which returns a
   * reconciliation preview (no DB changes). The preview is then shown in the modal.
   * Resets the file input after upload so the same file can be re-selected.
   */
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/showtimes/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err: ApiErrorResponse = await res.json();
        throw new Error(err.error);
      }
      const data: ReconciliationResult = await res.json();
      setPreview(data);
    } catch (err) {
      showMessage(
        err instanceof Error ? err.message : "Upload failed",
        "error"
      );
    } finally {
      setUploading(false);
      // Reset the file input so uploading the same file again triggers onChange
      e.target.value = "";
    }
  };

  /**
   * Sends the reconciliation preview to /apply, which executes all changes
   * (adds, updates, archives) in a single database transaction.
   */
  const handleApply = async () => {
    if (!preview) return;
    setApplying(true);
    setMessage(null);
    try {
      const res = await fetch("/api/showtimes/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preview),
      });
      if (!res.ok) {
        const err: ApiErrorResponse = await res.json();
        throw new Error(err.error);
      }
      setPreview(null);
      showMessage("Changes applied successfully", "success");
      fetchShowtimes();
    } catch (err) {
      showMessage(
        err instanceof Error ? err.message : "Apply failed",
        "error"
      );
    } finally {
      setApplying(false);
    }
  };

  /** Hard-deletes all showtimes after user confirmation. Used for full schedule resets. */
  const handleClear = async () => {
    if (!confirm("Are you sure you want to clear all showtimes?")) return;
    setClearing(true);
    setMessage(null);
    try {
      const res = await fetch("/api/showtimes/clear", { method: "POST" });
      if (!res.ok) {
        const err: ApiErrorResponse = await res.json();
        throw new Error(err.error);
      }
      showMessage("Schedule cleared", "success");
      fetchShowtimes();
    } catch (err) {
      showMessage(
        err instanceof Error ? err.message : "Clear failed",
        "error"
      );
    } finally {
      setClearing(false);
    }
  };

  /** Populates the database with sample showtimes for demo/testing. */
  const handleSeed = async () => {
    setSeeding(true);
    setMessage(null);
    try {
      const res = await fetch("/api/showtimes/seed", { method: "POST" });
      if (!res.ok) {
        const err: ApiErrorResponse = await res.json();
        throw new Error(err.error);
      }
      const data: SeedResponse = await res.json();
      showMessage(`Seeded ${data.count} showtimes`, "success");
      fetchShowtimes();
    } catch (err) {
      showMessage(
        err instanceof Error ? err.message : "Seed failed",
        "error"
      );
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Theater Showtimes Admin
        </h1>

        {/* Action bar — Upload CSV, Seed, Clear buttons on the left; filter input on the right */}
        <div className="flex flex-wrap gap-3 mb-6 items-center">
          {/* CSV upload uses a styled <label> wrapping a hidden file input for a button-like appearance */}
          <label
            className={`px-4 py-2 rounded text-sm font-medium text-white ${
              uploading
                ? "bg-blue-400 cursor-wait"
                : "bg-blue-600 cursor-pointer hover:bg-blue-700"
            }`}
          >
            {uploading ? "Uploading..." : "Upload CSV"}
            <input
              type="file"
              accept=".csv"
              onChange={handleUpload}
              className="hidden"
              disabled={uploading}
            />
          </label>
          <button
            onClick={handleSeed}
            disabled={seeding}
            className={`px-4 py-2 rounded text-sm font-medium text-white ${
              seeding
                ? "bg-green-400 cursor-wait"
                : "bg-green-600 hover:bg-green-700"
            }`}
          >
            {seeding ? "Seeding..." : "Seed Demo Data"}
          </button>
          <button
            onClick={handleClear}
            disabled={clearing}
            className={`px-4 py-2 rounded text-sm font-medium text-white ${
              clearing
                ? "bg-red-400 cursor-wait"
                : "bg-red-600 hover:bg-red-700"
            }`}
          >
            {clearing ? "Clearing..." : "Clear Schedule"}
          </button>
          {/* Spacer pushes the filter input to the right */}
          <div className="flex-1" />
          <input
            type="text"
            placeholder="Filter by movie title..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 text-sm w-64 text-gray-900 placeholder-gray-500"
          />
        </div>

        {/* Toast-style status message — auto-dismisses after 5 seconds or can be manually closed */}
        {message && (
          <div
            className={`mb-4 p-3 rounded text-sm flex justify-between items-center ${
              message.type === "success"
                ? "bg-green-100 text-green-800 border border-green-200"
                : "bg-red-100 text-red-800 border border-red-200"
            }`}
          >
            <span>{message.text}</span>
            <button
              onClick={() => setMessage(null)}
              className="ml-4 text-lg leading-none opacity-50 hover:opacity-100"
            >
              &times;
            </button>
          </div>
        )}

        {/* Showtimes table — sortable by clicking column headers */}
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                {(
                  [
                    ["movieTitle", "Movie Title"],
                    ["auditorium", "Auditorium"],
                    ["startTime", "Start Time"],
                    ["endTime", "End Time"],
                    ["language", "Lang"],
                    ["format", "Format"],
                    ["rating", "Rating"],
                  ] as [SortField, string][]
                ).map(([field, label]) => (
                  <th
                    key={field}
                    onClick={() => handleSort(field)}
                    className="px-4 py-3 text-left font-medium text-gray-600 cursor-pointer hover:text-gray-900 select-none"
                  >
                    {label}
                    {sortIndicator(field)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {initialLoad ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : showtimes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No showtimes found. Click &quot;Seed Demo Data&quot; to get started.
                  </td>
                </tr>
              ) : (
                showtimes.map((s) => (
                  <tr key={s.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {s.movieTitle}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{s.auditorium}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {formatDate(s.startTime)}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {formatDate(s.endTime)}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{s.language}</td>
                    <td className="px-4 py-3 text-gray-700">{s.format}</td>
                    <td className="px-4 py-3 text-gray-700">{s.rating}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 text-sm text-gray-500">
          {showtimes.length} showtime{showtimes.length !== 1 ? "s" : ""} total
        </div>

        {/* Preview modal — shown after CSV upload with reconciliation results.
            Polling is paused while this is open (see the useEffect above). */}
        {preview && (
          <PreviewModal
            preview={preview}
            onApply={handleApply}
            onCancel={() => setPreview(null)}
            applying={applying}
          />
        )}
      </div>
    </div>
  );
}
