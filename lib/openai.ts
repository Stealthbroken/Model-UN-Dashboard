/**
 * Minimal OpenAI client — plain fetch, no SDK.
 *
 * Only used by the topic suggester. If OPENAI_API_KEY isn't set, callers
 * should fall back to the curated seed list silently.
 */

const ENDPOINT = "https://api.openai.com/v1/chat/completions";

export function openAiConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

interface ChatRequest {
  model?: string;
  systemPrompt: string;
  userPrompt: string;
  // Force a JSON object response — saves us a parse-failure fallback path.
  jsonMode?: boolean;
  temperature?: number;
}

export async function openAiChat({
  model = process.env.OPENAI_MODEL || "gpt-4o-mini",
  systemPrompt,
  userPrompt,
  jsonMode = false,
  temperature = 0.9,
}: ChatRequest): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      temperature,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt },
      ],
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`OpenAI HTTP ${res.status}: ${detail.slice(0, 300)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("OpenAI returned no content");
  return content;
}
