import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { storage, ID, BUCKETS } from "@/lib/appwrite";
import { InputFile } from "node-appwrite/file";

// Image binaries live in Appwrite Storage; the DB row only keeps a file id and
// a stable public-API path that Meta's Graph API can fetch.
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

const publicFields = {
  id: true,
  caption: true,
  imagePath: true,
  status: true,
  postedAt: true,
  createdAt: true,
} as const;

export async function GET() {
  const posts = await prisma.instagramPost.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: publicFields,
  });
  return NextResponse.json(posts);
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const idRaw = formData.get("id") as string | null;
  const caption = formData.get("caption") as string;
  const file = formData.get("image") as File | null;
  const autoPost = formData.get("autoPost") === "true";

  if (!caption) {
    return NextResponse.json({ error: "Caption is required" }, { status: 400 });
  }

  let uploadedFileId: string | undefined;
  let imageMimeType: string | undefined;
  if (file && file.size > 0) {
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Image too large — 8 MB maximum" }, { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const uploaded = await storage.createFile(
      BUCKETS.instagramPosts,
      ID.unique(),
      InputFile.fromBuffer(buf, file.name || "instagram.jpg"),
    );
    uploadedFileId = uploaded.$id;
    imageMimeType = file.type || "image/jpeg";
  }

  const id = idRaw && idRaw.trim() ? idRaw.trim() : null;
  let post;

  if (id) {
    const existing = await prisma.instagramPost.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (existing.status === "posted") {
      return NextResponse.json({ error: "Already posted — cannot edit" }, { status: 400 });
    }
    // Replacing the image — delete the old file so the bucket doesn't grow forever.
    if (uploadedFileId && existing.bucketFileId) {
      await storage.deleteFile(BUCKETS.instagramPosts, existing.bucketFileId).catch(() => {});
    }
    post = await prisma.instagramPost.update({
      where: { id },
      data: {
        caption,
        ...(uploadedFileId
          ? { bucketFileId: uploadedFileId, imageMimeType, imagePath: `/api/instagram/image/${id}` }
          : {}),
      },
      select: publicFields,
    });
  } else {
    const created = await prisma.instagramPost.create({
      data: { caption, status: "draft", bucketFileId: uploadedFileId, imageMimeType },
    });
    post = await prisma.instagramPost.update({
      where: { id: created.id },
      data: uploadedFileId ? { imagePath: `/api/instagram/image/${created.id}` } : {},
      select: publicFields,
    });
  }

  if (autoPost) {
    const result = await publishToInstagram(caption, post.imagePath);
    const updated = await prisma.instagramPost.update({
      where: { id: post.id },
      data: {
        status: result.ok ? "posted" : "failed",
        postedAt: result.ok ? new Date() : null,
      },
      select: publicFields,
    });
    return NextResponse.json({ ...updated, error: result.error });
  }

  return NextResponse.json(post, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { id } = await request.json();
  // Best-effort: remove the bucket file too. The DB delete is the source of
  // truth; a lingering bucket file is harmless if cleanup fails.
  const existing = await prisma.instagramPost.findUnique({ where: { id } });
  if (existing?.bucketFileId) {
    await storage.deleteFile(BUCKETS.instagramPosts, existing.bucketFileId).catch(() => {});
  }
  await prisma.instagramPost.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

async function publishToInstagram(
  caption: string,
  imagePath: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  const userId = process.env.INSTAGRAM_USER_ID;

  if (!accessToken || !userId) {
    return {
      ok: false,
      error: "Instagram API not configured. Set INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_USER_ID in .env.local",
    };
  }
  if (!imagePath) {
    return { ok: false, error: "An image is required for Instagram posts" };
  }

  try {
    const imageUrl = `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}${imagePath}`;

    const createRes = await fetch(`https://graph.facebook.com/v19.0/${userId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: imageUrl, caption, access_token: accessToken }),
    });
    const createData = await createRes.json();
    if (createData.error) return { ok: false, error: createData.error.message };

    const publishRes = await fetch(`https://graph.facebook.com/v19.0/${userId}/media_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: createData.id, access_token: accessToken }),
    });
    const publishData = await publishRes.json();
    if (publishData.error) return { ok: false, error: publishData.error.message };

    return { ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
}
