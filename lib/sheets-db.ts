/**
 * Google Sheets database client — replaces Prisma + PostgreSQL.
 *
 * All reads/writes go through the Apps Script web app (APPS_SCRIPT_URL).
 * File uploads (PDFs, images) are stored in Google Drive.
 */

// ─── Where / OrderBy types ────────────────────────────────────────────────────

type Primitive = string | number | boolean | null;
type WhereVal  =
  | Primitive
  | { gt?: string; gte?: string; lt?: string; lte?: string }
  | { not?: Primitive }
  | { in?: (string | number)[] };

export type Where   = Record<string, WhereVal>;
export type OrderBy = { field: string; dir: "asc" | "desc" };

// ─── Data model types ─────────────────────────────────────────────────────────
// Dates are ISO strings (not Date objects) throughout the Sheets layer.

export interface Meeting {
  id: number;
  date: string;
  title: string;
  location: string;
  type: string;
  agenda: string | null;
  notes: string | null;
  responsibleEmail: string | null;
  reminderSentAt: string | null;
  archivedAt: string | null;
  minutesDocId: string | null;
  minutesDocUrl: string | null;
  minutesDocCreatedAt: string | null;
  createdAt: string;
}

export interface TopicGuide {
  id: number;
  filename: string;
  path: string;
  mimeType: string;
  driveFileId: string | null;
  driveFileUrl: string | null;
  meetingId: number;
  uploadedAt: string;
}

export interface ClassroomAnnouncement {
  id: number;
  body: string;
  scheduledFor: string | null;
  status: string;
  sentAt: string | null;
  discordSentAt: string | null;
  meetingId: number;
  createdAt: string;
}

export interface InstagramPost {
  id: number;
  caption: string;
  imagePath: string | null;
  driveFileId: string | null;
  driveFileUrl: string | null;
  imageMimeType: string | null;
  status: string;
  postedAt: string | null;
  createdAt: string;
}

