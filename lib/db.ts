/**
 * Prisma-shaped facade over Appwrite Databases.
 *
 * Every route in this project was written against `prisma.<model>.<verb>(...)`.
 * Rather than rewrite ~25 files we keep that surface and translate it to
 * Appwrite under the hood. This is NOT a general-purpose Prisma clone — it
 * supports exactly the patterns this codebase uses:
 *
 *   - findMany / findUnique / findFirst / count / create / update / delete
 *     / upsert / deleteMany
 *   - where: equality, { gt, gte, lt, lte }, { not: null }, { in }, OR,
 *     compound unique (e.g. meetingId_executiveId)
 *   - orderBy: { field: "asc" | "desc" } or arrays of same
 *   - include: relation: true | { select } | { where, orderBy, include }
 *   - _count: { select: { tasks: true } }
 *   - select: field projection
 *   - data: ISO/Date conversion both ways, "connect" relation syntax
 *   - cascade: deleting a Meeting/Executive removes child rows
 *
 * Date semantics: Prisma surfaces DateTime as JS Date; Appwrite stores them
 * as ISO strings. The facade accepts Date OR ISO string on input and ALWAYS
 * returns Date objects on the way out, so route code can keep calling
 * `.toISOString()` on result fields.
 */
import { databases, DB_ID, COLLECTIONS, ID, Query } from "@/lib/appwrite";
import type { Models } from "node-appwrite";

// ─── Types ────────────────────────────────────────────────────────────────

export interface Meeting {
  id: string;
  date: Date;
  title: string;
  location: string;
  type: string;
  agenda: string | null;
  notes: string | null;
  responsibleEmail: string | null;
  reminderSentAt: Date | null;
  archivedAt: Date | null;
  minutesDocId: string | null;
  minutesDocUrl: string | null;
  minutesDocCreatedAt: Date | null;
  createdAt: Date;
}

export interface TopicGuide {
  id: string;
  filename: string;
  path: string;           // synthesized: /api/topic-guide/file/<meetingId>
  mimeType: string;
  bucketFileId: string;
  meetingId: string;
  uploadedAt: Date;
}

export interface ClassroomAnnouncement {
  id: string;
  body: string;
  scheduledFor: Date | null;
  status: string;
  sentAt: Date | null;
  discordSentAt: Date | null;
  meetingId: string;
  createdAt: Date;
}

export interface InstagramPost {
  id: string;
  caption: string;
  imagePath: string | null;
  bucketFileId: string | null;
  imageMimeType: string | null;
  status: string;
  postedAt: Date | null;
  createdAt: Date;
}

export interface Executive {
  id: string;
  name: string;
  role: string;
  email: string | null;
  active: boolean;
  sortOrder: number;
  createdAt: Date;
}

export interface MeetingAttendance {
  id: string;
  present: boolean;
  meetingId: string;
  executiveId: string;
}

export interface Task {
  id: string;
  description: string;
  completed: boolean;
  completedAt: Date | null;
  dueDate: Date | null;
  priority: string;
  label: string | null;
  sortOrder: number;
  meetingId: string;
  executiveId: string;
  createdAt: Date;
}

export interface Setting {
  key: string;
  value: string;
}

type AnyDoc = Models.Document & Record<string, unknown>;

interface ModelMeta {
  collection: string;
  dateFields: string[];
  defaults: Record<string, unknown>;
}

