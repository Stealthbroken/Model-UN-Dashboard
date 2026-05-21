import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Serves an Instagram post's image straight from the database.
 *
 * Public (the middleware matcher excludes /api) so that Meta's Graph API
 * can fetch the image when publishing a post.
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const id = parseInt(params.id);
  if (isNaN(id)) {
    return new NextResponse("Bad id", { status: 400 });
  }

  const post = await prisma.instagramPost.findUnique({ where: { id } });
  if (!post || !post.imageData) {
    return new NextResponse("Image not found", { status: 404 });
  }

  return new NextResponse(new Uint8Array(post.imageData), {
    headers: {
      "Content-Type": post.imageMimeType || "image/jpeg",
      "Cache-Control": "private, max-age=60",
    },
  });
}
