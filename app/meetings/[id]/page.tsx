import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { MeetingDetail } from "@/components/MeetingDetail";

export const dynamic = "force-dynamic";

export default async function MeetingPage({ params }: { params: { id: string } }) {
  const id = parseInt(params.id);
  if (isNaN(id)) notFound();

  const meeting = await prisma.meeting.findUnique({
    where: { id },
    include: {
      topicGuide: true,
      announcement: true,
      tasks: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!meeting) notFound();

  const executives = await prisma.executive.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  const previousMeeting = await prisma.meeting.findFirst({
    where: { date: { lt: meeting.date } },
    orderBy: { date: "desc" },
    include: { tasks: true },
  });

  const previousUnfinishedCount = previousMeeting
    ? previousMeeting.tasks.filter((t) => !t.completed).length
    : 0;

  return (
    <MeetingDetail
      meeting={JSON.parse(JSON.stringify(meeting))}
      executives={JSON.parse(JSON.stringify(executives))}
      previousUnfinishedCount={previousUnfinishedCount}
    />
  );
}
