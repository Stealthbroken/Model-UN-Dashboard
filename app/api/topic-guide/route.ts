import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { writeFile } from "fs/promises";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const meetingId = formData.get("meetingId") as string | null;

  if (!file || !meetingId) {
    return NextResponse.json({ error: "Missing file or meetingId" }, { status: 400 });
  }

  const ext = file.name.split(".").pop() || "pdf";
  const storedName = `${uuidv4()}.${ext}`;
  const uploadDir = join(process.cwd(), "public", "uploads");
  const filePath = join(uploadDir, storedName);

  const bytes = await file.arrayBuffer();
  await writeFile(filePath, Buffer.from(bytes));

  const mid = parseInt(meetingId);
  const guide = await prisma.topicGuide.upsert({
    where: { meetingId: mid },
    create: {
      filename: file.name,
      path: `/uploads/${storedName}`,
      meetingId: mid,
    },
    update: {
      filename: file.name,
      path: `/uploads/${storedName}`,
    },
  });

  return NextResponse.json(guide, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { id } = await request.json();
  await prisma.topicGuide.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
