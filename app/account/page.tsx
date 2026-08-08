import Link from "next/link";

import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { getCurrentUser, listAccountExecs } from "@/lib/auth";
import { ROLE_LABEL, roleCanSecgen } from "@/lib/session";
import { fmtDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) return null; // middleware redirects; nothing to render

  const execs = await listAccountExecs();
  const exec = user.id ? execs.find((e) => e.id === user.id) : null;

  return (
    <div className="page-shell max-w-xl">
      <div className="mb-6">
        <p className="section-kicker">Profile</p><h1 className="page-heading mt-1">Your account</h1>
        <p className="text-sm text-gray-500 mt-1">Sign-in details and password.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-5">
        <dl className="space-y-2.5 text-sm">
          <Row label="Name" value={exec ? exec.name : user.name} />
          {exec?.role && <Row label="Role on roster" value={exec.role} />}
          <Row
            label="Access level"
            value={
              <span className="inline-flex items-center gap-2">
                {ROLE_LABEL[user.role]}
                {roleCanSecgen(user.role) && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary-100 text-primary-800">
                    Sec-Gen
                  </span>
                )}
              </span>
            }
          />
          {exec?.username && (
            <Row label="Username" value={<span className="font-mono">{exec.username}</span>} />
          )}
          {exec?.email && <Row label="Email" value={exec.email} />}
          {exec?.lastLoginAt && (
            <Row label="Last signed in" value={fmtDateTime(exec.lastLoginAt)} />
          )}
        </dl>
      </div>

      {user.viaTeamPassword ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">You&apos;re using the team password</p>
          <p className="text-xs text-amber-800 mt-1 leading-relaxed">
            Shared sign-ins have no personal password to change, and can&apos;t hold Sec-Gen access
            once accounts exist. Ask a Secretary-General to create an account for you — you&apos;ll
            get an email link to set your own password.
          </p>
          {roleCanSecgen(user.role) && (
            <Link
              href="/executives"
              className="inline-block mt-3 text-xs font-medium text-primary-700 hover:underline"
            >
              Create accounts in the Sec-Gen Panel →
            </Link>
          )}
        </div>
      ) : (
        <ChangePasswordForm />
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-gray-500 shrink-0">{label}</dt>
      <dd className="text-gray-900 font-medium text-right">{value}</dd>
    </div>
  );
}
