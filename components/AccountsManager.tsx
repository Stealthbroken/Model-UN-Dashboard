"use client";

/**
 * Account administration. This is where Sec-Gen access lives: it's a property
 * of the account (the role dropdown), not a password anyone can pass around.
 */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client-api";
import { useToast } from "@/components/Toast";
import { fmtDate } from "@/lib/format";

type AccountRole = "member" | "secgen" | "owner";

interface Account {
  id: string;
  name: string;
  role: string;
  email: string | null;
  active: boolean;
  username: string | null;
  accountRole: AccountRole;
  accountActive: boolean;
  hasPassword: boolean;
  invitePending: boolean;
  inviteExpired: boolean;
  inviteSentAt: string | null;
  lastLoginAt: string | null;
}

interface InviteResult {
  url: string;
  emailed: boolean;
  emailError?: string;
}

const ROLE_OPTIONS: { value: AccountRole; label: string; hint: string }[] = [
  { value: "member", label: "Member", hint: "Meetings, tasks, topics" },
  { value: "secgen", label: "Sec-Gen", hint: "Also: roster, accounts, integrations" },
  { value: "owner", label: "Owner", hint: "Also: manage other Sec-Gens and owners" },
];

const ROLE_BADGE: Record<AccountRole, string> = {
  member: "bg-gray-100 text-gray-700",
  secgen: "bg-primary-100 text-primary-800",
  owner: "bg-purple-100 text-purple-800",
};

const ROLE_LABEL: Record<AccountRole, string> = {
  member: "Member",
  secgen: "Sec-Gen",
  owner: "Owner",
};

