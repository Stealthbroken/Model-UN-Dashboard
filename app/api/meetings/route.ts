import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const meetings = await prisma.meeting.findMany({
    orderBy: { date: "asc" },
  });
  return NextResponse.json(meetings);
}

/*
 * POST accepts two shapes:
 *  - single:    { mode: "single", date, title?, location? }
 *  - recurring: { mode: "recurring", startDate, endDate, dayOfWeek (0–6),
 *                 hour, minute, title?, location? }
 * Both return the created meetings as an array.
 */
export async function POST(request: NextRequest) {
  const data = await request.json();

  if (data.mode === "recurring") {
    return createRecurring(data);
  }
  return createSingle(data);
}

async function createSingle(data: {
  date: string;
  title?: string;
  location?: string;
}) {
  if (!data.date) {
    return NextResponse.json({ error: "date is required" }, { status: 400 });
  }
  try {
    const meeting = await prisma.meeting.create({
      data: {
        date: new Date(data.date),
        title: data.title || "MUN Meeting",
        location: data.location || "Room 137",
      },
    });
    return NextResponse.json([meeting], { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

async function createRecurring(data: {
  startDate: string;
  endDate: string;
  dayOfWeek: number;
  hour: number;
  minute: number;
  title?: string;
  location?: string;
}) {
  const { startDate, endDate, dayOfWeek, hour, minute } = data;
  if (
    !startDate ||
    !endDate ||
    dayOfWeek === undefined ||
    hour === undefined ||
    minute === undefined
  ) {
    return NextResponse.json({ error: "Missing recurring fields" }, { status: 400 });
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (end < start) {
    return NextResponse.json({ error: "endDate must be on or after startDate" }, { status: 400 });
  }

  const dates: Date[] = [];
  const cursor = new Date(start);
  cursor.setHours(hour, minute, 0, 0);
  // Walk forward until cursor lands on the right weekday
  while (cursor.getDay() !== dayOfWeek) {
    cursor.setDate(cursor.getDate() + 1);
  }
  while (cursor <= end) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 7);
  }

  if (dates.length === 0) {
    return NextResponse.json({ error: "No matching dates in the range" }, { status: 400 });
  }
  if (dates.length > 200) {
    return NextResponse.json({ error: "Range produces more than 200 meetings" }, { status: 400 });
  }

  const created = [];
  const skipped: string[] = [];
  for (const date of dates) {
    try {
      const m = await prisma.meeting.create({
        data: {
          date,
          title: data.title || "Weekly MUN Meeting",
          location: data.location || "Room 137",
        },
      });
      created.push(m);
    } catch {
      // Likely a unique-constraint conflict on date — skip silently
      skipped.push(date.toISOString());
    }
  }

  return NextResponse.json(
    { created: created.length, skipped: skipped.length, meetings: created, conflicts: skipped },
    { status: 201 },
  );
}

export async function DELETE(request: NextRequest) {
  const { id } = await request.json();
  await prisma.meeting.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
