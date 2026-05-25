#!/usr/bin/env node
/**
 * Provisions everything the MUN Dashboard needs inside an Appwrite project:
 *   - The database
 *   - All 8 collections, with their string/datetime/boolean/integer attributes
 *   - Required indexes (unique constraints, sort indexes, FK lookups)
 *   - Two Storage buckets (topic_guides, instagram_posts)
 *
 * Idempotent: re-running skips items that already exist (HTTP 409). Run after
 * editing schema constants to push new fields.
 *
 * Usage:
 *   1. Set APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY in .env.local
 *      The API key needs: databases.read/write, collections.read/write,
 *      attributes.read/write, indexes.read/write, buckets.read/write,
 *      files.read/write.
 *   2. node scripts/setup-appwrite.mjs
 */
import { Client, Databases, Storage, Permission, Role, DatabasesIndexType } from "node-appwrite";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Tiny .env / .env.local loader — keeps zero runtime deps.
(function loadEnv() {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const file of [".env.local", ".env"]) {
    try {
      const raw = readFileSync(join(here, "..", file), "utf8");
      for (const line of raw.split("\n")) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (!m) continue;
        const [, k, vRaw] = m;
        if (process.env[k]) continue;
        const v = vRaw.replace(/^['"]|['"]$/g, "");
        process.env[k] = v;
      }
    } catch { /* file optional */ }
  }
})();

const ENDPOINT   = process.env.APPWRITE_ENDPOINT  || "https://cloud.appwrite.io/v1";
const PROJECT_ID = process.env.APPWRITE_PROJECT_ID;
const API_KEY    = process.env.APPWRITE_API_KEY;
const DB_ID      = process.env.APPWRITE_DATABASE_ID || "mun_dashboard";
const BUCKET_TG  = process.env.APPWRITE_BUCKET_TOPIC_GUIDES    || "topic_guides";
const BUCKET_IG  = process.env.APPWRITE_BUCKET_INSTAGRAM_POSTS || "instagram_posts";

if (!PROJECT_ID || !API_KEY) {
  console.error("Missing APPWRITE_PROJECT_ID or APPWRITE_API_KEY. Set them in .env.local first.");
  process.exit(1);
}

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
const databases = new Databases(client);
const storage   = new Storage(client);

// ─── helpers ───────────────────────────────────────────────────────────────

const log = (...a) => console.log("  ·", ...a);

function isAlreadyExists(err) {
  return err && (err.code === 409 || /already exists/i.test(err.message || ""));
}

async function step(label, fn) {
  try {
    await fn();
    log(`✓ ${label}`);
  } catch (err) {
    if (isAlreadyExists(err)) { log(`= ${label} (exists)`); return; }
    console.error(`✗ ${label}: ${err.message || err}`);
    throw err;
  }
}

// Appwrite attribute creators don't block until the attribute is "available".
// Indexes need attributes to be ready, so we poll after each batch.
async function waitForAttributes(collectionId, keys) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const list = await databases.listAttributes(DB_ID, collectionId);
    const byKey = new Map(list.attributes.map((a) => [a.key, a.status]));
    const allReady = keys.every((k) => byKey.get(k) === "available");
    if (allReady) return;
    await new Promise((r) => setTimeout(r, 750));
  }
  throw new Error(`Timed out waiting for attributes on ${collectionId}: ${keys.join(", ")}`);
}

// ─── attribute helpers (each is a thin wrapper that swallows 409) ──────────

async function str(coll, key, size, required = false, def = null, array = false) {
  await step(`${coll}.${key} (string)`, () =>
    databases.createStringAttribute(DB_ID, coll, key, size, required, def, array));
}
async function updateStr(coll, key, required, def, size) {
  try {
    await databases.updateStringAttribute(DB_ID, coll, key, required, def, size);
    log(`~ ${coll}.${key} (string update)`);
  } catch (err) {
    if (err && (err.code === 404 || err.code === 409)) return;
    throw err;
  }
}
async function bool(coll, key, required = false, def = null) {
  await step(`${coll}.${key} (boolean)`, () =>
    databases.createBooleanAttribute(DB_ID, coll, key, required, def));
}
async function int(coll, key, required = false, def = null, min = null, max = null) {
  await step(`${coll}.${key} (integer)`, () =>
    databases.createIntegerAttribute(DB_ID, coll, key, required, min, max, def));
}
async function dt(coll, key, required = false, def = null) {
  await step(`${coll}.${key} (datetime)`, () =>
    databases.createDatetimeAttribute(DB_ID, coll, key, required, def));
}
async function index(coll, key, type, attributes, orders = null) {
  await step(`${coll} index ${key}`, () =>
    databases.createIndex(DB_ID, coll, key, type, attributes, orders ?? attributes.map(() => "ASC")));
}

