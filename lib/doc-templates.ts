/**
 * Editable Google Docs templates for topic guides and meeting minutes.
 *
 * Both used to be hardcoded inside appscript/ClassroomPoster.gs, so changing a
 * heading meant pasting the script into Apps Script and cutting a new
 * deployment. They now live here, are overridable from the Sec-Gen Panel, and
 * are stored as JSON in the settings collection.
 *
 * The two are rendered differently on purpose:
 *
 *   - Topic guides are create-only, so the whole document is built as HTML here
 *     and handed to Drive to convert. No DocumentApp, no `documents` scope.
 *   - Minutes are re-synced after creation (updateMinutesDoc rewrites the
 *     managed region and leaves typed notes alone), which HTML can't express.
 *     So the template *fields* travel to Apps Script and it renders them with
 *     DocumentApp as before.
 */

export interface TemplateSection {
  heading: string;
  /** Prompt bullets. An empty string renders as a blank bullet to type into. */
  prompts: string[];
}

export interface TopicGuideTemplate {
  /** Prefixes the Doc name, e.g. "Topic Guide — Arctic sovereignty". */
  titlePrefix: string;
  /** Render the topic's one-line framing as its own section. */
  includeQuestion: boolean;
  questionHeading: string;
  /** Render the topic's private notes into the Doc. */
  includeChairNotes: boolean;
  chairNotesHeading: string;
  sections: TemplateSection[];
}

export interface MinutesTemplate {
  /** Doc name pattern. Tokens: {date} (dd/MM/yyyy) and {title}. */
  titlePattern: string;
  includeAttendance: boolean;
  attendanceHeading: string;
  includeAgenda: boolean;
  agendaHeading: string;
  includeTasks: boolean;
  tasksHeading: string;
  /**
   * Heading that separates the auto-synced region above from the human-written
   * region below. Everything above it is rebuilt on every sync, so this string
   * must match what's actually in the Doc — it's sent along with each sync.
   */
  boundaryHeading: string;
  /** Italic hint printed under the boundary heading. */
  humanIntro: string;
  actionItemsHeading: string;
  actionItemColumns: string[];
  actionItemRows: number;
}

export interface DocTemplates {
  topicGuide: TopicGuideTemplate;
  minutes: MinutesTemplate;
}

/* ─── Defaults ───────────────────────────────────────────────────────────── */

export const DEFAULT_TOPIC_GUIDE_TEMPLATE: TopicGuideTemplate = {
  titlePrefix: "Topic Guide — ",
  includeQuestion: true,
  questionHeading: "The Question",
  includeChairNotes: true,
  chairNotesHeading: "Chair Notes",
  sections: [
    {
      heading: "Background",
      prompts: [
        "How did this issue arise? Give delegates the 5-minute version.",
        "Key dates and turning points.",
        "Which bodies or treaties already govern it?",
      ],
    },
    {
      heading: "Current Situation",
      prompts: [
        "What is the state of play right now?",
        "What has been tried, and why hasn't it settled the matter?",
      ],
    },
    { heading: "Key Questions for Debate", prompts: ["", "", ""] },
    {
      heading: "Bloc Positions",
      prompts: ["Bloc / country — position, motivation, red lines.", "", ""],
    },
    {
      heading: "Points to Research",
      prompts: [
        "Statistics or precedents worth having on hand.",
        "Likely counter-arguments to prepare for.",
      ],
    },
    { heading: "Sources", prompts: ["Link — one line on why it's useful.", ""] },
    { heading: "Glossary", prompts: ["Term — plain-English definition."] },
  ],
};

export const DEFAULT_MINUTES_TEMPLATE: MinutesTemplate = {
  titlePattern: "{date} — {title}",
  includeAttendance: true,
  attendanceHeading: "Attendance",
  includeAgenda: true,
  agendaHeading: "Agenda",
  includeTasks: true,
  tasksHeading: "Weekly Tasks",
  boundaryHeading: "Discussion Notes",
  humanIntro:
    "Type the meeting discussion here — this section is yours and is never overwritten by the dashboard.",
  actionItemsHeading: "Action Items",
  actionItemColumns: ["Owner", "Action item", "Due"],
  actionItemRows: 4,
};

export const DEFAULT_DOC_TEMPLATES: DocTemplates = {
  topicGuide: DEFAULT_TOPIC_GUIDE_TEMPLATE,
  minutes: DEFAULT_MINUTES_TEMPLATE,
};

