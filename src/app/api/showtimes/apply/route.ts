import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ReconciliationResult } from "@/lib/types";

/**
 * Validates that the request body has the expected ReconciliationResult shape.
 * Returns a specific error message if validation fails, or null if valid.
 */
function validatePayload(body: unknown): string | null {
  if (!body || typeof body !== "object") {
    return "Request body must be a JSON object with adds, updates, and archives arrays.";
  }

  const result = body as Record<string, unknown>;

  if (!Array.isArray(result.adds)) {
    return "Missing or invalid \"adds\" array in request body.";
  }
  if (!Array.isArray(result.updates)) {
    return "Missing or invalid \"updates\" array in request body.";
  }
  if (!Array.isArray(result.archives)) {
    return "Missing or invalid \"archives\" array in request body.";
  }

  // Validate that update/archive entries have existingId
  for (let i = 0; i < result.updates.length; i++) {
    const update = result.updates[i] as Record<string, unknown>;
    if (typeof update?.existingId !== "number") {
      return `Update entry at index ${i} is missing a valid "existingId" (number).`;
    }
    if (!update?.data || typeof update.data !== "object") {
      return `Update entry at index ${i} is missing "data" object.`;
    }
  }

  for (let i = 0; i < result.archives.length; i++) {
    const archive = result.archives[i] as Record<string, unknown>;
    if (typeof archive?.existingId !== "number") {
      return `Archive entry at index ${i} is missing a valid "existingId" (number).`;
    }
  }

  // Validate that add entries have data
  for (let i = 0; i < result.adds.length; i++) {
    const add = result.adds[i] as Record<string, unknown>;
    if (!add?.data || typeof add.data !== "object") {
      return `Add entry at index ${i} is missing "data" object.`;
    }
  }

  return null;
}

/**
 * POST /api/showtimes/apply
 *
 * Applies a reconciliation result (the preview from /upload) to the database.
 * This is the second step of the two-phase "preview then apply" flow.
 *
 * All mutations (creates, updates, archives) happen inside a single Prisma
 * transaction. If any operation fails, the entire batch is rolled back,
 * ensuring the database stays consistent.
 *
 * Validates:
 *   - Request body is valid JSON
 *   - Body has the expected ReconciliationResult shape (adds, updates, archives arrays)
 *   - Each update/archive has a valid existingId
 *   - Each add has a data object
 *
 * Handles common Prisma errors with specific messages:
 *   - P2025 (record not found): The showtime was deleted between preview and apply
 */
export async function POST(request: NextRequest) {
  // Parse the JSON body with a specific error for malformed JSON
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON in request body. Expected a ReconciliationResult object." },
      { status: 400 }
    );
  }

  // Validate the payload shape before attempting any database operations
  const validationError = validatePayload(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const result = body as ReconciliationResult;

  // Quick exit if there's nothing to apply
  if (result.adds.length === 0 && result.updates.length === 0 && result.archives.length === 0) {
    return NextResponse.json({ success: true });
  }

  try {
    // Execute all changes atomically — if any single operation fails,
    // none of the changes are committed to the database
    await prisma.$transaction(async (tx) => {
      // Create new showtimes that exist in the CSV but not in the current schedule
      for (const add of result.adds) {
        await tx.showtime.create({
          data: {
            theaterName: add.data.theaterName,
            movieTitle: add.data.movieTitle,
            auditorium: add.data.auditorium,
            startTime: new Date(add.data.startTime),
            endTime: new Date(add.data.endTime),
            language: add.data.language,
            format: add.data.format,
            rating: add.data.rating,
            lastUpdated: new Date(add.data.lastUpdated),
            status: "active",
          },
        });
      }

      // Update existing showtimes where field-level differences were detected
      for (const update of result.updates) {
        await tx.showtime.update({
          where: { id: update.existingId },
          data: {
            theaterName: update.data.theaterName,
            movieTitle: update.data.movieTitle,
            auditorium: update.data.auditorium,
            startTime: new Date(update.data.startTime),
            endTime: new Date(update.data.endTime),
            language: update.data.language,
            format: update.data.format,
            rating: update.data.rating,
            lastUpdated: new Date(update.data.lastUpdated),
          },
        });
      }

      // Soft-delete showtimes that are in the database but not in the CSV.
      // Setting status to "archived" hides them from the active schedule
      // while preserving the record for historical reference.
      for (const archive of result.archives) {
        await tx.showtime.update({
          where: { id: archive.existingId },
          data: { status: "archived" },
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Apply error:", error);

    // Handle specific Prisma errors with user-friendly messages
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json(
          {
            error: "One or more showtimes were modified or deleted since the preview was generated. " +
              "Please upload the CSV again to get a fresh preview.",
          },
          { status: 409 }
        );
      }
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to apply changes: ${message}` },
      { status: 500 }
    );
  }
}
