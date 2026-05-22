import { prisma } from "@/lib/db";

export const SETTING_KEYS = {
  useSharedDrive: "useSharedDrive",
  sharedDriveId: "sharedDriveId",
  discordWebhookUrl: "discordWebhookUrl",
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
