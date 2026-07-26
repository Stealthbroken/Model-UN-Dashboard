import { prisma } from "@/lib/db";
import { TopicBank } from "@/components/TopicBank";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function TopicsPage({
  searchParams,
}: {
  searchParams: { focus?: string };
}) {
  // Load topics + a slim list of meetings so users can attach a topic to one
  // when marking it "used". We don't need archived meetings here.
  const now = new Date();
  const [topics, meetings, user] = await Promise.all([
    prisma.topic.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    }),
    prisma.meeting.findMany({
      orderBy: [{ date: "desc" }],
      where: { date: { gte: new Date(now.getFullYear() - 1, now.getMonth(), 1) } },
      select: { id: true, title: true, date: true, type: true },
    }),
    getCurrentUser(),
  ]);

  // JSON round-trip turns Dates into ISO strings, which is what TopicBank's
  // client-side types expect — cast through unknown to bridge the gap.
  return (
    <TopicBank
      initial={JSON.parse(JSON.stringify(topics))}
      meetings={JSON.parse(JSON.stringify(meetings))}
      aiEnabled={!!process.env.OPENAI_API_KEY}
      docsEnabled={!!process.env.APPS_SCRIPT_URL}
      viewerId={user?.id ?? null}
      focusId={searchParams.focus ?? null}
    />
  );
}