const META = {
  meeting: {
    collection: COLLECTIONS.meeting,
    dateFields: ["date", "reminderSentAt", "archivedAt", "minutesDocCreatedAt", "createdAt"],
    defaults: { title: "Weekly MUN Meeting", location: "Room 137", type: "regular" },
  },
  topicGuide: {
    collection: COLLECTIONS.topicGuide,
    dateFields: ["uploadedAt"],
    defaults: { mimeType: "application/pdf" },
  },
  classroomAnnouncement: {
    collection: COLLECTIONS.classroomAnnouncement,
    dateFields: ["scheduledFor", "sentAt", "discordSentAt", "createdAt"],
    defaults: { status: "draft" },
  },
  instagramPost: {
    collection: COLLECTIONS.instagramPost,
    dateFields: ["postedAt", "createdAt"],
    defaults: { status: "draft" },
  },
  executive: {
    collection: COLLECTIONS.executive,
    dateFields: ["createdAt"],
    defaults: { role: "", active: true, sortOrder: 0 },
  },
  meetingAttendance: {
    collection: COLLECTIONS.meetingAttendance,
    dateFields: [],
    defaults: { present: false },
  },
  task: {
    collection: COLLECTIONS.task,
    dateFields: ["completedAt", "dueDate", "createdAt"],
    defaults: { completed: false, priority: "medium", sortOrder: 0 },
  },
  setting: {
    collection: COLLECTIONS.setting,
    dateFields: [],
    defaults: {},
  },
} as const satisfies Record<string, ModelMeta>;

type ModelKey = keyof typeof META;

// ─── Conversion helpers ────────────────────────────────────────────────────

function toIso(v: unknown): string | null | undefined {
  if (v === null) return null;
  if (v === undefined) return undefined;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return v;
  return undefined;
}

function fromIso(v: unknown): Date | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return v;
  if (typeof v === "string") {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function mapDoc<T>(meta: ModelMeta, doc: AnyDoc | null): T | null {
  if (!doc) return null;
  const out: Record<string, unknown> = { id: doc.$id };
  for (const [k, v] of Object.entries(doc)) {
    if (k.startsWith("$")) continue;
    out[k] = (meta.dateFields as readonly string[]).includes(k) ? fromIso(v) : v;
  }
  if (meta.collection === COLLECTIONS.topicGuide && typeof out.meetingId === "string") {
    out.path = `/api/topic-guide/file/${out.meetingId}`;
  }
  return out as T;
}

function prepareData(meta: ModelMeta, data: Record<string, unknown>, applyDefaults: boolean): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (applyDefaults) Object.assign(out, meta.defaults);

  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    // `meeting: { connect: { id } }` → meetingId
    if (v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date) && "connect" in (v as object)) {
      const connect = (v as { connect: { id: string } }).connect;
      out[`${k}Id`] = connect.id;
      continue;
    }
    out[k] = (meta.dateFields as readonly string[]).includes(k) ? toIso(v) : v;
  }
  return out;
}

// ─── Where → Appwrite Query[] ──────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Where = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OrderInput = any;

const COMPARATOR_KEYS = new Set(["gt", "gte", "lt", "lte", "not", "in"]);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date);
}

function valueForQuery(v: unknown, isDateField: boolean): string | number | boolean {
  if (v instanceof Date) return v.toISOString();
  if (isDateField && typeof v === "string") return v;
  return v as string | number | boolean;
}

interface PostFilter {
  type: "no-related";
  childCollection: string;
  parentIdField: string;
}

