import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sort = searchParams.get("sort") || "startTime";
  const order = searchParams.get("order") || "asc";
  const filter = searchParams.get("filter") || "";

  const validSortFields = [
    "movieTitle",
    "theaterName",
    "auditorium",
    "startTime",
    "endTime",
    "language",
    "format",
    "rating",
    "lastUpdated",
  ];
  const sortField = validSortFields.includes(sort) ? sort : "startTime";
  const sortOrder = order === "desc" ? "desc" : "asc";

  const where: Record<string, unknown> = { status: "active" };
  if (filter) {
    where.movieTitle = { contains: filter, mode: "insensitive" };
  }

  const showtimes = await prisma.showtime.findMany({
    where,
    orderBy: { [sortField]: sortOrder },
  });

  return NextResponse.json(showtimes);
}