// Server-only access for DB rows. Public reads happen via the Next.js API
// routes, not directly from Appwrite. Empty ACL means API key only.
const COLLECTION_PERMS = [];

// ─── 1. Database ───────────────────────────────────────────────────────────
async function setupDatabase() {
  console.log("\n[1/4] Database");
  await step(`database ${DB_ID}`, () => databases.create(DB_ID, "MUN Dashboard"));
}

// ─── 2. Collections + attributes ───────────────────────────────────────────
async function setupCollections() {
  console.log("\n[2/4] Collections + attributes");

  // Meeting ───────────────────────────────────────────────
  await step("collection meetings", () =>
    databases.createCollection(DB_ID, "meetings", "Meetings", COLLECTION_PERMS));

  await dt   ("meetings", "date",                true);
  await str  ("meetings", "title",               200, false, "Weekly MUN Meeting");
  await str  ("meetings", "location",            200, false, "Room 137");
  await str  ("meetings", "type",                32,  false, "regular");
  await str  ("meetings", "agenda",              2_000);
  // If agenda was created earlier with a larger size, shrink it to fit limits.
  await updateStr("meetings", "agenda", false, null, 2_000);
  await str  ("meetings", "notes",               2_000);
  await str  ("meetings", "responsibleEmail",    320);
  await dt   ("meetings", "reminderSentAt");
  await dt   ("meetings", "archivedAt");
  await str  ("meetings", "minutesDocId",        200);
  await str  ("meetings", "minutesDocUrl",       2_000);
  await dt   ("meetings", "minutesDocCreatedAt");
  await dt   ("meetings", "createdAt",           true);

  // TopicGuide ────────────────────────────────────────────
  await step("collection topic_guides", () =>
    databases.createCollection(DB_ID, "topic_guides", "Topic Guides", COLLECTION_PERMS));

  await str  ("topic_guides", "filename",   400, true);
  await str  ("topic_guides", "mimeType",   100, false, "application/pdf");
  await str  ("topic_guides", "bucketFileId", 100, true);
  await str  ("topic_guides", "meetingId",  64,  true);
  await dt   ("topic_guides", "uploadedAt", true);

  // ClassroomAnnouncement ─────────────────────────────────
  await step("collection classroom_announcements", () =>
    databases.createCollection(DB_ID, "classroom_announcements", "Classroom Announcements", COLLECTION_PERMS));

  await str  ("classroom_announcements", "body",          10_000, true);
  await dt   ("classroom_announcements", "scheduledFor");
  await str  ("classroom_announcements", "status",        32, false, "draft");
  await dt   ("classroom_announcements", "sentAt");
  await dt   ("classroom_announcements", "discordSentAt");
  await str  ("classroom_announcements", "meetingId",     64, true);
  await dt   ("classroom_announcements", "createdAt",     true);

  // InstagramPost ─────────────────────────────────────────
  await step("collection instagram_posts", () =>
    databases.createCollection(DB_ID, "instagram_posts", "Instagram Posts", COLLECTION_PERMS));

  await str  ("instagram_posts", "caption",       2_500, true);
  await str  ("instagram_posts", "imagePath",     500);
  await str  ("instagram_posts", "bucketFileId",  100);
  await str  ("instagram_posts", "imageMimeType", 100);
  await str  ("instagram_posts", "status",        32, false, "draft");
  await dt   ("instagram_posts", "postedAt");
  await dt   ("instagram_posts", "createdAt",     true);

  // Executive ─────────────────────────────────────────────
  await step("collection executives", () =>
    databases.createCollection(DB_ID, "executives", "Executives", COLLECTION_PERMS));

  await str  ("executives", "name",      200, true);
  await str  ("executives", "role",      200, false, "");
  await str  ("executives", "email",     320);
  await bool ("executives", "active",    false, true);
  await int  ("executives", "sortOrder", false, 0);
  await dt   ("executives", "createdAt", true);

  // MeetingAttendance ─────────────────────────────────────
  await step("collection meeting_attendances", () =>
    databases.createCollection(DB_ID, "meeting_attendances", "Meeting Attendances", COLLECTION_PERMS));

  await bool ("meeting_attendances", "present",     false, false);
  await str  ("meeting_attendances", "meetingId",   64, true);
  await str  ("meeting_attendances", "executiveId", 64, true);

  // Task ──────────────────────────────────────────────────
  await step("collection tasks", () =>
    databases.createCollection(DB_ID, "tasks", "Tasks", COLLECTION_PERMS));

  await str  ("tasks", "description", 2_000, true);
  await bool ("tasks", "completed",   false, false);
  await dt   ("tasks", "completedAt");
  await dt   ("tasks", "dueDate");
  await str  ("tasks", "priority",    32, false, "medium");
  await str  ("tasks", "label",       100);
  await int  ("tasks", "sortOrder",   false, 0);
  await str  ("tasks", "meetingId",   64, true);
  await str  ("tasks", "executiveId", 64, true);
  await dt   ("tasks", "createdAt",   true);

  // Setting (key-value, key is the document id) ───────────
  await step("collection settings", () =>
    databases.createCollection(DB_ID, "settings", "Settings", COLLECTION_PERMS));

  await str  ("settings", "value", 2_000, false, "");
}

