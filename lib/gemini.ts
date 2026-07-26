/**
 * Minimal Gemini client — plain fetch, no SDK.
 *
 * Only used by the topic suggester. If GEMINI_API_KEY isn't set, callers should
 * fall back to the curated seed list silently.
 */

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-2.5-flash";

export function geminiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

export function geminiModel(): string {
  return process.env.GEMINI_MODEL || DEFAULT_MODEL;
}

/**
 * A JSON Schema subset Gemini accepts for `responseSchema` (OpenAPI-flavoured).
 * Supplying one makes the model emit conforming JSON, which is stricter than
 * merely asking for JSON in the prompt.
 */
export interface GeminiSchema {
  type: string;
  properties?: Record<string, GeminiSchema>;
  items?: GeminiSchema;
  required?: string[];
  enum?: string[];
  description?: string;
}

interface GeminiRequest {
  model?: string;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  /** Ask for `application/json` back, optionally conforming to a schema. */
  jsonMode?: boolean;
  schema?: GeminiSchema;
}

/** Returns the model's raw text response. */
export async function geminiChat({
  model = geminiModel(),
  systemPrompt,
  userPrompt,
  temperature = 0.9,
  jsonMode = false,
  schema,
}: GeminiRequest): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");

  const generationConfig: Record<string, unknown> = { temperature };
  if (jsonMode || schema) {
    generationConfig.responseMimeType = "application/json";
    if (schema) generationConfig.responseSchema = schema;
  }

  const res = await fetch(`${API_BASE}/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Header rather than ?key= so the secret never lands in a URL or log line.
      "x-goog-api-key": key,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Gemini HTTP ${res.status} (${model}): ${detail.slice(0, 300)}`);
  }

  const data = await res.json();

  // A blocked prompt returns 200 with no candidates.
  const blockReason = data?.promptFeedback?.blockReason;
  if (blockReason) throw new Error(`Gemini blocked the prompt: ${blockReason}`);

  const candidate = data?.candidates?.[0];
  if (!candidate) throw new Error("Gemini returned no candidates");

  const text = candidate.content?.parts
    ?.map((p: { text?: unknown }) => (typeof p.text === "string" ? p.text : ""))
    .join("");

  if (!text) {
    // finishReason explains an empty answer far better than "no content" does —
    // SAFETY, MAX_TOKENS and RECITATION all land here.
    const reason = candidate.finishReason ? ` (finishReason: ${candidate.finishReason})` : "";
    throw new Error(`Gemini returned no content${reason}`);
  }
  return text;
}