/* ─── Limits ─────────────────────────────────────────────────────────────── */

export const TEMPLATE_LIMITS = {
  maxSections: 20,
  maxPromptsPerSection: 15,
  maxHeadingLength: 120,
  maxPromptLength: 400,
  maxActionItemColumns: 6,
  maxActionItemRows: 20,
  /** The settings.value attribute caps the serialized JSON. */
  maxSerializedLength: 7_500,
} as const;

/* ─── Validation / coercion ──────────────────────────────────────────────── */

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

function str(v: unknown, fallback: string, max: number): string {
  if (typeof v !== "string") return fallback;
  return v.slice(0, max);
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

/**
 * Coerces arbitrary parsed JSON into a valid template, filling gaps from the
 * defaults. Stored templates are read on every Doc creation, so a malformed
 * value must degrade to something usable rather than throw.
 */
export function coerceTopicGuideTemplate(raw: unknown): TopicGuideTemplate {
  const d = DEFAULT_TOPIC_GUIDE_TEMPLATE;
  if (typeof raw !== "object" || raw === null) return d;
  const o = raw as Record<string, unknown>;

  const sections = Array.isArray(o.sections)
    ? o.sections
        .slice(0, TEMPLATE_LIMITS.maxSections)
        .map((s) => coerceSection(s))
        .filter((s): s is TemplateSection => s !== null)
    : d.sections;

  return {
    titlePrefix: str(o.titlePrefix, d.titlePrefix, TEMPLATE_LIMITS.maxHeadingLength),
    includeQuestion: bool(o.includeQuestion, d.includeQuestion),
    questionHeading: str(o.questionHeading, d.questionHeading, TEMPLATE_LIMITS.maxHeadingLength),
    includeChairNotes: bool(o.includeChairNotes, d.includeChairNotes),
    chairNotesHeading: str(o.chairNotesHeading, d.chairNotesHeading, TEMPLATE_LIMITS.maxHeadingLength),
    // An empty section list would produce a blank guide; fall back instead.
    sections: sections.length > 0 ? sections : d.sections,
  };
}

function coerceSection(raw: unknown): TemplateSection | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const heading = str(o.heading, "", TEMPLATE_LIMITS.maxHeadingLength).trim();
  if (!heading) return null;
  const prompts = Array.isArray(o.prompts)
    ? o.prompts
        .slice(0, TEMPLATE_LIMITS.maxPromptsPerSection)
        .map((p) => str(p, "", TEMPLATE_LIMITS.maxPromptLength))
    : [];
  return { heading, prompts };
}

export function coerceMinutesTemplate(raw: unknown): MinutesTemplate {
  const d = DEFAULT_MINUTES_TEMPLATE;
  if (typeof raw !== "object" || raw === null) return d;
  const o = raw as Record<string, unknown>;

  const columns = Array.isArray(o.actionItemColumns)
    ? o.actionItemColumns
        .slice(0, TEMPLATE_LIMITS.maxActionItemColumns)
        .map((c) => str(c, "", TEMPLATE_LIMITS.maxHeadingLength))
        .filter((c) => c.trim().length > 0)
    : d.actionItemColumns;

  const rows =
    typeof o.actionItemRows === "number" && Number.isFinite(o.actionItemRows)
      ? Math.max(0, Math.min(Math.floor(o.actionItemRows), TEMPLATE_LIMITS.maxActionItemRows))
      : d.actionItemRows;

  return {
    titlePattern: str(o.titlePattern, d.titlePattern, TEMPLATE_LIMITS.maxHeadingLength),
    includeAttendance: bool(o.includeAttendance, d.includeAttendance),
    attendanceHeading: str(o.attendanceHeading, d.attendanceHeading, TEMPLATE_LIMITS.maxHeadingLength),
    includeAgenda: bool(o.includeAgenda, d.includeAgenda),
    agendaHeading: str(o.agendaHeading, d.agendaHeading, TEMPLATE_LIMITS.maxHeadingLength),
    includeTasks: bool(o.includeTasks, d.includeTasks),
    tasksHeading: str(o.tasksHeading, d.tasksHeading, TEMPLATE_LIMITS.maxHeadingLength),
    // A blank boundary would make every sync rebuild the whole Doc, wiping
    // typed notes — never allow it to be empty.
    boundaryHeading:
      str(o.boundaryHeading, d.boundaryHeading, TEMPLATE_LIMITS.maxHeadingLength).trim() ||
      d.boundaryHeading,
    humanIntro: str(o.humanIntro, d.humanIntro, TEMPLATE_LIMITS.maxPromptLength),
    actionItemsHeading: str(o.actionItemsHeading, d.actionItemsHeading, TEMPLATE_LIMITS.maxHeadingLength),
    actionItemColumns: columns.length > 0 ? columns : d.actionItemColumns,
    actionItemRows: rows,
  };
}