function buildWhere(meta: ModelMeta, where: Where | undefined): { queries: string[]; post: PostFilter[] } {
  const queries: string[] = [];
  const post: PostFilter[] = [];
  if (!where) return { queries, post };

  for (const [field, raw] of Object.entries(where)) {
    if (field === "OR" && Array.isArray(raw)) {
      const orParts: string[] = [];
      for (const sub of raw) orParts.push(...buildWhere(meta, sub as Where).queries);
      if (orParts.length) queries.push(Query.or(orParts));
      continue;
    }

    // Relational `null` (Meeting → no announcement / no topic guide)
    if (raw === null && field === "announcement") {
      post.push({ type: "no-related", childCollection: COLLECTIONS.classroomAnnouncement, parentIdField: "meetingId" });
      continue;
    }
    if (raw === null && field === "topicGuide") {
      post.push({ type: "no-related", childCollection: COLLECTIONS.topicGuide, parentIdField: "meetingId" });
      continue;
    }

    const isDate = (meta.dateFields as readonly string[]).includes(field);

    if (raw === null) { queries.push(Query.isNull(field)); continue; }

    if (!isPlainObject(raw)) {
      queries.push(Query.equal(field, valueForQuery(raw, isDate) as never));
      continue;
    }

    if ("not" in raw) {
      const nv = (raw as { not: unknown }).not;
      if (nv === null) queries.push(Query.isNotNull(field));
      else queries.push(Query.notEqual(field, valueForQuery(nv, isDate) as never));
      continue;
    }

    if ("in" in raw) {
      const arr = (raw as { in: (string | number)[] }).in;
      queries.push(Query.equal(field, arr as never));
      continue;
    }

    let anyRange = false;
    const r = raw as { gt?: unknown; gte?: unknown; lt?: unknown; lte?: unknown };
    if (r.gt  !== undefined) { queries.push(Query.greaterThan(field,      valueForQuery(r.gt , isDate) as never)); anyRange = true; }
    if (r.gte !== undefined) { queries.push(Query.greaterThanEqual(field, valueForQuery(r.gte, isDate) as never)); anyRange = true; }
    if (r.lt  !== undefined) { queries.push(Query.lessThan(field,         valueForQuery(r.lt , isDate) as never)); anyRange = true; }
    if (r.lte !== undefined) { queries.push(Query.lessThanEqual(field,    valueForQuery(r.lte, isDate) as never)); anyRange = true; }
    if (anyRange) continue;

    // Unknown nested shape — ignore quietly rather than crash.
    if (![...Object.keys(raw)].some((k) => COMPARATOR_KEYS.has(k))) continue;
  }

  return { queries, post };
}

function buildOrder(orderBy: OrderInput | undefined): string[] {
  if (!orderBy) return [];
  const arr = Array.isArray(orderBy) ? orderBy : [orderBy];
  const out: string[] = [];
  for (const entry of arr) {
    for (const [field, dir] of Object.entries(entry as Record<string, "asc" | "desc">)) {
      out.push(dir === "desc" ? Query.orderDesc(field) : Query.orderAsc(field));
    }
  }
  return out;
}

// ─── Pagination + post-filter helpers ──────────────────────────────────────

async function applyPostFilters(docs: AnyDoc[], post: PostFilter[]): Promise<AnyDoc[]> {
  let result = docs;
  for (const f of post) {
    if (f.type === "no-related") {
      const parentIds = result.map((d) => d.$id);
      if (parentIds.length === 0) return result;
      const children = await databases.listDocuments(DB_ID, f.childCollection, [
        Query.equal(f.parentIdField, parentIds as never),
        Query.limit(Math.min(parentIds.length * 4 + 50, 500)),
      ]);
      const hasChild = new Set(children.documents.map((c) => (c as AnyDoc)[f.parentIdField] as string));
      result = result.filter((d) => !hasChild.has(d.$id));
    }
  }
  return result;
}

async function listAll(collection: string, queries: string[]): Promise<AnyDoc[]> {
  // listDocuments caps at 100. Paginate with cursorAfter; sanity cap at 5k.
  const PAGE = 100, MAX = 5000;
  const out: AnyDoc[] = [];
  let cursor: string | null = null;
  while (out.length < MAX) {
    const pageQueries = [...queries, Query.limit(PAGE)];
    if (cursor) pageQueries.push(Query.cursorAfter(cursor));
    const res = await databases.listDocuments(DB_ID, collection, pageQueries);
    const docs = res.documents as AnyDoc[];
    out.push(...docs);
    if (docs.length < PAGE) break;
    cursor = docs[docs.length - 1].$id;
  }
  return out;
}

// ─── Include / _count / select ─────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type IncludeSpec = Record<string, true | any> & { _count?: { select: { tasks?: true; attendance?: true } } };

interface QueryOptions {
  where?: Where;
  orderBy?: OrderInput;
  select?: Record<string, true>;
  include?: IncludeSpec;
  take?: number;
}

