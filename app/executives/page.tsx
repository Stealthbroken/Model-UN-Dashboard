import Link from "next/link";

import { prisma } from "@/lib/db";
import { ExecutivesManager } from "@/components/ExecutivesManager";
import { AccountsManager } from "@/components/AccountsManager";
import { MinutesDocSettings } from "@/components/MinutesDocSettings";
import { TopicGuideSettings } from "@/components/TopicGuideSettings";
import { DocTemplatesEditor } from "@/components/DocTemplatesEditor";
import { DiscordSettings } from "@/components/DiscordSettings";
import { DigestPanel } from "@/components/DigestPanel";
import { getCurrentUser, listAccountExecs } from "@/lib/auth";
import { toAccountSummary } from "@/lib/accounts";
import {
  getMinutesDocSettings,
  getDiscordWebhookUrl,
  getAllowTeamPassword,
  getTopicGuideFolderId,
  getDocTemplates,
} from "@/lib/settings";
import { DEFAULT_DOC_TEMPLATES } from "@/lib/doc-templates";

export const dynamic = "force-dynamic";

export default async function ExecutivesPage() {
  const user = await getCurrentUser();

  // Middleware already redirects non-Sec-Gens, but re-check here: the cookie's
  // cached role could be stale, and pages must not trust it.
  if (!user?.canSecgen) {
    return <NoAccess />;
  }

  const [
    execs,
    settings,
    discordWebhookUrl,
    allowTeamPassword,
    topicGuideFolderId,
    docTemplates,
  ] = await Promise.all([
    listAccountExecs(),
    getMinutesDocSettings(),
    getDiscordWebhookUrl(),
    getAllowTeamPassword(),
    getTopicGuideFolderId(),
    getDocTemplates(),
  ]);

  const rosterOrder = [...execs].sort(
    (a, b) =>
      Number(b.active) - Number(a.active) ||
      a.sortOrder - b.sortOrder ||
      a.name.localeCompare(b.name),
  );

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Sec-Gen Panel</h1>
        <p className="text-sm text-gray-500 mt-1">
          Roster, account access, and integrations. Signed in as{" "}
          <span className="font-medium text-gray-700">{user.name}</span>
          {user.viaTeamPassword && (
            <span className="text-amber-700"> (team password — first-time setup)</span>
          )}
          .
        </p>
      </div>

      {user.viaTeamPassword && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">Finish setting up accounts</p>
          <p className="text-xs text-amber-800 mt-1 leading-relaxed">
            You have Sec-Gen powers right now only because no Sec-Gen account exists yet. Create
            your own account below and sign in with it — once one exists, the shared team password
            drops to member-level access.
          </p>
        </div>
      )}

      <div className="space-y-6">
        <AccountsManager
          initial={rosterOrder.map(toAccountSummary)}
          viewerRole={user.role}
          viewerId={user.id}
          allowTeamPassword={allowTeamPassword}
          emailConfigured={!!process.env.APPS_SCRIPT_URL}
        />
        <ExecutivesManager initial={JSON.parse(JSON.stringify(rosterOrder))} />
        <MinutesDocSettings initial={JSON.parse(JSON.stringify(settings))} />
        <TopicGuideSettings
          initialFolderId={topicGuideFolderId}
          docsEnabled={!!process.env.APPS_SCRIPT_URL}
        />
        <DocTemplatesEditor initial={docTemplates} defaults={DEFAULT_DOC_TEMPLATES} />
        <DiscordSettings initialUrl={discordWebhookUrl} />
        <DigestPanel />
      </div>
    </div>
  );
}

function NoAccess() {
  return (
    <div className="max-w-md mx-auto mt-12">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 text-center">
        <div className="text-3xl mb-2">🔒</div>
        <h1 className="text-xl font-bold text-gray-900">Sec-Gen access required</h1>
        <p className="text-sm text-gray-500 mt-2 leading-relaxed">
          Roster management, account access, and integration settings are limited to accounts with
          Sec-Gen access. Ask a Secretary-General to grant it to your account — there&apos;s no
          password to enter.
        </p>
        <Link
          href="/"
          className="inline-block mt-5 px-3 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
