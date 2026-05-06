import { prisma } from "@/lib/db";
import { InstagramManager } from "@/components/InstagramManager";

export const dynamic = "force-dynamic";

export default async function InstagramPage() {
  const posts = await prisma.instagramPost.findMany({
    orderBy: [{ createdAt: "desc" }],
  });

  const apiConfigured = !!(process.env.INSTAGRAM_ACCESS_TOKEN && process.env.INSTAGRAM_USER_ID);

  return (
    <InstagramManager
      posts={JSON.parse(JSON.stringify(posts))}
      apiConfigured={apiConfigured}
    />
  );
}
