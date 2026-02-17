import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/showtimes/clear
 *
 * Hard-deletes ALL showtime records (both active and archived) for a full
 * schedule reset. Unlike the archive operation in reconciliation (which is
 * a soft delete), this is a destructive action intended for resetting the
 * database to a clean state.
 */
export async function POST() {
  try {
    const { count } = await prisma.showtime.deleteMany({});
    return NextResponse.json({ success: true, deleted: count });
  } catch (error) {
    console.error("Clear error:", error);

    if (error instanceof Prisma.PrismaClientInitializationError) {
      return NextResponse.json(
        { error: "Database connection failed. Check that DATABASE_URL is set correctly in .env." },
        { status: 503 }
      );
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to clear schedule: ${message}` },
      { status: 500 }
    );
  }
}
