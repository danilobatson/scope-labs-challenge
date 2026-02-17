import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

export async function POST() {
  try {
    // Clear existing data first
    await prisma.showtime.deleteMany({});

    // Seed with demo data
    await prisma.showtime.createMany({
      data: seedData,
    });

    return NextResponse.json({
      success: true,
      count: seedData.length,
    });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json(
      { error: "Failed to seed data" },
      { status: 500 }
    );
  }
}