type RelKind = "hasMany" | "hasOne" | "belongsTo";
interface RelDef { kind: RelKind; targetMeta: ModelKey; field: string }

const RELATIONS: Record<string, Record<string, RelDef>> = {
  meeting: {
    topicGuide:   { kind: "hasOne",  targetMeta: "topicGuide",            field: "meetingId" },
    announcement: { kind: "hasOne",  targetMeta: "classroomAnnouncement", field: "meetingId" },
    tasks:        { kind: "hasMany", targetMeta: "task",                  field: "meetingId" },
    attendance:   { kind: "hasMany", targetMeta: "meetingAttendance",     field: "meetingId" },
  },
  task: {
    meeting:   { kind: "belongsTo", targetMeta: "meeting",   field: "meetingId" },
    executive: { kind: "belongsTo", targetMeta: "executive", field: "executiveId" },
  },
  executive: {
    tasks:      { kind: "hasMany", targetMeta: "task",              field: "executiveId" },
    attendance: { kind: "hasMany", targetMeta: "meetingAttendance", field: "executiveId" },
  },
  classroomAnnouncement: {
    meeting: { kind: "belongsTo", targetMeta: "meeting", field: "meetingId" },
  },
  topicGuide: {
    meeting: { kind: "belongsTo", targetMeta: "meeting", field: "meetingId" },
  },
  meetingAttendance: {
    meeting:   { kind: "belongsTo", targetMeta: "meeting",   field: "meetingId" },
    executive: { kind: "belongsTo", targetMeta: "executive", field: "executiveId" },
  },
};

function applySelect<T extends Record<string, unknown>>(row: T, select: Record<string, true> | undefined): T {
  if (!select) return row;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(select)) out[k] = row[k];
  if ("id" in row && !("id" in out)) out.id = row.id; // keep id for React keys
  return out as T;
}

async function expandIncludes(
  modelKey: string,
  rows: Array<Record<string, unknown>>,
  include: IncludeSpec | undefined,
): Promise<void> {
  if (!include || rows.length === 0) return;
  const rels = RELATIONS[modelKey] || {};
  const ids = rows.map((r) => r.id as string);

  for (const [name, spec] of Object.entries(include)) {
    if (name === "_count") continue;
    const rel = rels[name];
    if (!rel) continue;

    const childMeta = META[rel.targetMeta];
    const subSpec = (spec === true ? {} : spec) as { where?: Where; orderBy?: OrderInput; include?: IncludeSpec; select?: Record<string, true> };

    if (rel.kind === "hasMany" || rel.kind === "hasOne") {
      const queries = [Query.equal(rel.field, ids as never)];
      if (subSpec.where) queries.push(...buildWhere(childMeta, subSpec.where).queries);
      if (subSpec.orderBy) queries.push(...buildOrder(subSpec.orderBy));
      const children = await listAll(childMeta.collection, queries);

      const byParent = new Map<string, Array<Record<string, unknown>>>();
      for (const c of children) {
        const pid = c[rel.field] as string;
        const mapped = mapDoc<Record<string, unknown>>(childMeta, c)!;
        if (!byParent.has(pid)) byParent.set(pid, []);
        byParent.get(pid)!.push(mapped);
      }

      if (subSpec.include) {
        for (const list of byParent.values()) await expandIncludes(rel.targetMeta, list, subSpec.include);
      }

      for (const row of rows) {
        const list = byParent.get(row.id as string) ?? [];
        const projected = subSpec.select ? list.map((c) => applySelect(c, subSpec.select)) : list;
        if (rel.kind === "hasOne") row[name] = projected[0] ?? null;
        else                       row[name] = projected;
      }
    } else {
      const parentIds = Array.from(new Set(rows.map((r) => r[rel.field] as string).filter(Boolean)));
      if (parentIds.length === 0) {
        for (const row of rows) row[name] = null;
        continue;
      }
      const parents = await listAll(childMeta.collection, [Query.equal("$id", parentIds as never)]);
      const byId = new Map<string, Record<string, unknown>>();
      for (const p of parents) byId.set(p.$id, mapDoc<Record<string, unknown>>(childMeta, p)!);
      if (subSpec.include) await expandIncludes(rel.targetMeta, Array.from(byId.values()), subSpec.include);
      for (const row of rows) {
        const parent = byId.get(row[rel.field] as string);
        row[name] = parent ? (subSpec.select ? applySelect(parent, subSpec.select) : parent) : null;
      }
    }
  }

  if (include._count?.select) {
    const sel = include._count.select;
    for (const row of rows) row._count = {} as Record<string, number>;
    if (sel.tasks) {
      const counts = await Promise.all(
        ids.map((id) => databases.listDocuments(DB_ID, COLLECTIONS.task, [
          Query.equal("meetingId", id), Query.limit(1),
        ]).then((r) => r.total)),
      );
      rows.forEach((r, i) => { (r._count as Record<string, number>).tasks = counts[i]; });
    }
    if (sel.attendance) {
      const counts = await Promise.all(
        ids.map((id) => databases.listDocuments(DB_ID, COLLECTIONS.meetingAttendance, [
          Query.equal("meetingId", id), Query.limit(1),
        ]).then((r) => r.total)),
      );
      rows.forEach((r, i) => { (r._count as Record<string, number>).attendance = counts[i]; });
    }
  }
}

