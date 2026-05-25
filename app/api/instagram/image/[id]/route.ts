import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { storage, BUCKETS } from "@/lib/appwrite";

/**
 * Streams an Instagram post's image out of Appwrite Storage.
 *
 * Public (the middleware matcher excludes /api) so Meta's Graph API can fetch
 * it when publishing a post.
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  if (!params.id) {
    return new NextResponse("Bad id", { status: 400 });
  }

  const post = await prisma.instagramPost.findUnique({ where: { id: params.id } });
  if (!post || !post.bucketFileId) {
    return new NextResponse("Image not found", { status: 404 });
  }

  const buf = await storage.getFileDownload(BUCKETS.instagramPosts, post.bucketFileId);
  // The SDK returns an ArrayBuffer in Node.
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": post.imageMimeType || "image/jpeg",
      "Cache-Control": "private, max-age=60",
    },
  });
}
