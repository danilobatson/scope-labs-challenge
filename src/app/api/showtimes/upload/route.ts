import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { prisma } from "@/lib/prisma";
import { reconcile } from "@/lib/reconcile";
import { ShowtimeRow } from "@/lib/types";

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  try {
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const text = await file.text();

    const parsed = Papa.parse<ShowtimeRow>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => header.trim(),
    });

    // Only reject on fatal parsing errors — Papa Parse includes non-fatal warnings
    // (e.g., trailing delimiters) that shouldn't block valid uploads
    const fatalErrors = parsed.errors.filter(
      (e) => e.type === "Delimiter" || e.type === "FieldMismatch"
    );
    if (fatalErrors.length > 0) {
      return NextResponse.json(
        { error: "CSV parsing errors", details: fatalErrors },
        { status: 400 }
      );
    }

    const existingShowtimes = await prisma.showtime.findMany({
      where: { status: "active" },
    });

    const result = reconcile(parsed.data, existingShowtimes);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to process CSV" },
      { status: 500 }
    );
  }
}