// ─── Compound unique key unwrap ────────────────────────────────────────────

function unwrapCompoundKey(where: Where | undefined): Where | undefined {
  if (!where) return where;
  const out: Where = {};
  for (const [k, v] of Object.entries(where)) {
    if (k.includes("_") && isPlainObject(v)) {
      const parts = k.split("_");
      if (parts.every((p) => p in (v as Record<string, unknown>))) {
        Object.assign(out, v);
        continue;
      }
    }
    out[k] = v;
  }
  return out;
}

// ─── Model factory ─────────────────────────────────────────────────────────

interface ModelOps<T extends { id: string }> {
  findMany(opts?: QueryOptions): Promise<T[]>;
  findFirst(opts?: QueryOptions): Promise<T | null>;
  findUnique(opts: { where: Where; include?: IncludeSpec; select?: Record<string, true> }): Promise<T | null>;
  count(opts?: { where?: Where }): Promise<number>;
  create(opts: { data: Record<string, unknown>; include?: IncludeSpec; select?: Record<string, true> }): Promise<T>;
  update(opts: { where: Where; data: Record<string, unknown>; select?: Record<string, true>; include?: IncludeSpec }): Promise<T>;
  delete(opts: { where: Where }): Promise<T>;
  deleteMany(opts?: { where?: Where }): Promise<{ count: number }>;
  upsert(opts: { where: Where; create: Record<string, unknown>; update: Record<string, unknown> }): Promise<T>;
}

const MODELS: Partial<Record<ModelKey, ModelOps<{ id: string }>>> = {};