// ─── 3. Indexes (created after attributes are ready) ───────────────────────
async function setupIndexes() {
  console.log("\n[3/4] Indexes");

  await waitForAttributes("meetings", ["date", "type", "archivedAt"]);
  await index("meetings", "date_unique", DatabasesIndexType.Unique, ["date"]);
  await index("meetings", "date_asc",    DatabasesIndexType.Key,    ["date"]);
  await index("meetings", "type",        DatabasesIndexType.Key,    ["type"]);
  await index("meetings", "archivedAt",  DatabasesIndexType.Key,    ["archivedAt"]);

  await waitForAttributes("topic_guides", ["meetingId"]);
  await index("topic_guides", "meetingId_unique", DatabasesIndexType.Unique, ["meetingId"]);

  await waitForAttributes("classroom_announcements", ["meetingId", "status", "scheduledFor"]);
  await index("classroom_announcements", "meetingId_unique", DatabasesIndexType.Unique, ["meetingId"]);
  await index("classroom_announcements", "status",           DatabasesIndexType.Key,    ["status"]);
  await index("classroom_announcements", "scheduledFor",     DatabasesIndexType.Key,    ["scheduledFor"]);

  await waitForAttributes("instagram_posts", ["status", "createdAt"]);
  await index("instagram_posts", "status_createdAt", DatabasesIndexType.Key, ["status", "createdAt"], ["ASC", "DESC"]);

  await waitForAttributes("executives", ["active", "sortOrder", "name"]);
  await index("executives", "active_sort_name", DatabasesIndexType.Key, ["active", "sortOrder", "name"], ["DESC", "ASC", "ASC"]);

  await waitForAttributes("meeting_attendances", ["meetingId", "executiveId"]);
  // Appwrite has no compound-unique on two strings via a single index call?
  // It does — `Unique` over multiple keys is supported.
  await index("meeting_attendances", "meeting_exec_unique", DatabasesIndexType.Unique, ["meetingId", "executiveId"]);
  await index("meeting_attendances", "meetingId",          DatabasesIndexType.Key,    ["meetingId"]);
  await index("meeting_attendances", "executiveId",        DatabasesIndexType.Key,    ["executiveId"]);

  await waitForAttributes("tasks", ["meetingId", "executiveId", "completed", "dueDate", "sortOrder"]);
  await index("tasks", "meetingId",   DatabasesIndexType.Key, ["meetingId"]);
  await index("tasks", "executiveId", DatabasesIndexType.Key, ["executiveId"]);
  await index("tasks", "completed",   DatabasesIndexType.Key, ["completed"]);
  await index("tasks", "dueDate",     DatabasesIndexType.Key, ["dueDate"]);
  await index("tasks", "sortOrder",   DatabasesIndexType.Key, ["sortOrder"]);
}

// ─── 4. Storage buckets ────────────────────────────────────────────────────
async function setupBuckets() {
  console.log("\n[4/4] Storage buckets");

  // "any" read so external services (Meta's Graph API, Google Apps Script)
  // can fetch the file directly via the bucket URL. Writes still require
  // the API key.
  const perms = [Permission.read(Role.any())];

  await step(`bucket ${BUCKET_TG}`, () => storage.createBucket(
    BUCKET_TG, "Topic Guides", perms,
    /* fileSecurity */ false,
    /* enabled     */ true,
    /* maxFileSize */ 8 * 1024 * 1024,
    /* allowedFileExt */ ["pdf"],
    /* compression */ undefined,
    /* encryption  */ true,
    /* antivirus   */ true,
  ));

  await step(`bucket ${BUCKET_IG}`, () => storage.createBucket(
    BUCKET_IG, "Instagram Posts", perms,
    false, true, 8 * 1024 * 1024,
    ["jpg", "jpeg", "png", "webp"],
    undefined, true, true,
  ));
}

(async () => {
  console.log(`Setting up Appwrite at ${ENDPOINT}\n  project: ${PROJECT_ID}\n  database: ${DB_ID}`);
  await setupDatabase();
  await setupCollections();
  await setupIndexes();
  await setupBuckets();
  console.log("\nDone. Add the env vars listed in .env.example to .env.local and you're ready to go.");
})().catch((err) => {
  console.error("\nSetup failed:", err);
  process.exit(1);
});
