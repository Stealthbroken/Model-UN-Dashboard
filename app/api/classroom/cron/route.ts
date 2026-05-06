import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { postToClassroom } from "@/lib/appscript";

export async function POST() {
  const now = new Date();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  const due = await prisma.classroomAnnouncement.findMany({
    where: {
      status: "pending",
      scheduledFor: { lte: now },
    },
    include: {
      meeting: {
        include: { topicGuide: true },
      },
    },
  });

  const results = [];

  for (const announcement of due) {
    const guide = announcement.meeting.topicGuide;
    const result = await postToClassroom({
      body: announcement.body,
      materialUrl: guide ? `${baseUrl}${guide.path}` : null,
      materialName: guide?.filename || null,
    });

    await prisma.classroomAnnouncement.update({
      where: { id: announcement.id },
      data: {
        status: result.ok ? "sent" : "failed",
        sentAt: result.ok ? new Date() : null,
      },
    });

    results.push({ id: announcement.id, ...result });
  }

  return NextResponse.json({ processed: results.length, results });
}
