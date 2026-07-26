import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { isDenied, requireUser } from "@/lib/auth";
import { syncMinutesDoc } from "@/lib/minutes-sync";

const AGENDA_LIMIT = 1_900; // matches the meetings.agenda attribute size

/**
 * POST { meetingId, markUsed? } — attach a topic to a meeting and append it to
 * that meeting's agenda, so shortlisting a topic actually lands on the agenda
 * instead of being retyped by hand.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireUser();
  if (isDenied(gate)) return gate.error;

  const data = await request.json().catch(() => ({}));
  const meetingId = typeof data.meetingId === "string" ? data.meetingId : "";
  if (!meetingId) return NextResponse.json({ error: "Pick a meeting." }, { status: 400 });

  const [topic, meeting] = await Promise.all([
    prisma.topic.findUnique({ where: { id: params.id } }),
    prisma.meeting.findUnique({ where: { id: meetingId } }),
  ]);
  if (!topic) return NextResponse.json({ error: "Topic not found." }, { status: 404 });
  if (!meeting) return NextResponse.json({ error: "Meeting not found." }, { status: 404 });

  const line = `Debate topic: ${topic.title}`;
  const existing = meeting.agenda || "";
  // Don't duplicate the line if the topic was already scheduled here.
  const alreadyListed = existing.split(/\r?\n/).some((l) => l.trim() === line);

  let agenda = existing;
  let agendaUpdated = false;
  let agendaNote: string | undefined;

  if (!alreadyListed) {
    const candidate = existing.trim() ? `${existing.trimEnd()}\n${line}` : line;
    if (candidate.length > AGENDA_LIMIT) {
      agendaNote = "The agenda is full, so the topic was linked but not appended.";
    } else {
      agenda = candidate;
      agendaUpdated = true;
    }
  }

  const markUsed = data.markUsed === true;

  const [updatedTopic] = await Promise.all([
    prisma.topic.update({
      where: { id: topic.id },
      data: {
        meetingId,
        status: markUsed ? "used" : topic.status === "idea" ? "shortlisted" : topic.status,
        usedAt: markUsed ? new Date() : topic.usedAt,
      },
    }),
    agendaUpdated
      ? prisma.meeting.update({ where: { id: meetingId }, data: { agenda } })
      : Promise.resolve(null),
  ]);

  // Keep the minutes Doc in step when the agenda actually changed.
  if (agendaUpdated) await syncMinutesDoc(meetingId);

  return NextResponse.json({
    topic: updatedTopic,
    agendaUpdated,
    alreadyListed,
    agendaNote,
    meetingTitle: meeting.title,
  });
}
