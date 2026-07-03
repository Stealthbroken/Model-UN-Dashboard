import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

/**
 * iCalendar feed of all non-archived meetings, so execs can subscribe in
 * Google Calendar / Apple Calendar.
 *
 * Auth: a logged-in browser session works directly. Calendar apps can't send
 * cookies, so set CALENDAR_FEED_TOKEN in .env.local and subscribe to
 *   https://<host>/api/calendar/ics?token=<CALENDAR_FEED_TOKEN>
 */
export async function GET(request: NextRequest) {
  const token = process.env.CALENDAR_FEED_TOKEN;
  const provided = request.nextUrl.searchParams.get("token");
  const session = await getSession();
  const tokenOk = !!token && !!provided && provided === token;
  if (!session.isLoggedIn && !tokenOk) {
    return NextResponse.json(
      { error: "Not signed in. Calendar apps need ?token=<CALENDAR_FEED_TOKEN>." },
      { status: 401 },
    );
  }

  const meetings = await prisma.meeting.findMany({
    where: { archivedAt: null },
    orderBy: { date: "asc" },
  });

  const now = toIcsUtc(new Date());
  const events = meetings.map((m) => {
    const start = new Date(m.date);
    const end = new Date(start.getTime() + 60 * 60 * 1000); // default 1h slot
    return [
      "BEGIN:VEVENT",
      `UID:mun-meeting-${m.id}@mun-dashboard`,
      `DTSTAMP:${now}`,
      `DTSTART:${toIcsUtc(start)}`,
      `DTEND:${toIcsUtc(end)}`,
      `SUMMARY:${escapeIcs(`${m.type === "exec" ? "[Exec] " : ""}${m.title}`)}`,
      `LOCATION:${escapeIcs(m.location)}`,
      ...(m.agenda ? [`DESCRIPTION:${escapeIcs(m.agenda)}`] : []),
      "END:VEVENT",
    ].join("\r\n");
  });

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MUN Dashboard//Meetings//EN",
    "CALSCALE:GREGORIAN",
    "X-WR-CALNAME:MUN Meetings",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="mun-meetings.ics"',
      "Cache-Control": "no-cache",
    },
  });
}

function toIcsUtc(d: Date): string {
  return d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function escapeIcs(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}
