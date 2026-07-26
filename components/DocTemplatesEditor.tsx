"use client";

/**
 * Edits the Google Docs templates for topic guides and meeting minutes.
 *
 * These used to be hardcoded in appscript/ClassroomPoster.gs, so a wording
 * change meant pasting the script into Apps Script and cutting a new
 * deployment. Saving here takes effect on the next document created.
 */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { api } from "@/lib/client-api";
import { useToast } from "@/components/Toast";
import {
  renderTopicGuideHtml,
  TEMPLATE_LIMITS,
  type DocTemplates,
  type MinutesTemplate,
  type TemplateSection,
  type TopicGuideTemplate,
} from "@/lib/doc-templates";

type Tab = "topicGuide" | "minutes";

const SAMPLE_TOPIC = {
  title: "Arctic sovereignty and the Northwest Passage",
  description: "Should transit rights through the Northwest Passage be internationalized?",
  category: "International Security",
  difficulty: "standard",
  notes: "Pairs well with a UNCLOS primer in the first session.",
};

export function DocTemplatesEditor({
  initial,
  defaults,
}: {
  initial: DocTemplates;
  defaults: DocTemplates;
}) {
  const router = useRouter();
  const toast = useToast();

  const [tab, setTab] = useState<Tab>("topicGuide");
  const [saved, setSaved] = useState<DocTemplates>(initial);
  const [topicGuide, setTopicGuide] = useState<TopicGuideTemplate>(initial.topicGuide);
  const [minutes, setMinutes] = useState<MinutesTemplate>(initial.minutes);
  const [busy, setBusy] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const guideDirty = useMemo(
    () => JSON.stringify(topicGuide) !== JSON.stringify(saved.topicGuide),
    [topicGuide, saved.topicGuide],
  );
  const minutesDirty = useMemo(
    () => JSON.stringify(minutes) !== JSON.stringify(saved.minutes),
    [minutes, saved.minutes],
  );
  const dirty = tab === "topicGuide" ? guideDirty : minutesDirty;

  const previewHtml = useMemo(
    () => (showPreview ? renderTopicGuideHtml(topicGuide, SAMPLE_TOPIC) : ""),
    [showPreview, topicGuide],
  );

  async function save() {
    setBusy(true);
    const body = tab === "topicGuide" ? { topicGuide } : { minutes };
    const res = await api<{ templates: DocTemplates }>("/api/settings/doc-templates", {
      method: "PATCH",
      body,
    });
    setBusy(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    // The server coerces what it stores, so adopt its version rather than ours.
    setSaved(res.data.templates);
    setTopicGuide(res.data.templates.topicGuide);
    setMinutes(res.data.templates.minutes);
    toast.success(
      tab === "topicGuide" ? "Topic guide template saved." : "Minutes template saved.",
    );
    router.refresh();
  }

  async function reset() {
    const label = tab === "topicGuide" ? "topic guide" : "meeting minutes";
    if (!confirm(`Reset the ${label} template to the default? Your changes are discarded.`)) {
      return;
    }
    setBusy(true);
    const res = await api<{ templates: DocTemplates }>("/api/settings/doc-templates", {
      method: "PATCH",
      body: { reset: tab },
    });
    setBusy(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setSaved(res.data.templates);
    setTopicGuide(res.data.templates.topicGuide);
    setMinutes(res.data.templates.minutes);
    toast.success(`Reset the ${label} template to the default.`);
    router.refresh();
  }

  function revert() {
    if (tab === "topicGuide") setTopicGuide(saved.topicGuide);
    else setMinutes(saved.minutes);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="font-semibold text-gray-900">Document templates</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Headings and prompts for generated Google Docs. Changes apply to the next document
            created — existing Docs are untouched.
          </p>
        </div>
        <div className="inline-flex bg-gray-100 rounded-lg p-0.5 text-sm shrink-0">
          {(
            [
              ["topicGuide", "Topic guide"],
              ["minutes", "Meeting minutes"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-3 py-1 rounded-md transition-colors ${
                tab === key ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {label}
              {(key === "topicGuide" ? guideDirty : minutesDirty) && (
                <span className="ml-1 text-amber-600" title="Unsaved changes">
                  •
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {tab === "topicGuide" ? (
        <TopicGuideFields template={topicGuide} onChange={setTopicGuide} />
      ) : (
        <MinutesFields template={minutes} onChange={setMinutes} />
      )}

      {/* Preview — only meaningful for the guide, which we render ourselves.
          Minutes are rendered by Apps Script from live meeting data. */}
      {tab === "topicGuide" && (
        <div className="mt-4">
          <button
            onClick={() => setShowPreview((v) => !v)}
            className="text-xs font-medium text-primary-700 hover:underline"
          >
            {showPreview ? "Hide preview" : "Preview with a sample topic"}
          </button>
          {showPreview && (
            <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-4 max-h-80 overflow-y-auto">
              {/* Our own renderer's output; all template text is escaped by it. */}
              <div
                className="doc-preview text-sm"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>
          )}
        </div>
      )}

      <div className="mt-5 pt-4 border-t border-gray-100 flex flex-wrap items-center gap-2">
        <button
          onClick={save}
          disabled={busy || !dirty}
          className="px-3 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save template"}
        </button>
        {dirty && (
          <button
            onClick={revert}
            disabled={busy}
            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
          >
            Discard changes
          </button>
        )}
        <button
          onClick={reset}
          disabled={busy}
          className="ml-auto text-xs text-gray-400 hover:text-red-600 disabled:opacity-50"
        >
          Reset to default
        </button>
      </div>
    </div>
  );
}

/* ─── Topic guide ────────────────────────────────────────────────────────── */

function TopicGuideFields({
  template,
  onChange,
}: {
  template: TopicGuideTemplate;
  onChange: (t: TopicGuideTemplate) => void;
}) {
  function set<K extends keyof TopicGuideTemplate>(key: K, value: TopicGuideTemplate[K]) {
    onChange({ ...template, [key]: value });
  }

  function setSections(sections: TemplateSection[]) {
    set("sections", sections);
  }

  return (
    <div className="space-y-4">
      <Field
        label="Doc name prefix"
        hint="The topic title is appended, e.g. “Topic Guide — Arctic sovereignty”."
      >
        <input
          value={template.titlePrefix}
          onChange={(e) => set("titlePrefix", e.target.value)}
          className="input"
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ToggleField
          checked={template.includeQuestion}
          onToggle={(v) => set("includeQuestion", v)}
          label="Include the topic's framing"
          hint="Prints the one-line description under this heading."
        >
          <input
            value={template.questionHeading}
            onChange={(e) => set("questionHeading", e.target.value)}
            className="input mt-1.5"
            disabled={!template.includeQuestion}
          />
        </ToggleField>
        <ToggleField
          checked={template.includeChairNotes}
          onToggle={(v) => set("includeChairNotes", v)}
          label="Include chair notes"
          hint="Copies the topic's private notes into the Doc."
        >
          <input
            value={template.chairNotesHeading}
            onChange={(e) => set("chairNotesHeading", e.target.value)}
            className="input mt-1.5"
            disabled={!template.includeChairNotes}
          />
        </ToggleField>
      </div>

      <SectionsEditor sections={template.sections} onChange={setSections} />
    </div>
  );
}

function SectionsEditor({
  sections,
  onChange,
}: {
  sections: TemplateSection[];
  onChange: (s: TemplateSection[]) => void;
}) {
  function update(index: number, patch: Partial<TemplateSection>) {
    onChange(sections.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= sections.length) return;
    const next = [...sections];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  const atMax = sections.length >= TEMPLATE_LIMITS.maxSections;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-sm font-medium text-gray-700">
          Sections <span className="text-gray-400 font-normal">({sections.length})</span>
        </span>
        <span className="text-xs text-gray-400">
          An empty prompt becomes a blank bullet to type into.
        </span>
      </div>

      <div className="space-y-2">
        {sections.map((section, i) => (
          <div key={i} className="rounded-lg border border-gray-200 p-3">
            <div className="flex items-center gap-2">
              <input
                value={section.heading}
                onChange={(e) => update(i, { heading: e.target.value })}
                placeholder="Section heading"
                className="input font-medium"
              />
              <div className="flex items-center gap-0.5 shrink-0">
                <IconButton
                  label="Move up"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                >
                  ↑
                </IconButton>
                <IconButton
                  label="Move down"
                  disabled={i === sections.length - 1}
                  onClick={() => move(i, 1)}
                >
                  ↓
                </IconButton>
                <IconButton
                  label="Remove section"
                  danger
                  disabled={sections.length <= 1}
                  onClick={() => onChange(sections.filter((_, j) => j !== i))}
                >
                  ✕
                </IconButton>
              </div>
            </div>

            <ul className="mt-2 space-y-1.5">
              {section.prompts.map((prompt, pi) => (
                <li key={pi} className="flex items-center gap-2">
                  <span className="text-gray-300 shrink-0">•</span>
                  <input
                    value={prompt}
                    onChange={(e) =>
                      update(i, {
                        prompts: section.prompts.map((p, j) => (j === pi ? e.target.value : p)),
                      })
                    }
                    placeholder="(blank bullet)"
                    className="input text-sm"
                  />
                  <IconButton
                    label="Remove prompt"
                    danger
                    onClick={() =>
                      update(i, { prompts: section.prompts.filter((_, j) => j !== pi) })
                    }
                  >
                    ✕
                  </IconButton>
                </li>
              ))}
            </ul>

            <button
              onClick={() => update(i, { prompts: [...section.prompts, ""] })}
              disabled={section.prompts.length >= TEMPLATE_LIMITS.maxPromptsPerSection}
              className="mt-2 text-xs text-primary-700 hover:underline disabled:opacity-40 disabled:no-underline"
            >
              + add prompt
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={() => onChange([...sections, { heading: "New section", prompts: [""] }])}
        disabled={atMax}
        className="mt-2 text-sm text-primary-700 hover:underline disabled:opacity-40 disabled:no-underline"
        title={atMax ? `Limit is ${TEMPLATE_LIMITS.maxSections} sections` : undefined}
      >
        + add section
      </button>
    </div>
  );
}

/* ─── Minutes ────────────────────────────────────────────────────────────── */

function MinutesFields({
  template,
  onChange,
}: {
  template: MinutesTemplate;
  onChange: (t: MinutesTemplate) => void;
}) {
  function set<K extends keyof MinutesTemplate>(key: K, value: MinutesTemplate[K]) {
    onChange({ ...template, [key]: value });
  }

  return (
    <div className="space-y-4">
      <Field
        label="Doc name pattern"
        hint="Tokens: {date} for the meeting date (DD/MM/YYYY), {title} for its title."
      >
        <input
          value={template.titlePattern}
          onChange={(e) => set("titlePattern", e.target.value)}
          className="input font-mono text-xs"
        />
      </Field>

      <div>
        <p className="text-sm font-medium text-gray-700 mb-1.5">Auto-synced sections</p>
        <p className="text-xs text-gray-500 mb-2">
          Rebuilt from live meeting data on every sync. Untick one to leave it out entirely.
        </p>
        <div className="space-y-2">
          <ToggleField
            checked={template.includeAttendance}
            onToggle={(v) => set("includeAttendance", v)}
            label="Attendance table"
          >
            <input
              value={template.attendanceHeading}
              onChange={(e) => set("attendanceHeading", e.target.value)}
              className="input mt-1.5"
              disabled={!template.includeAttendance}
            />
          </ToggleField>
          <ToggleField
            checked={template.includeAgenda}
            onToggle={(v) => set("includeAgenda", v)}
            label="Agenda"
          >
            <input
              value={template.agendaHeading}
              onChange={(e) => set("agendaHeading", e.target.value)}
              className="input mt-1.5"
              disabled={!template.includeAgenda}
            />
          </ToggleField>
          <ToggleField
            checked={template.includeTasks}
            onToggle={(v) => set("includeTasks", v)}
            label="Weekly tasks per executive"
          >
            <input
              value={template.tasksHeading}
              onChange={(e) => set("tasksHeading", e.target.value)}
              className="input mt-1.5"
              disabled={!template.includeTasks}
            />
          </ToggleField>
        </div>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
        <Field
          label="Notes heading (the sync boundary)"
          hint="Everything above this heading is rebuilt on every sync; everything below it is yours and never overwritten. Renaming it is safe — the dashboard looks for the current name."
        >
          <input
            value={template.boundaryHeading}
            onChange={(e) => set("boundaryHeading", e.target.value)}
            className="input"
          />
        </Field>
        <p className="mt-2 text-[11px] text-amber-800">
          Existing Docs still contain the old heading. After renaming, update the heading in any
          Doc you still sync, or the next sync will treat it as a legacy layout and rebuild it.
        </p>
      </div>

      <Field label="Hint under the notes heading">
        <textarea
          rows={2}
          value={template.humanIntro}
          onChange={(e) => set("humanIntro", e.target.value)}
          className="input text-sm"
        />
      </Field>

      <div>
        <p className="text-sm font-medium text-gray-700 mb-1.5">Action items table</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <label className="block sm:col-span-2">
            <span className="text-xs text-gray-500">Heading</span>
            <input
              value={template.actionItemsHeading}
              onChange={(e) => set("actionItemsHeading", e.target.value)}
              className="input mt-0.5"
            />
          </label>
          <label className="block">
            <span className="text-xs text-gray-500">Blank rows</span>
            <input
              type="number"
              min={0}
              max={TEMPLATE_LIMITS.maxActionItemRows}
              value={template.actionItemRows}
              onChange={(e) => set("actionItemRows", Number(e.target.value) || 0)}
              className="input mt-0.5"
            />
          </label>
        </div>
        <label className="block mt-2">
          <span className="text-xs text-gray-500">
            Columns (comma separated, up to {TEMPLATE_LIMITS.maxActionItemColumns})
          </span>
          <input
            value={template.actionItemColumns.join(", ")}
            onChange={(e) =>
              set(
                "actionItemColumns",
                e.target.value
                  .split(",")
                  .map((c) => c.trim())
                  .filter(Boolean)
                  .slice(0, TEMPLATE_LIMITS.maxActionItemColumns),
              )
            }
            className="input mt-0.5"
          />
        </label>
      </div>
    </div>
  );
}

/* ─── Small shared pieces ────────────────────────────────────────────────── */

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      {hint && <span className="block text-xs text-gray-500 mt-0.5 mb-1">{hint}</span>}
      <div className={hint ? "" : "mt-1"}>{children}</div>
    </label>
  );
}

function ToggleField({
  checked,
  onToggle,
  label,
  hint,
  children,
}: {
  checked: boolean;
  onToggle: (v: boolean) => void;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-lg border p-2.5 ${checked ? "border-gray-200" : "border-gray-100 bg-gray-50"}`}>
      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onToggle(e.target.checked)}
          className="mt-0.5 rounded border-gray-300"
        />
        <span className="min-w-0">
          <span className="block text-sm text-gray-800">{label}</span>
          {hint && <span className="block text-xs text-gray-500">{hint}</span>}
        </span>
      </label>
      {children}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`w-6 h-6 shrink-0 rounded text-xs flex items-center justify-center transition-colors disabled:opacity-30 ${
        danger
          ? "text-gray-400 hover:bg-red-50 hover:text-red-600"
          : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
      }`}
    >
      {children}
    </button>
  );
}
