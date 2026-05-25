import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { storage, ID, BUCKETS } from "@/lib/appwrite";
import { InputFile } from "node-appwrite/file";

// Topic guides live in Appwrite Storage; the DB row keeps a file id plus the
// stable public-API path that Apps Script attaches to Classroom posts.
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const meetingId = formData.get("meetingId") as string | null;

  if (!file || !meetingId) {
    return NextResponse.json({ error: "Missing file or meetingId" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large — 8 MB maximum" }, { status: 400 });
  }

  // Drop any prior bucket file for this meeting so we don't leak storage.
  const prior = await prisma.topicGuide.findUnique({ where: { meetingId } });
  if (prior?.bucketFileId) {
    await storage.deleteFile(BUCKETS.topicGuides, prior.bucketFileId).catch(() => {});
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const uploaded = await storage.createFile(
    BUCKETS.topicGuides,
    ID.unique(),
    InputFile.fromBuffer(buf, file.name || "topic-guide.pdf"),
  );

  const mimeType = file.type || "application/pdf";
  const path = `/api/topic-guide/file/${meetingId}`;

  const guide = await prisma.topicGuide.upsert({
    where: { meetingId },
    create: { filename: file.name, mimeType, bucketFileId: uploaded.$id, meetingId, uploadedAt: new Date() },
    update: { filename: file.name, mimeType, bucketFileId: uploaded.$id, uploadedAt: new Date() },
  });

  return NextResponse.json(
    { id: guide.id, filename: guide.filename, path, meetingId: guide.meetingId },
    { status: 201 },
  );
}

export async function DELETE(request: NextRequest) {
  const { id } = await request.json();
  const existing = await prisma.topicGuide.findUnique({ where: { id } });
  if (existing?.bucketFileId) {
    await storage.deleteFile(BUCKETS.topicGuides, existing.bucketFileId).catch(() => {});
  }
  await prisma.topicGuide.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
