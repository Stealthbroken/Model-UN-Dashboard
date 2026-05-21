import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Serves a meeting's topic guide PDF straight from the database.
 *
 * Public (the middleware matcher excludes /api) so that Google Apps Script
 * can fetch the file when attaching it to a Classroom announcement.
 */
export async function GET(
  _request: Request,
  { params }: { params: { meetingId: string } },
) {
  const meetingId = parseInt(params.meetingId);
  if (isNaN(meetingId)) {
    return new NextResponse("Bad meeting id", { status: 400 });
  }

  const guide = await prisma.topicGuide.findUnique({ where: { meetingId } });
  if (!guide) {
    return new NextResponse("Topic guide not found", { status: 404 });
  }

  return new NextResponse(new Uint8Array(guide.data), {
    headers: {
      "Content-Type": guide.mimeType || "application/pdf",
      "Content-Disposition": `inline; filename="${encodeURIComponent(guide.filename)}"`,
      "Cache-Control": "private, max-age=60",
    },
  });
}
