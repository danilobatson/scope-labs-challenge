import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { prisma } from "@/lib/prisma";
import { reconcile } from "@/lib/reconcile";
import { ShowtimeRow } from "@/lib/types";

/** Columns required in the CSV for a valid upload. */
const REQUIRED_COLUMNS = ["movie_title", "start_time"] as const;

/** All expected CSV columns. Used to warn about missing optional fields. */
const EXPECTED_COLUMNS = [
  "theater_name",
  "movie_title",
  "auditorium",
  "start_time",
  "end_time",
  "language",
  "format",
  "rating",
  "last_updated",
];

/**
 * POST /api/showtimes/upload
 *
 * Accepts a CSV file upload, parses it, and returns a reconciliation preview
 * (adds/updates/archives) WITHOUT modifying the database. This is the first
 * step of the two-phase "preview then apply" flow.
 *
 * Validates:
 *   - Request contains a file in multipart form data
 *   - File has a .csv extension
 *   - CSV parses without fatal structural errors
 *   - CSV contains the required columns (movie_title, start_time)
 *   - CSV contains at least one valid data row
 *
 * Returns specific error messages for each validation failure so the user
 * can identify and fix the issue.
 */
export async function POST(request: NextRequest) {
  // Wrap formData() in its own try-catch because it throws if the request
  // isn't multipart/form-data (e.g., a plain JSON POST or missing Content-Type).
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid request format. Expected a multipart form data upload with a CSV file." },
      { status: 400 }
    );
  }

  try {
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file found in the upload. Make sure the form field is named \"file\"." },
        { status: 400 }
      );
    }

    // Validate file extension
    if (!file.name.toLowerCase().endsWith(".csv")) {
      return NextResponse.json(
        { error: `Expected a .csv file but received "${file.name}". Please upload a CSV file.` },
        { status: 400 }
      );
    }

    const text = await file.text();

    if (!text.trim()) {
      return NextResponse.json(
        { error: "The uploaded CSV file is empty." },
        { status: 400 }
      );
    }

    // Parse CSV with headers enabled so each row becomes a keyed object.
    // transformHeader trims whitespace from column names to handle sloppy CSVs.
    const parsed = Papa.parse<ShowtimeRow>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => header.trim(),
    });

    // Only reject on fatal parsing errors — Papa Parse reports non-fatal warnings
    // (e.g., trailing delimiters, extra columns) that shouldn't block valid uploads.
    const fatalErrors = parsed.errors.filter(
      (e) => e.type === "Delimiter" || e.type === "FieldMismatch"
    );
    if (fatalErrors.length > 0) {
      const details = fatalErrors.map(
        (e) => `Row ${e.row !== undefined ? e.row + 1 : "?"}: ${e.message}`
      );
      return NextResponse.json(
        {
          error: `CSV has structural errors: ${details.join("; ")}`,
          details: fatalErrors,
        },
        { status: 400 }
      );
    }

    // Validate that the CSV contains the required columns
    const headers = parsed.meta.fields || [];
    const missingRequired = REQUIRED_COLUMNS.filter((col) => !headers.includes(col));
    if (missingRequired.length > 0) {
      return NextResponse.json(
        {
          error: `CSV is missing required column(s): ${missingRequired.join(", ")}. ` +
            `Expected columns: ${EXPECTED_COLUMNS.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Warn about missing optional columns (included in response but doesn't block upload)
    const missingOptional = EXPECTED_COLUMNS.filter((col) => !headers.includes(col));

    if (parsed.data.length === 0) {
      return NextResponse.json(
        { error: "The CSV file contains headers but no data rows." },
        { status: 400 }
      );
    }

    // Fetch current active showtimes to reconcile against
    const existingShowtimes = await prisma.showtime.findMany({
      where: { status: "active" },
    });

    // Run the reconciliation algorithm — returns preview only, no DB mutations
    const result = reconcile(parsed.data, existingShowtimes);

    return NextResponse.json({
      ...result,
      // Include warnings about missing columns so the UI could display them
      ...(missingOptional.length > 0 && {
        warnings: [`CSV is missing optional column(s): ${missingOptional.join(", ")}. These fields will be empty.`],
      }),
    });
  } catch (error) {
    console.error("Upload error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to process CSV: ${message}` },
      { status: 500 }
    );
  }
}
