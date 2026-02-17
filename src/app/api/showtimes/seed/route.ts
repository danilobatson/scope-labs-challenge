import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Sample showtime data matching the "Existing Dataset" from the project spec.
 * Includes 6 movies at Downtown Cinema 7 with various formats and ratings.
 * Note: Dune: Part Two has two entries (different start times) to test the
 * reconciliation algorithm's handling of the same movie at different times.
 */
const seedData = [
  {
    theaterName: "Downtown Cinema 7",
    movieTitle: "Spider-Man: Homecoming",
    auditorium: "Auditorium 1",
    startTime: new Date("2025-03-15T18:00:00Z"),
    endTime: new Date("2025-03-15T20:13:00Z"),
    language: "EN",
    format: "2D",
    rating: "PG-13",
    lastUpdated: new Date("2025-03-10T12:00:00Z"),
    status: "active",
  },
  {
    theaterName: "Downtown Cinema 7",
    movieTitle: "Inside Out 2",
    auditorium: "Auditorium 2",
    startTime: new Date("2025-03-15T17:30:00Z"),
    endTime: new Date("2025-03-15T19:20:00Z"),
    language: "EN",
    format: "3D",
    rating: "PG",
    lastUpdated: new Date("2025-03-10T12:00:00Z"),
    status: "active",
  },
  {
    theaterName: "Downtown Cinema 7",
    movieTitle: "Dune: Part Two",
    auditorium: "Auditorium 1",
    startTime: new Date("2025-03-15T20:00:00Z"),
    endTime: new Date("2025-03-15T22:46:00Z"),
    language: "EN",
    format: "2D",
    rating: "PG-13",
    lastUpdated: new Date("2025-03-10T12:00:00Z"),
    status: "active",
  },
  {
    theaterName: "Downtown Cinema 7",
    movieTitle: "Dune: Part Two",
    auditorium: "Auditorium 1",
    startTime: new Date("2025-03-15T22:45:00Z"),
    endTime: new Date("2025-03-16T01:31:00Z"),
    language: "EN",
    format: "2D",
    rating: "PG-13",
    lastUpdated: new Date("2025-03-10T12:00:00Z"),
    status: "active",
  },
  {
    theaterName: "Downtown Cinema 7",
    movieTitle: "Wonka",
    auditorium: "Auditorium 3",
    startTime: new Date("2025-03-15T16:00:00Z"),
    endTime: new Date("2025-03-15T17:56:00Z"),
    language: "EN",
    format: "2D",
    rating: "PG",
    lastUpdated: new Date("2025-03-10T12:00:00Z"),
    status: "active",
  },
  {
    theaterName: "Downtown Cinema 7",
    movieTitle: "Oppenheimer",
    auditorium: "Auditorium 4",
    startTime: new Date("2025-03-15T21:00:00Z"),
    endTime: new Date("2025-03-16T00:00:00Z"),
    language: "EN",
    format: "IMAX",
    rating: "PG-13",
    lastUpdated: new Date("2025-03-10T12:00:00Z"),
    status: "active",
  },
];

/**
 * POST /api/showtimes/seed
 *
 * Populates the database with sample showtime data for demo/testing purposes.
 * Clears all existing records first (hard delete) to ensure a clean starting
 * state, then bulk-inserts the seed data. This is idempotent — calling it
 * multiple times always produces the same result.
 */
export async function POST() {
  try {
    // Clear all existing data first for a clean reset
    await prisma.showtime.deleteMany({});

    // Bulk insert all seed records in a single query
    await prisma.showtime.createMany({
      data: seedData,
    });

    return NextResponse.json({
      success: true,
      count: seedData.length,
    });
  } catch (error) {
    console.error("Seed error:", error);

    if (error instanceof Prisma.PrismaClientInitializationError) {
      return NextResponse.json(
        { error: "Database connection failed. Check that DATABASE_URL is set correctly in .env." },
        { status: 503 }
      );
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to seed data: ${message}` },
      { status: 500 }
    );
  }
}
