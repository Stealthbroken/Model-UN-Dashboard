/**
 * Account provisioning: attaching logins to roster entries, emailing invite
 * links, and the invariants that stop the club from locking itself out.
 */
import { prisma, type Executive } from "@/lib/db";
import { sendReminderEmail } from "@/lib/appscript";
import { roleCanSecgen, ROLE_LABEL, type AccountRole } from "@/lib/session";
import {
  hashPassword,
  inviteUrl,
  issueInviteToken,
  listAccountExecs,
  normalizeRole,
  normalizeUsername,
} from "@/lib/auth";

/** The account view of an exec — safe to send to the browser (no secrets). */
export interface AccountSummary {
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

export function toAccountSummary(exec: Executive): AccountSummary {
  const pending = !!exec.inviteTokenHash;
  const expired =
    pending && (!exec.inviteExpiresAt || exec.inviteExpiresAt.getTime() < Date.now());
  return {
    id: exec.id,
    name: exec.name,
    role: exec.role,
    email: exec.email,
    active: exec.active,
    username: exec.username,
    accountRole: normalizeRole(exec.accountRole),
    accountActive: exec.accountActive !== false,
    hasPassword: !!exec.passwordHash,
    invitePending: pending && !expired,
    inviteExpired: expired,
    inviteSentAt: exec.inviteSentAt ? exec.inviteSentAt.toISOString() : null,
    lastLoginAt: exec.lastLoginAt ? exec.lastLoginAt.toISOString() : null,
  };
}

/* ─── Lockout guards ─────────────────────────────────────────────────────── */

/** Accounts that can currently sign in and hold Sec-Gen. */
export async function activeSecgenAccounts(): Promise<Executive[]> {
  const execs = await listAccountExecs();
  return execs.filter(
    (e) =>
      !!e.passwordHash &&
      e.accountActive !== false &&
      roleCanSecgen(normalizeRole(e.accountRole)),
  );
}

/**
 * Rejects a change that would leave nobody able to administer the dashboard.
 * `execId` is the account about to lose Sec-Gen (via demotion, disabling,
 * revoking, or deletion).
 */
export async function blocksLastSecgen(execId: string): Promise<boolean> {
  const holders = await activeSecgenAccounts();
  return holders.length <= 1 && holders.some((e) => e.id === execId);
}

export const LAST_SECGEN_ERROR =
  "This is the only account with Sec-Gen access. Grant it to someone else first, " +
  "otherwise nobody could manage the dashboard.";

/* ─── Username validation ────────────────────────────────────────────────── */

const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,39}$/;

export interface UsernameCheck {
  ok: boolean;
  value?: string;
  error?: string;
}

export async function validateUsername(
  raw: unknown,
  /** Exec that may already own this username (so editing itself is allowed). */
  ownerId?: string,
): Promise<UsernameCheck> {
  const value = normalizeUsername(raw);
  if (!value) return { ok: false, error: "Enter a username." };
  if (!USERNAME_RE.test(value)) {
    return {
      ok: false,
      error:
        "Usernames are 3–40 characters: lowercase letters, numbers, dots, dashes, underscores.",
    };
  }
  const execs = await listAccountExecs();
  const clash = execs.find(
    (e) => normalizeUsername(e.username) === value && e.id !== ownerId,
  );
  if (clash) return { ok: false, error: "That username is already taken." };
  return { ok: true, value };
}

/* ─── Invites ────────────────────────────────────────────────────────────── */

export interface InviteResult {
  /** The link to hand over. Always returned so a Sec-Gen can copy it manually. */
  url: string;
  emailed: boolean;
  emailError?: string;
}

/**
 * Issues a fresh invite token, stores its hash, and tries to email the link.
 * The raw link is returned either way — email delivery through Apps Script is
 * best-effort, and a Sec-Gen can always copy the link into Slack instead.
 */
export async function issueInvite(exec: Executive): Promise<InviteResult> {
  const { token, tokenHash, expiresAt } = issueInviteToken();

  await prisma.executive.update({
    where: { id: exec.id },
    data: {
      inviteTokenHash: tokenHash,
      inviteExpiresAt: expiresAt,
      inviteSentAt: new Date(),
    },
  });

  const url = inviteUrl(token);
  if (!exec.email) {
    return { url, emailed: false, emailError: "No email on file — share the link yourself." };
  }

  const result = await sendReminderEmail(
    exec.email,
    "Set up your MUN Dashboard account",
    inviteEmailBody(exec, url, expiresAt),
  );
  return {
    url,
    emailed: result.ok,
    emailError: result.ok ? undefined : result.error || "Email failed to send.",
  };
}

function inviteEmailBody(exec: Executive, url: string, expiresAt: Date): string {
  const role = normalizeRole(exec.accountRole);
  const roleNote = roleCanSecgen(role)
    ? `<p style="margin:0 0 12px">Your account has <strong>${ROLE_LABEL[role]}</strong> access, so you can manage the roster, accounts, and integrations.</p>`
    : "";
  return `
<div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;color:#111827">
  <h2 style="color:#1e3a8a;margin:0 0 12px">MUN Dashboard</h2>
  <p style="margin:0 0 12px">Hi ${escapeHtml(exec.name)},</p>
  <p style="margin:0 0 12px">
    An account has been created for you on the MUN Dashboard. Choose a password
    to finish setting it up:
  </p>
  <p style="margin:0 0 16px">
    <a href="${url}" style="display:inline-block;background:#1e3a8a;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">
      Set your password
    </a>
  </p>
  ${roleNote}
  <p style="margin:0 0 12px;color:#6b7280;font-size:13px">
    Your username is <strong>${escapeHtml(exec.username || "")}</strong>.
    This link expires on ${expiresAt.toLocaleDateString("en-GB")} and can only be used once.
  </p>
  <p style="margin:0;color:#6b7280;font-size:12px">
    If the button doesn't work, paste this into your browser:<br>
    <span style="word-break:break-all">${url}</span>
  </p>
</div>`.trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ─── Password set / clear ───────────────────────────────────────────────── */

/** Consumes an invite: sets the password and clears the one-time token. */
export async function completeInvite(execId: string, password: string): Promise<void> {
  await prisma.executive.update({
    where: { id: execId },
    data: {
      passwordHash: await hashPassword(password),
      accountActive: true,
      inviteTokenHash: null,
      inviteExpiresAt: null,
    },
  });
}

/** Removes the login but keeps the person on the roster and their task history. */
export async function revokeAccount(execId: string): Promise<void> {
  await prisma.executive.update({
    where: { id: execId },
    data: {
      username: null,
      passwordHash: null,
      accountRole: "member",
      accountActive: true,
      inviteTokenHash: null,
      inviteExpiresAt: null,
      inviteSentAt: null,
    },
  });
}
