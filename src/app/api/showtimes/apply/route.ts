import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ReconciliationResult } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const result: ReconciliationResult = await request.json();

    await prisma.$transaction(async (tx) => {
      // Apply adds
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

      // Apply updates
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

      // Apply archives
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
    return NextResponse.json(
      { error: "Failed to apply changes" },
      { status: 500 }
    );
  }
}
