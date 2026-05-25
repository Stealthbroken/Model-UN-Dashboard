import { prisma } from "@/lib/db";
import { TopicBank } from "@/components/TopicBank";

export const dynamic = "force-dynamic";

export default async function TopicsPage() {
  // Load topics + a slim list of meetings so users can attach a topic to one
  // when marking it "used". We don't need archived meetings here.
  const now = new Date();
  const [topics, meetings] = await Promise.all([
    prisma.topic.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    }),
    prisma.meeting.findMany({
      orderBy: [{ date: "desc" }],
      where: { date: { gte: new Date(now.getFullYear() - 1, now.getMonth(), 1) } },
    }),
  ]);

  const aiEnabled = !!process.env.OPENAI_API_KEY;

  // JSON round-trip turns Dates into ISO strings, which is what TopicBank's
  // client-side types expect — cast through unknown to bridge the gap.
  return (
    <TopicBank
      initial={JSON.parse(JSON.stringify(topics))}
      meetings={JSON.parse(JSON.stringify(meetings))}
      aiEnabled={aiEnabled}
    />
  );
}