export interface Executive {
  id: number;
  name: string;
  role: string;
  email: string | null;
  active: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface MeetingAttendance {
  id: number;
  present: boolean;
  meetingId: number;
  executiveId: number;
}

export interface Task {
  id: number;
  description: string;
  completed: boolean;
  completedAt: string | null;
  dueDate: string | null;
  priority: string;
  label: string | null;
  sortOrder: number;
  meetingId: number;
  executiveId: number;
  createdAt: string;
}

export interface Setting {
  key: string;
  value: string;
}

// ─── Table name constants ─────────────────────────────────────────────────────

const T = {
  meetings:      "Meetings",
  topicGuides:   "TopicGuides",
  announcements: "ClassroomAnnouncements",
  instagram:     "InstagramPosts",
  executives:    "Executives",
  attendances:   "MeetingAttendances",
  tasks:         "Tasks",
  settings:      "Settings",
} as const;

// ─── Core HTTP caller ─────────────────────────────────────────────────────────

async function callScript<T>(body: object): Promise<T> {
  const url = process.env.APPS_SCRIPT_URL;
  if (!url) throw new Error("APPS_SCRIPT_URL is not configured");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Apps Script returned HTTP ${res.status}`);
  const json = await res.json();
  if ((json as { ok: boolean }).ok === false) {
    throw new Error((json as { error?: string }).error ?? "Apps Script error");
  }
  return json as T;
}

// ─── Generic CRUD primitives ──────────────────────────────────────────────────

export async function dbFind<T>(
  table: string,
  where?: Where,
  orderBy?: OrderBy[],
  limit?: number,
): Promise<T[]> {
  const r = await callScript<{ ok: true; data: T[] }>({
    action: "db", operation: "find", table, where, orderBy, limit,
  });
  return r.data;
}

export async function dbFindFirst<T>(
  table: string,
  where?: Where,
  orderBy?: OrderBy[],
): Promise<T | null> {
  const r = await callScript<{ ok: true; data: T | null }>({
    action: "db", operation: "findOne", table, where, orderBy,
  });
  return r.data;
}

export async function dbCreate<T>(
  table: string,
  data: Record<string, unknown>,
): Promise<T> {
  const r = await callScript<{ ok: true; data: T }>({
    action: "db", operation: "create", table, data,
  });
  return r.data;
}

export async function dbUpdate<T>(
  table: string,
  where: Where,
  data: Record<string, unknown>,
): Promise<T | null> {
  const r = await callScript<{ ok: true; data: T | null }>({
    action: "db", operation: "update", table, where, data,
  });
  return r.data;
}

export async function dbDelete(table: string, where: Where): Promise<number> {
  const r = await callScript<{ ok: true; count: number }>({
    action: "db", operation: "delete", table, where,
  });
  return r.count;
}

export async function dbUpsert<T>(
  table: string,
  where: Where,
  create: Record<string, unknown>,
  update: Record<string, unknown>,
): Promise<T> {
  const r = await callScript<{ ok: true; data: T }>({
    action: "db", operation: "upsert", table, where, create, update,
  });
  return r.data;
}

// ─── File operations (Google Drive) ──────────────────────────────────────────

export async function uploadFile(
  filename: string,
  mimeType: string,
  base64: string,
): Promise<{ fileId: string; fileUrl: string }> {
  const r = await callScript<{ ok: true; fileId: string; fileUrl: string }>({
    action: "fileUpload", filename, mimeType, base64,
  });
  return { fileId: r.fileId, fileUrl: r.fileUrl };
}

export async function deleteFile(fileId: string): Promise<void> {
  await callScript({ action: "fileDelete", fileId });
}

// ─── Typed model helpers ──────────────────────────────────────────────────────

export const db = {
  meeting: {
    findMany:  (where?: Where, orderBy?: OrderBy[]) =>
      dbFind<Meeting>(T.meetings, where, orderBy ?? [{ field: "date", dir: "asc" }]),
    findFirst: (where?: Where, orderBy?: OrderBy[]) =>
      dbFindFirst<Meeting>(T.meetings, where, orderBy),
    findUnique: (id: number) =>
      dbFindFirst<Meeting>(T.meetings, { id }),
    create: (data: Omit<Partial<Meeting>, "id" | "createdAt">) =>
      dbCreate<Meeting>(T.meetings, data as Record<string, unknown>),
    update: (id: number, data: Partial<Meeting>) =>
      dbUpdate<Meeting>(T.meetings, { id }, data as Record<string, unknown>),
    delete: (id: number) =>
      dbDelete(T.meetings, { id }),
    upsert: (where: Where, create: Partial<Meeting>, update: Partial<Meeting>) =>
      dbUpsert<Meeting>(T.meetings, where,
        create as Record<string, unknown>,
        update as Record<string, unknown>),
  },

  topicGuide: {
    findUnique: (where: Where) =>
      dbFindFirst<TopicGuide>(T.topicGuides, where),
    upsert: (where: Where, create: Partial<TopicGuide>, update: Partial<TopicGuide>) =>
      dbUpsert<TopicGuide>(T.topicGuides, where,
        create as Record<string, unknown>,
        update as Record<string, unknown>),
    delete: (where: Where) =>
      dbDelete(T.topicGuides, where),
  },

  classroomAnnouncement: {
    findUnique: (where: Where) =>
      dbFindFirst<ClassroomAnnouncement>(T.announcements, where),
    findMany: (where?: Where, orderBy?: OrderBy[]) =>
      dbFind<ClassroomAnnouncement>(T.announcements, where, orderBy),
    upsert: (where: Where, create: Partial<ClassroomAnnouncement>, update: Partial<ClassroomAnnouncement>) =>
      dbUpsert<ClassroomAnnouncement>(T.announcements, where,
        create as Record<string, unknown>,
        update as Record<string, unknown>),
    update: (where: Where, data: Partial<ClassroomAnnouncement>) =>
      dbUpdate<ClassroomAnnouncement>(T.announcements, where, data as Record<string, unknown>),
    delete: (where: Where) =>
      dbDelete(T.announcements, where),
  },

  instagramPost: {
    findMany: (orderBy?: OrderBy[]) =>
      dbFind<InstagramPost>(T.instagram, undefined,
        orderBy ?? [{ field: "status", dir: "asc" }, { field: "createdAt", dir: "desc" }]),
    findUnique: (id: number) =>
      dbFindFirst<InstagramPost>(T.instagram, { id }),
    create: (data: Omit<Partial<InstagramPost>, "id" | "createdAt">) =>
      dbCreate<InstagramPost>(T.instagram, data as Record<string, unknown>),
    update: (id: number, data: Partial<InstagramPost>) =>
      dbUpdate<InstagramPost>(T.instagram, { id }, data as Record<string, unknown>),
    delete: (id: number) =>
      dbDelete(T.instagram, { id }),
  },

  executive: {
    findMany: (where?: Where, orderBy?: OrderBy[]) =>
      dbFind<Executive>(T.executives, where,
        orderBy ?? [
          { field: "active",    dir: "desc" },
          { field: "sortOrder", dir: "asc"  },
          { field: "name",      dir: "asc"  },
        ]),
    findFirst: (where?: Where, orderBy?: OrderBy[]) =>
      dbFindFirst<Executive>(T.executives, where, orderBy),
    findUnique: (id: number) =>
      dbFindFirst<Executive>(T.executives, { id }),
    create: (data: Omit<Partial<Executive>, "id" | "createdAt">) =>
      dbCreate<Executive>(T.executives, data as Record<string, unknown>),
    update: (id: number, data: Partial<Executive>) =>
      dbUpdate<Executive>(T.executives, { id }, data as Record<string, unknown>),
    delete: (id: number) =>
      dbDelete(T.executives, { id }),
  },

  meetingAttendance: {
    findMany: (where: Where) =>
      dbFind<MeetingAttendance>(T.attendances, where),
    upsert: (where: Where, create: Partial<MeetingAttendance>, update: Partial<MeetingAttendance>) =>
      dbUpsert<MeetingAttendance>(T.attendances, where,
        create as Record<string, unknown>,
        update as Record<string, unknown>),
    delete: (where: Where) =>
      dbDelete(T.attendances, where),
  },

  task: {
    findMany: (where?: Where, orderBy?: OrderBy[]) =>
      dbFind<Task>(T.tasks, where, orderBy),
    findFirst: (where?: Where, orderBy?: OrderBy[]) =>
      dbFindFirst<Task>(T.tasks, where, orderBy),
    findUnique: (id: number) =>
      dbFindFirst<Task>(T.tasks, { id }),
    create: (data: Omit<Partial<Task>, "id" | "createdAt">) =>
      dbCreate<Task>(T.tasks, data as Record<string, unknown>),
    update: (id: number, data: Partial<Task>) =>
      dbUpdate<Task>(T.tasks, { id }, data as Record<string, unknown>),
    delete: (id: number) =>
      dbDelete(T.tasks, { id }),
    deleteMany: (where: Where) =>
      dbDelete(T.tasks, where),
  },

  setting: {
    findUnique: (key: string) =>
      dbFindFirst<Setting>(T.settings, { key }),
    findMany: (keys: string[]) =>
      dbFind<Setting>(T.settings, { key: { in: keys } }),
    upsert: (key: string, value: string) =>
      dbUpsert<Setting>(T.settings, { key }, { key, value }, { value }),
  },
};