/** Rejects a payload that wouldn't fit the settings attribute. */
export function checkSerializedSize(value: unknown): ValidationResult<string> {
  const json = JSON.stringify(value);
  if (json.length > TEMPLATE_LIMITS.maxSerializedLength) {
    return {
      ok: false,
      error: `That template is too large (${json.length} characters, limit ${TEMPLATE_LIMITS.maxSerializedLength}). Remove a few prompts or sections.`,
    };
  }
  return { ok: true, value: json };
}

/* ─── Topic guide rendering ──────────────────────────────────────────────── */

// Same palette the minutes Docs use, so the two look related.
const ACCENT = "#1e3a8a";
const MUTED = "#6b7280";

export interface TopicGuideContent {
  title: string;
  description?: string | null;
  category?: string | null;
  difficulty?: string | null;
  notes?: string | null;
}

export function topicGuideDocName(template: TopicGuideTemplate, title: string): string {
  return `${template.titlePrefix}${title}`.slice(0, 240);
}

/**
 * Renders the guide as HTML for Drive to convert into a Doc. Drive's converter
 * honours headings, lists, italics and inline colour, which covers everything
 * the old DocumentApp version styled by hand.
 */
export function renderTopicGuideHtml(
  template: TopicGuideTemplate,
  topic: TopicGuideContent,
  now: Date = new Date(),
): string {
  const out: string[] = ['<meta charset="utf-8">'];

  out.push(`<h1 style="color:${ACCENT}">Topic Guide</h1>`);
  out.push(`<h2 style="color:${MUTED};font-weight:normal">${esc(topic.title)}</h2>`);

  const meta: string[] = [];
  if (topic.category) meta.push(esc(topic.category));
  if (topic.difficulty) meta.push(`${esc(titleCase(topic.difficulty))} level`);
  meta.push(`Created ${formatDayMonthYear(now)}`);
  out.push(`<p style="color:${MUTED};font-size:10pt">${meta.join(" &nbsp;·&nbsp; ")}</p>`);
  out.push("<hr>");

  const description = (topic.description || "").trim();
  if (template.includeQuestion && description) {
    out.push(`<h2 style="color:${ACCENT}">${esc(template.questionHeading)}</h2>`);
    out.push(`<p>${esc(description)}</p>`);
  }

  const notes = (topic.notes || "").trim();
  if (template.includeChairNotes && notes) {
    out.push(`<h2 style="color:${ACCENT}">${esc(template.chairNotesHeading)}</h2>`);
    out.push(`<p style="color:${MUTED}"><i>${esc(notes)}</i></p>`);
  }

  for (const section of template.sections) {
    out.push(`<h2 style="color:${ACCENT}">${esc(section.heading)}</h2>`);
    out.push("<ul>");
    if (section.prompts.length === 0) {
      out.push("<li></li>");
    } else {
      for (const prompt of section.prompts) {
        // Prompts are grey italics; blank bullets stay plain so typed-over text
        // doesn't inherit the hint styling.
        out.push(
          prompt.trim()
            ? `<li style="color:${MUTED}"><i>${esc(prompt)}</i></li>`
            : "<li></li>",
        );
      }
    }
    out.push("</ul>");
  }

  return out.join("\n");
}

/** Fills {date} / {title} in the minutes Doc name pattern. */
export function minutesDocName(
  template: MinutesTemplate,
  meeting: { title: string; date: Date },
): string {
  return template.titlePattern
    .replace(/\{date\}/g, formatDayMonthYear(meeting.date))
    .replace(/\{title\}/g, meeting.title)
    .slice(0, 240);
}

/* ─── helpers ────────────────────────────────────────────────────────────── */

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDayMonthYear(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}