function model<T extends { id: string }>(modelKey: ModelKey): ModelOps<T> {
  const meta = META[modelKey];

  const ops: ModelOps<T> = {
    async findMany(opts = {}): Promise<T[]> {
      const where = unwrapCompoundKey(opts.where);
      const { queries, post } = buildWhere(meta, where);
      queries.push(...buildOrder(opts.orderBy));
      let docs: AnyDoc[];
      if (opts.take && post.length === 0) {
        const res = await databases.listDocuments(DB_ID, meta.collection, [...queries, Query.limit(opts.take)]);
        docs = res.documents as AnyDoc[];
      } else {
        docs = await listAll(meta.collection, queries);
      }
      if (post.length) docs = await applyPostFilters(docs, post);
      if (opts.take && docs.length > opts.take) docs = docs.slice(0, opts.take);

      const mapped = docs.map((d) => mapDoc<Record<string, unknown>>(meta, d)!) as Array<Record<string, unknown>>;
      await expandIncludes(modelKey, mapped, opts.include);
      return mapped.map((r) => applySelect(r, opts.select)) as unknown as T[];
    },

    async findFirst(opts = {}): Promise<T | null> {
      const rows = await ops.findMany({ ...opts, take: 1 });
      return rows[0] ?? null;
    },

    async findUnique({ where, include, select }): Promise<T | null> {
      const unwrapped = unwrapCompoundKey(where)!;
      if ("id" in unwrapped && Object.keys(unwrapped).length === 1 && typeof unwrapped.id === "string") {
        try {
          const doc = await databases.getDocument(DB_ID, meta.collection, unwrapped.id);
          const row = mapDoc<Record<string, unknown>>(meta, doc as AnyDoc)!;
          if (include) await expandIncludes(modelKey, [row], include);
          return applySelect(row, select) as unknown as T;
        } catch (err) {
          if ((err as { code?: number }).code === 404) return null;
          throw err;
        }
      }
      return ops.findFirst({ where: unwrapped, include, select });
    },

    async count({ where } = {}): Promise<number> {
      const { queries, post } = buildWhere(meta, unwrapCompoundKey(where));
      if (post.length === 0) {
        const res = await databases.listDocuments(DB_ID, meta.collection, [...queries, Query.limit(1)]);
        return res.total;
      }
      const docs = await listAll(meta.collection, queries);
      return (await applyPostFilters(docs, post)).length;
    },

    async create({ data, include, select }): Promise<T> {
      const payload = prepareData(meta, data, true);
      if ((meta.dateFields as readonly string[]).includes("createdAt") && payload.createdAt === undefined) {
        payload.createdAt = new Date().toISOString();
      }
      const docId = (data as { id?: string }).id ?? ID.unique();
      delete (payload as { id?: unknown }).id;
      const doc = await databases.createDocument(DB_ID, meta.collection, docId, payload);
      const row = mapDoc<Record<string, unknown>>(meta, doc as AnyDoc)!;
      if (include) await expandIncludes(modelKey, [row], include);
      return applySelect(row, select) as unknown as T;
    },

    async update({ where, data, select, include }): Promise<T> {
      const target = await ops.findUnique({ where });
      if (!target) throw new Error(`${meta.collection}: no row matched update where-clause`);
      const payload = prepareData(meta, data, false);
      delete (payload as { id?: unknown }).id;
      const doc = await databases.updateDocument(DB_ID, meta.collection, target.id, payload);
      const row = mapDoc<Record<string, unknown>>(meta, doc as AnyDoc)!;
      if (include) await expandIncludes(modelKey, [row], include);
      return applySelect(row, select) as unknown as T;
    },

    async delete({ where }): Promise<T> {
      const target = await ops.findUnique({ where });
      if (!target) throw new Error(`${meta.collection}: no row matched delete where-clause`);
      await cascadeDeleteChildren(modelKey, target.id);
      await databases.deleteDocument(DB_ID, meta.collection, target.id);
      return target;
    },

    async deleteMany({ where } = {}): Promise<{ count: number }> {
      const rows = await ops.findMany({ where });
      for (const r of rows) {
        await cascadeDeleteChildren(modelKey, r.id);
        await databases.deleteDocument(DB_ID, meta.collection, r.id);
      }
      return { count: rows.length };
    },

    async upsert({ where, create, update }): Promise<T> {
      const existing = await ops.findUnique({ where });
      if (existing) return ops.update({ where: { id: existing.id }, data: update });
      // Bring `where` fields into the create payload so unique constraints
      // (date, meetingId) are satisfied even if not duplicated in `create`.
      const merged = { ...unwrapCompoundKey(where), ...create };
      return ops.create({ data: merged });
    },
  };

  return ops;
}

