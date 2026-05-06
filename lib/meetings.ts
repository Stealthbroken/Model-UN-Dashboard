import { prisma } from "@/lib/db";

/**
 * The fixed weekly meeting slot:
 * Every Thursday at 11:10 AM in Room 137.
 */
export const MEETING_DAY_OF_WEEK = 4; // 0=Sun ... 4=Thu
export const MEETING_HOUR = 11;
export const MEETING_MINUTE = 10;
export const MEETING_LOCATION = "Room 137";
export const WEEKS_TO_SEED = 12;

/**
 * Returns the next N Thursdays starting from today (inclusive if today is
 * Thursday and the meeting time hasn't passed yet — otherwise next Thursday).
 */
export function nextThursdays(count: number, from: Date = new Date()): Date[] {
  const result: Date[] = [];
  const d = new Date(from);
  d.setHours(MEETING_HOUR, MEETING_MINUTE, 0, 0);

  // Move forward to the next Thursday at meeting time
  while (d.getDay() !== MEETING_DAY_OF_WEEK || d < from) {
    d.setDate(d.getDate() + 1);
    d.setHours(MEETING_HOUR, MEETING_MINUTE, 0, 0);
  }

  for (let i = 0; i < count; i++) {
    result.push(new Date(d));
    d.setDate(d.getDate() + 7);
  }
  return result;
}

/**
 * Ensures the next N Thursday meetings exist in the DB. Idempotent — uses
 * upsert on the unique date field. Run on every dashboard load.
 */
export async function seedUpcomingMeetings(): Promise<void> {
  const dates = nextThursdays(WEEKS_TO_SEED);
  for (const date of dates) {
    await prisma.meeting.upsert({
      where: { date },
      create: {
        date,
        location: MEETING_LOCATION,
      },
      update: {},
    });
  }
}

/**
 * Default scheduled time for a classroom announcement: 6:00 PM the day before
 * the meeting.
 */
export function defaultAnnouncementTime(meetingDate: Date): Date {
  const d = new Date(meetingDate);
  d.setDate(d.getDate() - 1);
  d.setHours(18, 0, 0, 0);
  return d;
}
