import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendReminderEmail } from "@/lib/appscript";
import { fmtDateLong, fmtTime } from "@/lib/format";

/**
 * Sends reminder emails to the responsible person if a meeting's classroom
 * announcement hasn't been scheduled by the night before.
 *
 * Trigger window: from 18 hours before the meeting until the meeting itself.
 * (For a Thursday 11:10 AM meeting, that's roughly Wednesday 5:10 PM onward.)
 *
 * Idempotent: each meeting gets one reminder via reminderSentAt.
 */
export async function POST() {
  const now = new Date();
  const eighteenHoursOut = new Date(now.getTime() + 18 * 60 * 60 * 1000);

  const meetings = await prisma.meeting.findMany({
    where: {
      date: { gt: now, lte: eighteenHoursOut },
      reminderSentAt: null,
      responsibleEmail: { not: null },
      announcement: null,
    },
  });

  const results = [];

  for (const meeting of meetings) {
    if (!meeting.responsibleEmail) continue;

    const meetingTime = `${fmtDateLong(meeting.date)} at ${fmtTime(meeting.date)}`;

    const subject = `MUN Reminder: No announcement scheduled for ${meeting.title}`;
    const body = `
      <p>Hi,</p>
      <p>This is an automated reminder from the MUN Dashboard.</p>
      <p>Your meeting <strong>${meeting.title}</strong> is scheduled for
        <strong>${meetingTime}</strong> in <strong>${meeting.location}</strong>,
        but no Google Classroom announcement has been scheduled or posted yet.</p>
      <p>Please open the dashboard and either schedule or post the announcement.</p>
      <p>— MUN Dashboard</p>
    `;

    const result = await sendReminderEmail(meeting.responsibleEmail, subject, body);

    if (result.ok) {
      await prisma.meeting.update({
        where: { id: meeting.id },
        data: { reminderSentAt: new Date() },
      });
    }

    results.push({ meetingId: meeting.id, to: meeting.responsibleEmail, ...result });
  }

  return NextResponse.json({ processed: results.length, results });
}
