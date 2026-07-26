import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { MeetingDetail } from "@/components/MeetingDetail";

export const dynamic = "force-dynamic";

export default async function MeetingPage({ params }: { params: { id: string } }) {
  const id = params.id;
  if (!id) notFound();

  const [meeting, executives] = await Promise.all([
    prisma.meeting.findUnique({
      where: { id },
      include: {
        // Exclude the PDF blob — it's served separately via its API route.
        topicGuide: { select: { id: true, filename: true, path: true } },
        announcement: true,
        tasks: { orderBy: { sortOrder: "asc" } },
        attendance: true,
      },
    }),
    prisma.executive.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);

  if (!meeting) notFound();

  const previousMeeting = await prisma.meeting.findFirst({
    where: { date: { lt: meeting.date } },
    orderBy: { date: "desc" },
  });

  const previousUnfinishedCount = previousMeeting
    ? await prisma.task.count({
        where: { meetingId: previousMeeting.id, completed: false },
      })
    : 0;

  return (
    <MeetingDetail
      meeting={JSON.parse(JSON.stringify(meeting))}
      executives={JSON.parse(JSON.stringify(executives))}
      previousUnfinishedCount={previousUnfinishedCount}
    />
  );
}
