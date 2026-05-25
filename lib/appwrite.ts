/**
 * Appwrite server-side SDK bootstrap.
 *
 * One Client + Databases + Storage pair, configured from env. Routes import
 * `databases`, `storage`, `DB_ID`, and the COLLECTIONS map; the higher-level
 * Prisma-shaped facade in `lib/db.ts` is the usual entry point for CRUD.
 */
import { Client, Databases, Storage, ID, Query, Permission, Role } from "node-appwrite";

const endpoint  = process.env.APPWRITE_ENDPOINT  || "https://cloud.appwrite.io/v1";
const projectId = process.env.APPWRITE_PROJECT_ID;
const apiKey    = process.env.APPWRITE_API_KEY;

if (!projectId) {
  // eslint-disable-next-line no-console
  console.warn("[appwrite] APPWRITE_PROJECT_ID is not set — Appwrite calls will fail.");
}

const client = new Client()
  .setEndpoint(endpoint)
  .setProject(projectId || "")
  .setKey(apiKey || "");

export const databases = new Databases(client);
export const storage   = new Storage(client);

export const DB_ID = process.env.APPWRITE_DATABASE_ID || "mun_dashboard";

// Logical → Appwrite collection IDs. Keep these short and stable.
export const COLLECTIONS = {
  meeting:               "meetings",
  topicGuide:            "topic_guides",
  classroomAnnouncement: "classroom_announcements",
  instagramPost:         "instagram_posts",
  executive:             "executives",
  meetingAttendance:     "meeting_attendances",
  task:                  "tasks",
  setting:               "settings",
} as const;

export const BUCKETS = {
  topicGuides:    process.env.APPWRITE_BUCKET_TOPIC_GUIDES    || "topic_guides",
  instagramPosts: process.env.APPWRITE_BUCKET_INSTAGRAM_POSTS || "instagram_posts",
} as const;

export { ID, Query, Permission, Role };
