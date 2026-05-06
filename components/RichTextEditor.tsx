"use client";

import { useRef } from "react";

/*
 * Google Classroom announcements use the API field `text`, which is plain text.
 * To get formatting that actually shows up in Classroom we use Unicode
 * mathematical alphanumerics + combining marks. The textarea contents are the
 * exact bytes sent to Classroom — what you see is what gets posted.
 */

const BOLD_OFFSETS = { upper: 0x1d400, lower: 0x1d41a, digit: 0x1d7ce };
const ITALIC_OFFSETS = { upper: 0x1d434, lower: 0x1d44e };
const BOLD_ITALIC_OFFSETS = { upper: 0x1d468, lower: 0x1d482 };
const SANS_BOLD_OFFSETS = { upper: 0x1d5d4, lower: 0x1d5ee, digit: 0x1d7ec };

function mapAlphanum(
  s: string,
  offsets: { upper?: number; lower?: number; digit?: number },
  fixups: Record<number, number> = {},
): string {
  let out = "";
  for (const ch of s) {
    const code = ch.codePointAt(0)!;
    if (fixups[code] !== undefined) {
      out += String.fromCodePoint(fixups[code]);
      continue;
    }
    if (offsets.upper && code >= 0x41 && code <= 0x5a) {
      out += String.fromCodePoint(offsets.upper + code - 0x41);
    } else if (offsets.lower && code >= 0x61 && code <= 0x7a) {
      out += String.fromCodePoint(offsets.lower + code - 0x61);
    } else if (offsets.digit && code >= 0x30 && code <= 0x39) {
      out += String.fromCodePoint(offsets.digit + code - 0x30);
    } else {
      out += ch;
    }
  }
  return out;
}

const toBold = (s: string) => mapAlphanum(s, BOLD_OFFSETS);
const toItalic = (s: string) =>
  mapAlphanum(s, ITALIC_OFFSETS, { 0x68: 0x210e }); // italic 'h' lives at U+210E
const toBoldItalic = (s: string) => mapAlphanum(s, BOLD_ITALIC_OFFSETS);
const toHeading = (s: string) => mapAlphanum(s, SANS_BOLD_OFFSETS);

function addCombining(s: string, mark: string): string {
  let out = "";
  for (const ch of s) {
    if (/\s/.test(ch)) out += ch;
    else out += ch + mark;
  }
  return out;
}
const toUnderline = (s: string) => addCombining(s, "̲");
const toStrike = (s: string) => addCombining(s, "̶");

/* Reverse mapping for the Plain-text button */
function buildReverseMap(): Map<number, string> {
  const m = new Map<number, string>();
  const ranges: Array<[number, number, number]> = [
    [BOLD_OFFSETS.upper, 26, 0x41],
    [BOLD_OFFSETS.lower, 26, 0x61],
    [BOLD_OFFSETS.digit, 10, 0x30],
    [ITALIC_OFFSETS.upper, 26, 0x41],
    [ITALIC_OFFSETS.lower, 26, 0x61],
    [BOLD_ITALIC_OFFSETS.upper, 26, 0x41],
    [BOLD_ITALIC_OFFSETS.lower, 26, 0x61],
    [SANS_BOLD_OFFSETS.upper, 26, 0x41],
    [SANS_BOLD_OFFSETS.lower, 26, 0x61],
    [SANS_BOLD_OFFSETS.digit, 10, 0x30],
  ];
  for (const [start, len, ascii] of ranges) {
    for (let i = 0; i < len; i++) m.set(start + i, String.fromCharCode(ascii + i));
  }
  m.set(0x210e, "h");
  return m;
}
const REVERSE = buildReverseMap();

function toPlain(s: string): string {
  let out = "";
  for (const ch of s) {
    const code = ch.codePointAt(0)!;
    if (code === 0x0332 || code === 0x0336) continue;
    out += REVERSE.get(code) ?? ch;
  }
  return out;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  rows?: number;
  placeholder?: string;
}

