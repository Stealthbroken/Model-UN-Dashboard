import { prisma } from "@/lib/db";
import { ExecutivesManager } from "@/components/ExecutivesManager";
import { SecgenLock } from "@/components/SecgenLock";
import { SecgenLockButton } from "@/components/SecgenLockButton";
import { MinutesDocSettings } from "@/components/MinutesDocSettings";
import { DigestPanel } from "@/components/DigestPanel";
import { getSession, secgenPassword } from "@/lib/session";
import { getMinutesDocSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function ExecutivesPage() {
  const session = await getSession();
  const secgenConfigured = !!secgenPassword;

  if (!session.isSecgen) {
    return <SecgenLock configured={secgenConfigured} />;
  }

  const [execs, settings] = await Promise.all([
    prisma.executive.findMany({
      orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
    }),
    getMinutesDocSettings(),
  ]);

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sec-Gen Panel</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage the executive roster and meeting-minutes settings.
          </p>
        </div>
        <SecgenLockButton />
      </div>

      <div className="space-y-6">
        <MinutesDocSettings initial={JSON.parse(JSON.stringify(settings))} />
        <DigestPanel />
        <ExecutivesManager initial={JSON.parse(JSON.stringify(execs))} />
      </div>
    </div>
  );
}
