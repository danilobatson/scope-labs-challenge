import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    await prisma.showtime.deleteMany({});
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Clear error:", error);
    return NextResponse.json(
      { error: "Failed to clear schedule" },
      { status: 500 }
    );
  }
}
