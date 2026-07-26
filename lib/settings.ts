import { prisma } from "@/lib/db";
import {
  coerceMinutesTemplate,
  coerceTopicGuideTemplate,
  DEFAULT_MINUTES_TEMPLATE,
  DEFAULT_TOPIC_GUIDE_TEMPLATE,
  type DocTemplates,
  type MinutesTemplate,
  type TopicGuideTemplate,
} from "@/lib/doc-templates";

export const SETTING_KEYS = {
  useSharedDrive: "useSharedDrive",
  sharedDriveId: "sharedDriveId",
  discordWebhookUrl: "discordWebhookUrl",
  allowTeamPassword: "allowTeamPassword",
  topicGuideFolderId: "topicGuideFolderId",
  topicGuideTemplate: "topicGuideTemplate",
  minutesTemplate: "minutesTemplate",
} as const;

export interface MinutesDocSettings {
  useSharedDrive: boolean;
  sharedDriveId: string;
}

export async function getMinutesDocSettings(): Promise<MinutesDocSettings> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: [SETTING_KEYS.useSharedDrive, SETTING_KEYS.sharedDriveId] } },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    useSharedDrive: map.get(SETTING_KEYS.useSharedDrive) === "true",
    sharedDriveId: map.get(SETTING_KEYS.sharedDriveId) || "",
  };
}

export async function setMinutesDocSettings(
  patch: Partial<MinutesDocSettings>,
): Promise<MinutesDocSettings> {
  if (typeof patch.useSharedDrive === "boolean") {
    await prisma.setting.upsert({
      where: { key: SETTING_KEYS.useSharedDrive },
      create: { key: SETTING_KEYS.useSharedDrive, value: String(patch.useSharedDrive) },
      update: { value: String(patch.useSharedDrive) },
    });
  }
  if (typeof patch.sharedDriveId === "string") {
    await prisma.setting.upsert({
      where: { key: SETTING_KEYS.sharedDriveId },
      create: { key: SETTING_KEYS.sharedDriveId, value: patch.sharedDriveId.trim() },
      update: { value: patch.sharedDriveId.trim() },
    });
  }
  return getMinutesDocSettings();
}

/* ───────── Discord webhook ───────── */

export async function getDiscordWebhookUrl(): Promise<string> {
  const row = await prisma.setting.findUnique({
    where: { key: SETTING_KEYS.discordWebhookUrl },
  });
  return row?.value || "";
}

export async function setDiscordWebhookUrl(url: string): Promise<string> {
  const value = url.trim();
  await prisma.setting.upsert({
    where: { key: SETTING_KEYS.discordWebhookUrl },
    create: { key: SETTING_KEYS.discordWebhookUrl, value },
    update: { value },
  });
  return value;
}

/* ───────── Access control ─────────
   Whether the shared SESSION_PASSWORD still works as a way in. Turning it off
   makes personal accounts mandatory. Defaults to on so nothing breaks on
   upgrade; lib/auth.ts ignores this while the install has no Sec-Gen account. */

export async function getAllowTeamPassword(): Promise<boolean> {
  const row = await prisma.setting.findUnique({
    where: { key: SETTING_KEYS.allowTeamPassword },
  });
  return row?.value !== "false";
}

export async function setAllowTeamPassword(allow: boolean): Promise<boolean> {
  const value = String(allow);
  await prisma.setting.upsert({
    where: { key: SETTING_KEYS.allowTeamPassword },
    create: { key: SETTING_KEYS.allowTeamPassword, value },
    update: { value },
  });
  return allow;
}

/* ───────── Topic guide Docs ─────────
   Drive folder that generated topic-guide Docs land in. Falls back to the
   minutes shared drive, then to the Apps Script owner's My Drive. */

export async function getTopicGuideFolderId(): Promise<string> {
  const row = await prisma.setting.findUnique({
    where: { key: SETTING_KEYS.topicGuideFolderId },
  });
  return row?.value || "";
}

export async function setTopicGuideFolderId(id: string): Promise<string> {
  const value = id.trim();
  await prisma.setting.upsert({
    where: { key: SETTING_KEYS.topicGuideFolderId },
    create: { key: SETTING_KEYS.topicGuideFolderId, value },
    update: { value },
  });
  return value;
}

/* ───────── Doc templates ─────────
   Stored as JSON. Anything unparseable or partial falls back to the defaults in
   lib/doc-templates.ts, because these are read on every Doc creation and a bad
   value must not be able to break document generation. */

function parseStored(value: string | undefined): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function getTopicGuideTemplate(): Promise<TopicGuideTemplate> {
  const row = await prisma.setting.findUnique({
    where: { key: SETTING_KEYS.topicGuideTemplate },
  });
  return coerceTopicGuideTemplate(parseStored(row?.value));
}

export async function getMinutesTemplate(): Promise<MinutesTemplate> {
  const row = await prisma.setting.findUnique({
    where: { key: SETTING_KEYS.minutesTemplate },
  });
  return coerceMinutesTemplate(parseStored(row?.value));
}

export async function getDocTemplates(): Promise<DocTemplates> {
  const [topicGuide, minutes] = await Promise.all([
    getTopicGuideTemplate(),
    getMinutesTemplate(),
  ]);
  return { topicGuide, minutes };
}

export async function setTopicGuideTemplate(
  template: TopicGuideTemplate,
): Promise<TopicGuideTemplate> {
  const value = JSON.stringify(template);
  await prisma.setting.upsert({
    where: { key: SETTING_KEYS.topicGuideTemplate },
    create: { key: SETTING_KEYS.topicGuideTemplate, value },
    update: { value },
  });
  return template;
}

export async function setMinutesTemplate(template: MinutesTemplate): Promise<MinutesTemplate> {
  const value = JSON.stringify(template);
  await prisma.setting.upsert({
    where: { key: SETTING_KEYS.minutesTemplate },
    create: { key: SETTING_KEYS.minutesTemplate, value },
    update: { value },
  });
  return template;
}

/** Restores a template to the shipped default by clearing the stored override. */
export async function resetTopicGuideTemplate(): Promise<TopicGuideTemplate> {
  return setTopicGuideTemplate(DEFAULT_TOPIC_GUIDE_TEMPLATE);
}

export async function resetMinutesTemplate(): Promise<MinutesTemplate> {
  return setMinutesTemplate(DEFAULT_MINUTES_TEMPLATE);
}
