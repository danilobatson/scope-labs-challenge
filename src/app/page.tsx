"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ReconciliationResult } from "@/lib/types";
import PreviewModal from "./PreviewModal";

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

type SortField =
  | "movieTitle"
  | "auditorium"
  | "startTime"
  | "endTime"
  | "language"
  | "format"
  | "rating";

const POLL_INTERVAL_MS = 5000;
const FILTER_DEBOUNCE_MS = 300;
const MESSAGE_AUTO_DISMISS_MS = 5000;

export default function Home() {
  const [showtimes, setShowtimes] = useState<Showtime[]>([]);
  const [initialLoad, setInitialLoad] = useState(true);
  const [filter, setFilter] = useState("");
  const [debouncedFilter, setDebouncedFilter] = useState("");
  const [sortField, setSortField] = useState<SortField>("startTime");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [preview, setPreview] = useState<ReconciliationResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-dismiss messages
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

  // Debounce filter input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedFilter(filter), FILTER_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [filter]);

  const fetchShowtimes = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        sort: sortField,
        order: sortOrder,
        filter: debouncedFilter,
      });
      const res = await fetch(`/api/showtimes?${params}`);
      const data = await res.json();
      setShowtimes(data);
    } catch {
      // Only show error on user-initiated fetches, not polling
    } finally {
      setInitialLoad(false);
    }
  }, [sortField, sortOrder, debouncedFilter]);

  // Fetch on sort/filter change
  useEffect(() => {
    fetchShowtimes();
  }, [fetchShowtimes]);

  // Poll for external changes (paused while preview modal is open)
  useEffect(() => {
    if (preview) return;
    const interval = setInterval(fetchShowtimes, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchShowtimes, preview]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const sortIndicator = (field: SortField) => {
    if (sortField !== field) return "";
    return sortOrder === "asc" ? " ▲" : " ▼";
  };

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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPreview(data);
    } catch (err) {
      showMessage(
        err instanceof Error ? err.message : "Upload failed",
        "error"
      );
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
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

  const handleClear = async () => {
    if (!confirm("Are you sure you want to clear all showtimes?")) return;
    setClearing(true);
    setMessage(null);
    try {
      const res = await fetch("/api/showtimes/clear", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
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

  const handleSeed = async () => {
    setSeeding(true);
    setMessage(null);
    try {
      const res = await fetch("/api/showtimes/seed", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
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

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Theater Showtimes Admin
        </h1>

        {/* Action bar */}
        <div className="flex flex-wrap gap-3 mb-6 items-center">
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
          <div className="flex-1" />
          <input
            type="text"
            placeholder="Filter by movie title..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 text-sm w-64 text-gray-900 placeholder-gray-500"
          />
        </div>

        {/* Status message */}
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

        {/* Showtimes table */}
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

        {/* Preview modal */}
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
