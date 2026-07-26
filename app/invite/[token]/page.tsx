import Link from "next/link";
import { InviteForm } from "@/components/InviteForm";
import { findAccountByInviteToken, normalizeRole } from "@/lib/auth";
import { ROLE_LABEL, roleCanSecgen } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: { token: string } }) {
  const exec = await findAccountByInviteToken(params.token);

  if (!exec) {
    return (
      <Shell>
        <div className="text-center">
          <div className="text-3xl mb-2">⏳</div>
          <h1 className="text-lg font-bold text-gray-900">This link has expired</h1>
          <p className="text-sm text-gray-500 mt-2">
            Setup links are single-use and last 7 days. Ask a Secretary-General to send you a
            fresh one from the Sec-Gen Panel.
          </p>
          <Link
            href="/login"
            className="inline-block mt-4 text-sm text-primary-600 hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      </Shell>
    );
  }

  const role = normalizeRole(exec.accountRole);
  const isReset = !!exec.passwordHash;

  return (
    <Shell>
      <div className="text-center mb-5">
        <h1 className="text-xl font-bold text-gray-900">
          {isReset ? "Choose a new password" : `Welcome, ${exec.name.split(" ")[0]}`}
        </h1>
        <p className="text-sm text-gray-500 mt-1.5">
          {isReset
            ? "Pick a new password for your account."
            : "Pick a password to finish setting up your account."}
        </p>
      </div>

      <dl className="mb-5 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2.5 text-xs space-y-1">
        <div className="flex justify-between gap-3">
          <dt className="text-gray-500">Username</dt>
          <dd className="font-mono font-medium text-gray-900">{exec.username}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-gray-500">Access</dt>
          <dd className="font-medium text-gray-900">{ROLE_LABEL[role]}</dd>
        </div>
      </dl>

      {roleCanSecgen(role) && (
        <p className="mb-4 rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-xs text-primary-800">
          Your account has Sec-Gen access — you can manage the roster, accounts, and
          integrations.
        </p>
      )}

      <InviteForm token={params.token} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-10">
      <div className="max-w-sm w-full">
        <div className="text-center mb-6">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary-600">
            MUN Dashboard
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">{children}</div>
      </div>
    </div>
  );
}
