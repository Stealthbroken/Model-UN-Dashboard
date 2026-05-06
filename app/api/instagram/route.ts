import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { writeFile } from "fs/promises";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";

export async function GET() {
  const posts = await prisma.instagramPost.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
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

  let imagePath: string | null = null;
  if (file && file.size > 0) {
    const ext = file.name.split(".").pop() || "jpg";
    const storedName = `ig-${uuidv4()}.${ext}`;
    const filePath = join(process.cwd(), "public", "uploads", storedName);
    const bytes = await file.arrayBuffer();
    await writeFile(filePath, Buffer.from(bytes));
    imagePath = `/uploads/${storedName}`;
  }

  const id = idRaw ? parseInt(idRaw) : null;
  let post;

  if (id) {
    const existing = await prisma.instagramPost.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (existing.status === "posted") {
      return NextResponse.json({ error: "Already posted — cannot edit" }, { status: 400 });
    }
    post = await prisma.instagramPost.update({
      where: { id },
      data: {
        caption,
        ...(imagePath ? { imagePath } : {}),
      },
    });
  } else {
    post = await prisma.instagramPost.create({
      data: { caption, imagePath, status: "draft" },
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
    });
    return NextResponse.json({ ...updated, error: result.error });
  }

  return NextResponse.json(post, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { id } = await request.json();
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
