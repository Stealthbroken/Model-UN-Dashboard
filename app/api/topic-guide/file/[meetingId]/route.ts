import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { storage, BUCKETS } from "@/lib/appwrite";

/**
 * Streams a meeting's topic guide PDF out of Appwrite Storage.
 *
 * Public (the middleware matcher excludes /api) so that Google Apps Script
 * can fetch the file when attaching it to a Classroom announcement.
 */
export async function GET(
  _request: Request,
  { params }: { params: { meetingId: string } },
) {
  if (!params.meetingId) {
    return new NextResponse("Bad meeting id", { status: 400 });
  }

  const guide = await prisma.topicGuide.findUnique({ where: { meetingId: params.meetingId } });
  if (!guide) {
    return new NextResponse("Topic guide not found", { status: 404 });
  }

  const buf = await storage.getFileDownload(BUCKETS.topicGuides, guide.bucketFileId);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": guide.mimeType || "application/pdf",
      "Content-Disposition": `inline; filename="${encodeURIComponent(guide.filename)}"`,
      "Cache-Control": "private, max-age=60",
    },
  });
}
