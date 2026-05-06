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
    },
  });

  if (!meeting) notFound();

  return <MeetingDetail meeting={JSON.parse(JSON.stringify(meeting))} />;
}
