import { prisma } from "@/lib/db";
import { MyTasksView } from "@/components/MyTasksView";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function MyTasksPage() {
  const [executives, user] = await Promise.all([
    prisma.executive.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, role: true },
    }),
    getCurrentUser(),
  ]);

  // Signed-in accounts land on their own list; shared sessions still pick a name.
  const selfId =
    user?.id && executives.some((e) => e.id === user.id) ? user.id : null;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">My Tasks</h1>
        <p className="text-sm text-gray-500 mt-1">
          {selfId
            ? "Everything assigned to you across all meetings."
            : "Pick your name to see everything assigned to you across all meetings."}
        </p>
      </div>
      <MyTasksView
        executives={JSON.parse(JSON.stringify(executives))}
        selfId={selfId}
      />
    </div>
  );
}
