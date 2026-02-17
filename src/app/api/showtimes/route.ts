import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Allowlist of Showtime model fields that can be used for sorting.
 * Defined as `const` so TypeScript can narrow the type for Prisma's orderBy.
 */
const VALID_SORT_FIELDS = [
  "movieTitle",
  "theaterName",
  "auditorium",
  "startTime",
  "endTime",
  "language",
  "format",
  "rating",
  "lastUpdated",
] as const;
type ValidSortField = (typeof VALID_SORT_FIELDS)[number];

/**
 * GET /api/showtimes
 *
 * Returns all active showtimes with support for sorting and filtering.
 * Used by the frontend table and also by the polling mechanism that
 * auto-refreshes the UI every 5 seconds.
 *
 * Query params:
 *   - sort:   column to sort by (validated against allowlist, defaults to "startTime")
 *   - order:  "asc" or "desc" (defaults to "asc")
 *   - filter: case-insensitive substring match on movieTitle (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sort = searchParams.get("sort") || "startTime";
    const order = searchParams.get("order") || "asc";
    const filter = searchParams.get("filter") || "";

    // Validate sort field against allowlist, falling back to startTime for invalid values
    const sortField: ValidSortField = (VALID_SORT_FIELDS as readonly string[]).includes(sort)
      ? (sort as ValidSortField)
      : "startTime";
    const sortOrder: Prisma.SortOrder = order === "desc" ? "desc" : "asc";

    // Only return active showtimes — archived ones are hidden from the schedule
    const where: Prisma.ShowtimeWhereInput = {
      status: "active",
      // Prisma's `contains` with `mode: "insensitive"` performs a case-insensitive
      // LIKE query, allowing partial title matches
      ...(filter && {
        movieTitle: { contains: filter, mode: "insensitive" as const },
      }),
    };

    const showtimes = await prisma.showtime.findMany({
      where,
      orderBy: { [sortField]: sortOrder },
    });

    return NextResponse.json(showtimes);
  } catch (error) {
    console.error("Showtimes fetch error:", error);

    // Distinguish database connection errors from other failures
    if (error instanceof Prisma.PrismaClientInitializationError) {
      return NextResponse.json(
        { error: "Database connection failed. Check that DATABASE_URL is set correctly in .env." },
        { status: 503 }
      );
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to fetch showtimes: ${message}` },
      { status: 500 }
    );
  }
}
