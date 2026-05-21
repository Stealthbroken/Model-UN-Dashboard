import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Topic guides are stored as bytes in the database (not on disk) so the app
// works on hosts with an ephemeral/read-only filesystem. Keep this modest —
// the free Postgres tier has limited storage.
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const meetingId = formData.get("meetingId") as string | null;

  if (!file || !meetingId) {
    return NextResponse.json({ error: "Missing file or meetingId" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "File too large — 8 MB maximum" },
      { status: 400 },
    );
  }

  const mid = parseInt(meetingId);
  if (isNaN(mid)) {
    return NextResponse.json({ error: "Invalid meetingId" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || "application/pdf";
  // The file is served back through an API route, keyed by meeting id.
  const path = `/api/topic-guide/file/${mid}`;

  const guide = await prisma.topicGuide.upsert({
    where: { meetingId: mid },
    create: { filename: file.name, path, mimeType, data: bytes, meetingId: mid },
    update: { filename: file.name, path, mimeType, data: bytes },
  });

  // Never ship the binary back in the JSON response.
  return NextResponse.json(
    { id: guide.id, filename: guide.filename, path: guide.path, meetingId: guide.meetingId },
    { status: 201 },
  );
}

export async function DELETE(request: NextRequest) {
  const { id } = await request.json();
  await prisma.topicGuide.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