export function RichTextEditor({ value, onChange, disabled, rows = 8, placeholder }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function withSelection(fn: (selected: string) => string) {
    const ta = ref.current;
    if (!ta || disabled) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    if (start === end) return; // need a selection
    const before = value.slice(0, start);
    const sel = value.slice(start, end);
    const after = value.slice(end);
    const replaced = fn(sel);
    const next = before + replaced + after;
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start, start + replaced.length);
    });
  }

  function transformLines(fn: (line: string, idx: number) => string) {
    const ta = ref.current;
    if (!ta || disabled) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    // Expand selection to whole lines
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    let lineEnd = value.indexOf("\n", end);
    if (lineEnd === -1) lineEnd = value.length;
    const block = value.slice(lineStart, lineEnd);
    const lines = block.split("\n");
    const transformed = lines.map((l, i) => fn(l, i)).join("\n");
    const next = value.slice(0, lineStart) + transformed + value.slice(lineEnd);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(lineStart, lineStart + transformed.length);
    });
  }

  function insertAt(text: string) {
    const ta = ref.current;
    if (!ta || disabled) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const next = value.slice(0, start) + text + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + text.length, start + text.length);
    });
  }

  function bullet() {
    transformLines((l) => (l.startsWith("• ") ? l.slice(2) : "• " + l));
  }

  function numbered() {
    let n = 0;
    transformLines((l) => {
      const m = l.match(/^(\d+)\.\s/);
      if (m) return l.slice(m[0].length);
      n += 1;
      return `${n}. ${l}`;
    });
  }

  function heading() {
    transformLines((l) => (l ? toHeading(toPlain(l)) : l));
  }

  return (
    <div className={`border border-gray-300 rounded-lg overflow-hidden ${disabled ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
        <ToolBtn title="Bold (⌘B)" onClick={() => withSelection(toBold)} disabled={disabled}>
          <span className="font-bold">B</span>
        </ToolBtn>
        <ToolBtn title="Italic (⌘I)" onClick={() => withSelection(toItalic)} disabled={disabled}>
          <span className="italic">I</span>
        </ToolBtn>
        <ToolBtn title="Bold italic" onClick={() => withSelection(toBoldItalic)} disabled={disabled}>
          <span className="font-bold italic">BI</span>
        </ToolBtn>
        <ToolBtn title="Underline (⌘U)" onClick={() => withSelection(toUnderline)} disabled={disabled}>
          <span className="underline">U</span>
        </ToolBtn>
        <ToolBtn title="Strikethrough" onClick={() => withSelection(toStrike)} disabled={disabled}>
          <span className="line-through">S</span>
        </ToolBtn>
        <Divider />
        <ToolBtn title="Heading (sans-serif bold)" onClick={heading} disabled={disabled}>
          <span className="font-semibold text-xs">H</span>
        </ToolBtn>
        <ToolBtn title="Bullet list" onClick={bullet} disabled={disabled}>
          •
        </ToolBtn>
        <ToolBtn title="Numbered list" onClick={numbered} disabled={disabled}>
          1.
        </ToolBtn>
        <Divider />
        <ToolBtn title="Insert separator line" onClick={() => insertAt("\n────────────────\n")} disabled={disabled}>
          —
        </ToolBtn>
        <ToolBtn title="Strip formatting from selection" onClick={() => withSelection(toPlain)} disabled={disabled}>
          <span className="text-[10px]">Aa</span>
        </ToolBtn>
        <span className="ml-auto text-[10px] text-gray-400 px-1">
          Classroom-safe Unicode formatting
        </span>
      </div>
      <textarea
        ref={ref}
        rows={rows}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (!(e.metaKey || e.ctrlKey)) return;
          const k = e.key.toLowerCase();
          if (k === "b") {
            e.preventDefault();
            withSelection(toBold);
          } else if (k === "i") {
            e.preventDefault();
            withSelection(toItalic);
          } else if (k === "u") {
            e.preventDefault();
            withSelection(toUnderline);
          }
        }}
        className="w-full px-3 py-2 text-sm focus:outline-none resize-y disabled:bg-gray-50 font-sans"
      />
    </div>
  );
}

function ToolBtn({
  title,
  onClick,
  disabled,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-200 text-gray-700 text-sm disabled:opacity-40 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="w-px h-5 bg-gray-300 mx-0.5" />;
}