async function cascadeDeleteChildren(modelKey: ModelKey, rowId: string): Promise<void> {
  const rels = RELATIONS[modelKey] || {};
  for (const rel of Object.values(rels)) {
    if (rel.kind === "belongsTo") continue;
    const childMeta = META[rel.targetMeta];
    const children = await databases.listDocuments(DB_ID, childMeta.collection, [
      Query.equal(rel.field, rowId), Query.limit(500),
    ]);
    for (const c of children.documents) {
      if (RELATIONS[rel.targetMeta]) {
        // Recurse via the child's model so its own descendants cascade too.
        const childOps = MODELS[rel.targetMeta];
        if (childOps) await childOps.delete({ where: { id: c.$id } });
        else await databases.deleteDocument(DB_ID, childMeta.collection, c.$id);
      } else {
        await databases.deleteDocument(DB_ID, childMeta.collection, c.$id);
      }
    }
  }
}

// ─── Setting model: key-as-$id specialization ──────────────────────────────

const settingMeta = META.setting;

const settingModel = {
  async findUnique({ where }: { where: { key: string } }): Promise<Setting | null> {
    try {
      const doc = await databases.getDocument(DB_ID, settingMeta.collection, where.key);
      return { key: doc.$id, value: (doc as AnyDoc).value as string };
    } catch (err) {
      if ((err as { code?: number }).code === 404) return null;
      throw err;
    }
  },
  async findMany({ where }: { where?: { key?: { in?: string[] } } } = {}): Promise<Setting[]> {
    if (!where?.key?.in) {
      const res = await databases.listDocuments(DB_ID, settingMeta.collection, [Query.limit(100)]);
      return (res.documents as AnyDoc[]).map((d) => ({ key: d.$id, value: d.value as string }));
    }
    const results = await Promise.all(where.key.in.map((k) => settingModel.findUnique({ where: { key: k } })));
    return results.filter((r): r is Setting => r !== null);
  },
  async upsert({
    where, create, update,
  }: { where: { key: string }; create: { key: string; value: string }; update: { value: string } }): Promise<Setting> {
    try {
      const doc = await databases.updateDocument(DB_ID, settingMeta.collection, where.key, { value: update.value });
      return { key: doc.$id, value: (doc as AnyDoc).value as string };
    } catch (err) {
      if ((err as { code?: number }).code === 404) {
        const doc = await databases.createDocument(DB_ID, settingMeta.collection, create.key, { value: create.value });
        return { key: doc.$id, value: (doc as AnyDoc).value as string };
      }
      throw err;
    }
  },
};

// ─── Public API ────────────────────────────────────────────────────────────

MODELS.meeting               = model<Meeting>("meeting")                             as ModelOps<{ id: string }>;
MODELS.topicGuide            = model<TopicGuide>("topicGuide")                       as ModelOps<{ id: string }>;
MODELS.classroomAnnouncement = model<ClassroomAnnouncement>("classroomAnnouncement") as ModelOps<{ id: string }>;
MODELS.instagramPost         = model<InstagramPost>("instagramPost")                 as ModelOps<{ id: string }>;
MODELS.executive             = model<Executive>("executive")                         as ModelOps<{ id: string }>;
MODELS.meetingAttendance     = model<MeetingAttendance>("meetingAttendance")         as ModelOps<{ id: string }>;
MODELS.task                  = model<Task>("task")                                   as ModelOps<{ id: string }>;

export const prisma = {
  meeting:               MODELS.meeting               as unknown as ModelOps<Meeting>,
  topicGuide:            MODELS.topicGuide            as unknown as ModelOps<TopicGuide>,
  classroomAnnouncement: MODELS.classroomAnnouncement as unknown as ModelOps<ClassroomAnnouncement>,
  instagramPost:         MODELS.instagramPost         as unknown as ModelOps<InstagramPost>,
  executive:             MODELS.executive             as unknown as ModelOps<Executive>,
  meetingAttendance:     MODELS.meetingAttendance     as unknown as ModelOps<MeetingAttendance>,
  task:                  MODELS.task                  as unknown as ModelOps<Task>,
  setting:               settingModel,
};
