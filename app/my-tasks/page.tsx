import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { MyTasksView } from "@/components/MyTasksView";

export const dynamic = "force-dynamic";

export default async function MyTasksPage() {
  const [execsRaw, session] = await Promise.all([
    prisma.executive.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, role: true, pinHash: true },
    }),
    getSession(),
  ]);

  // Expose only whether a PIN exists — never the hash.
  const executives = execsRaw.map((e) => {
    const { pinHash, ...rest } = e as typeof e & { pinHash?: string | null };
    return { ...rest, hasPin: !!pinHash };
  });

  const active = session.executiveId
    ? executives.find((e) => e.id === session.executiveId) ?? null
    : null;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">My Tasks</h1>
        <p className="text-sm text-gray-500 mt-1">
          Everything assigned to you across all meetings.
        </p>
      </div>
      <MyTasksView
        executives={JSON.parse(JSON.stringify(executives))}
        initialExecId={active?.id ?? null}
        initialExecName={active?.name ?? null}
      />
    </div>
  );
}