export function AccountsManager({
  initial,
  viewerRole,
  viewerId,
  allowTeamPassword,
  emailConfigured,
}: {
  initial: Account[];
  viewerRole: AccountRole;
  /** null when signed in with the shared team password. */
  viewerId: string | null;
  allowTeamPassword: boolean;
  /** APPS_SCRIPT_URL is set, so invite emails can actually go out. */
  emailConfigured: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [accounts, setAccounts] = useState<Account[]>(initial);
  const [teamPasswordOn, setTeamPasswordOn] = useState(allowTeamPassword);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creatingFor, setCreatingFor] = useState<string | null>(null);

  const isOwner = viewerRole === "owner";

  const withAccounts = useMemo(
    () => accounts.filter((a) => !!a.username),
    [accounts],
  );
  const withoutAccounts = useMemo(
    () => accounts.filter((a) => !a.username),
    [accounts],
  );
  const secgenCount = useMemo(
    () =>
      accounts.filter(
        (a) => a.hasPassword && a.accountActive && a.accountRole !== "member",
      ).length,
    [accounts],
  );

  function replace(updated: Account) {
    setAccounts((cur) => cur.map((a) => (a.id === updated.id ? updated : a)));
  }

  function showInvite(name: string, invite: InviteResult | null) {
    if (!invite) {
      toast.success(`Account created for ${name}.`);
      return;
    }
    if (invite.emailed) {
      toast.success(`Setup link emailed to ${name}.`, { copy: invite.url });
    } else {
      toast.info(
        `Account ready, but the email didn't send${
          invite.emailError ? ` (${invite.emailError})` : ""
        }. Copy the link and send it yourself.`,
        { copy: invite.url },
      );
    }
  }

  /* ─── mutations ────────────────────────────────────────────────────────── */

  async function createAccount(execId: string, username: string, accountRole: AccountRole) {
    setBusyId(execId);
    const res = await api<{ account: Account; invite: InviteResult | null }>("/api/accounts", {
      method: "POST",
      body: { executiveId: execId, username, accountRole },
    });
    setBusyId(null);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    replace(res.data.account);
    setCreatingFor(null);
    showInvite(res.data.account.name, res.data.invite);
    router.refresh();
  }

  async function patchAccount(account: Account, patch: Partial<Account>, successMsg: string) {
    setBusyId(account.id);
    const res = await api<Account>(`/api/accounts/${account.id}`, {
      method: "PATCH",
      body: patch,
    });
    setBusyId(null);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    replace(res.data);
    toast.success(successMsg);
    router.refresh();
  }

  async function resendInvite(account: Account) {
    setBusyId(account.id);
    const res = await api<{ invite: InviteResult; account: Account | null }>(
      `/api/accounts/${account.id}/invite`,
      { method: "POST" },
    );
    setBusyId(null);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    if (res.data.account) replace(res.data.account);
    showInvite(account.name, res.data.invite);
  }

  async function revoke(account: Account) {
    if (
      !confirm(
        `Remove ${account.name}'s login?\n\n` +
          "They stay on the roster and keep their task history — they just can't sign in " +
          "until you create a new account for them.",
      )
    ) {
      return;
    }
    setBusyId(account.id);
    const res = await api<Account>(`/api/accounts/${account.id}`, { method: "DELETE" });
    setBusyId(null);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    replace(res.data);
    toast.success(`${account.name}'s login was removed.`);
    router.refresh();
  }

  async function toggleTeamPassword(next: boolean) {
    const res = await api<{ allowTeamPassword: boolean }>("/api/settings/access", {
      method: "PATCH",
      body: { allowTeamPassword: next },
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setTeamPasswordOn(res.data.allowTeamPassword);
    toast.success(
      res.data.allowTeamPassword
        ? "Shared team password re-enabled."
        : "Shared team password disabled — personal accounts only.",
    );
    router.refresh();
  }

  /* ─── render ───────────────────────────────────────────────────────────── */

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
          <div>
            <h2 className="font-semibold text-gray-900">Accounts &amp; access</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Sec-Gen access is tied to the account — set it once and it sticks. There&apos;s no
              shared PIN to hand around.
            </p>
          </div>
          <span className="text-xs text-gray-400 shrink-0">
            {secgenCount} with Sec-Gen · {withAccounts.length} with logins
          </span>
        </div>

        {!emailConfigured && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <strong>APPS_SCRIPT_URL isn&apos;t set</strong>, so invite emails can&apos;t send.
            Accounts still work — you&apos;ll get a setup link to copy and share manually.
          </p>
        )}

        {/* Shared team password switch */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900">Shared team password</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {teamPasswordOn
                ? "Anyone with SESSION_PASSWORD can sign in as a member (no Sec-Gen access)."
                : "Off — everyone needs their own account to sign in."}
            </p>
          </div>
          <button
            onClick={() => toggleTeamPassword(!teamPasswordOn)}
            className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
              teamPasswordOn
                ? "border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
                : "border-green-300 bg-green-50 text-green-800 hover:bg-green-100"
            }`}
          >
            {teamPasswordOn ? "Turn off" : "Turn on"}
          </button>
        </div>
      </div>

      {/* Existing accounts */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h3 className="font-semibold text-gray-900 mb-3">
          Logins <span className="text-gray-400 font-normal">({withAccounts.length})</span>
        </h3>
        {withAccounts.length === 0 ? (
          <p className="text-sm text-gray-400">
            No accounts yet. Create one from the roster below.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {withAccounts.map((a) => (
              <AccountRow
                key={a.id}
                account={a}
                busy={busyId === a.id}
                isSelf={a.id === viewerId}
                viewerIsOwner={isOwner}
                onChangeRole={(role) =>
                  patchAccount(
                    a,
                    { accountRole: role },
                    `${a.name} is now ${ROLE_LABEL[role]}.`,
                  )
                }
                onToggleActive={() =>
                  patchAccount(
                    a,
                    { accountActive: !a.accountActive },
                    a.accountActive
                      ? `${a.name}'s login is disabled.`
                      : `${a.name}'s login is enabled.`,
                  )
                }
                onResend={() => resendInvite(a)}
                onRevoke={() => revoke(a)}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Roster entries without a login */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h3 className="font-semibold text-gray-900 mb-1">
          No login yet{" "}
          <span className="text-gray-400 font-normal">({withoutAccounts.length})</span>
        </h3>
        <p className="text-xs text-gray-500 mb-3">
          Creating an account emails a one-time setup link so they choose their own password.
        </p>
        {withoutAccounts.length === 0 ? (
          <p className="text-sm text-gray-400">Everyone on the roster has a login.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {withoutAccounts.map((a) => (
              <li key={a.id} className="py-3">
                {creatingFor === a.id ? (
                  <CreateAccountForm
                    account={a}
                    canGrantOwner={isOwner}
                    busy={busyId === a.id}
                    onCancel={() => setCreatingFor(null)}
                    onCreate={(username, role) => createAccount(a.id, username, role)}
                  />
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {a.name}
                        {!a.active && (
                          <span className="ml-2 text-[10px] uppercase tracking-wide text-gray-400">
                            inactive
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {[a.role, a.email || "no email"].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <button
                      onClick={() => setCreatingFor(a.id)}
                      className="shrink-0 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-primary-600 text-white hover:bg-primary-700"
                    >
                      Create account
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ─── Subcomponents ──────────────────────────────────────────────────────── */

function AccountRow({
  account,
  busy,
  isSelf,
  viewerIsOwner,
  onChangeRole,
  onToggleActive,
  onResend,
  onRevoke,
}: {
  account: Account;
  busy: boolean;
  isSelf: boolean;
  viewerIsOwner: boolean;
  onChangeRole: (role: AccountRole) => void;
  onToggleActive: () => void;
  onResend: () => void;
  onRevoke: () => void;
}) {
  // Only an owner may edit an owner — matches the server-side rule.
  const locked = account.accountRole === "owner" && !viewerIsOwner;

  return (
    <li className={`py-3 ${busy ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[12rem]">
          <p className="font-medium text-gray-900 flex items-center gap-2 flex-wrap">
            {account.name}
            {isSelf && (
              <span className="text-[10px] uppercase tracking-wide text-primary-600">you</span>
            )}
            <span
              className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                ROLE_BADGE[account.accountRole]
              }`}
            >
              {ROLE_LABEL[account.accountRole]}
            </span>
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            <span className="font-mono">{account.username}</span>
            {" · "}
            <AccountStatus account={account} />
          </p>
        </div>

        <select
          value={account.accountRole}
          disabled={busy || locked}
          onChange={(e) => onChangeRole(e.target.value as AccountRole)}
          title={
            locked
              ? "Only an owner can change an owner's role"
              : "Sec-Gen access is granted here"
          }
          className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white disabled:opacity-50"
        >
          {ROLE_OPTIONS.filter((o) => o.value !== "owner" || viewerIsOwner).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label} — {o.hint}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2.5 text-xs">
          <button
            onClick={onResend}
            disabled={busy}
            className="text-gray-500 hover:text-primary-700 disabled:opacity-50"
            title="Email a fresh set-password link. Their current password keeps working until they use it."
          >
            {account.hasPassword ? "Reset password" : "Resend invite"}
          </button>
          <button
            onClick={onToggleActive}
            disabled={busy || locked}
            className="text-gray-500 hover:text-amber-700 disabled:opacity-50"
            title={
              account.accountActive
                ? "Block sign-in without deleting the account"
                : "Allow sign-in again"
            }
          >
            {account.accountActive ? "Disable" : "Enable"}
          </button>
          <button
            onClick={onRevoke}
            disabled={busy || locked}
            className="text-red-500 hover:text-red-700 disabled:opacity-50"
            title="Remove the login; keeps the person and their history on the roster"
          >
            Remove
          </button>
        </div>
      </div>
    </li>
  );
}

function AccountStatus({ account }: { account: Account }) {
  if (!account.accountActive) {
    return <span className="text-red-600 font-medium">disabled</span>;
  }
  if (account.inviteExpired) {
    return <span className="text-amber-700 font-medium">invite expired</span>;
  }
  if (account.invitePending) {
    return (
      <span className="text-amber-700 font-medium">
        {account.hasPassword ? "reset link sent" : "invite sent"}
        {account.inviteSentAt ? ` ${fmtDate(account.inviteSentAt)}` : ""}
      </span>
    );
  }
  if (!account.hasPassword) {
    return <span className="text-amber-700 font-medium">no password set</span>;
  }
  return (
    <span className="text-gray-500">
      {account.lastLoginAt ? `last signed in ${fmtDate(account.lastLoginAt)}` : "never signed in"}
    </span>
  );
}

function CreateAccountForm({
  account,
  canGrantOwner,
  busy,
  onCancel,
  onCreate,
}: {
  account: Account;
  canGrantOwner: boolean;
  busy: boolean;
  onCancel: () => void;
  onCreate: (username: string, role: AccountRole) => void;
}) {
  const [username, setUsername] = useState(() => suggestHandle(account));
  const [role, setRole] = useState<AccountRole>("member");

  return (
    <div className="space-y-2.5">
      <p className="text-sm font-medium text-gray-900">
        New account for {account.name}
        {account.email ? (
          <span className="font-normal text-gray-500"> · invite goes to {account.email}</span>
        ) : (
          <span className="font-normal text-amber-700"> · no email on file, you&apos;ll get a link to share</span>
        )}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="block">
          <span className="text-xs text-gray-500">Username</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            className="input mt-0.5 font-mono"
            placeholder="firstname.lastname"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
          />
        </label>
        <label className="block">
          <span className="text-xs text-gray-500">Access level</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as AccountRole)}
            className="input mt-0.5"
          >
            {ROLE_OPTIONS.filter((o) => o.value !== "owner" || canGrantOwner).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label} — {o.hint}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900">
          Cancel
        </button>
        <button
          onClick={() => onCreate(username.trim(), role)}
          disabled={busy || username.trim().length < 3}
          className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create & send invite"}
        </button>
      </div>
    </div>
  );
}

/** Mirrors the server's suggestion so the prefilled handle matches what it'd pick. */
function suggestHandle(account: Account): string {
  const raw = account.email ? account.email.split("@")[0] : account.name;
  return (
    raw
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ".")
      .replace(/^\.+|\.+$/g, "")
      .slice(0, 40) || "member"
  );
}
