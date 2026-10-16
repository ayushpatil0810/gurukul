import type { AICallFn } from "@openmaic/generation";
import { AppError } from "@/lib/errors";

const TIMEOUT_MS = 45_000;
const MAX_OUTPUT_CHARS = 80_000;
const MAX_PROMPT_CHARS = 64_000;

export type ProviderCategory =
  | "missing_key"
  | "invalid_credentials"
  | "rate_limited"
  | "quota"
  | "timeout"
  | "network"
  | "provider_error"
  | "invalid_output"
  | "empty_output";

const safePrefixes = [
  "Lesson generation needs OPENAI_API_KEY",
  "The lesson model rejected the API key",
  "The lesson model is rate limiting",
  "The lesson model account has no remaining quota",
  "The lesson model timed out",
  "The lesson model could not be reached",
  "The lesson model returned HTTP",
  "The lesson model returned an empty",
  "The lesson model returned more text",
  "The lesson model returned text that is not a lesson",
  "The lesson model returned a lesson in an unsupported format",
];

export function lessonModelConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function redactSecrets(value: string): string {
  return value.replace(/Bearer\s+\S+/gi, "Bearer [redacted]").replace(/\bsk-[A-Za-z0-9_-]+\b/g, "[redacted]");
}

/** Keeps a known safe sentence from an error OpenMAIC already wrapped. Drops everything else. */
export function safeProviderMessage(value: string | undefined): string | null {
  if (!value) return null;
  const redacted = redactSecrets(value);
  const prefix = safePrefixes.find((item) => redacted.includes(item));
  if (!prefix) return null;
  const start = redacted.indexOf(prefix);
  return redacted.slice(start, start + 240);
}

export function classifyProviderResponse(status: number, body: string): { category: ProviderCategory; message: string } {
  const lowered = body.toLowerCase();
  if (status === 401 || status === 403) {
    return { category: "invalid_credentials", message: "The lesson model rejected the API key. Check OPENAI_API_KEY. Nothing was saved." };
  }
  if (status === 429) {
    return { category: "rate_limited", message: "The lesson model is rate limiting requests. Wait and try again. Nothing was saved." };
  }
  if (status === 402 || /insufficient_quota|billing|quota/.test(lowered)) {
    return { category: "quota", message: "The lesson model account has no remaining quota. Nothing was saved." };
  }
  return { category: "provider_error", message: `The lesson model returned HTTP ${status}. Nothing was saved.` };
}

function providerError(category: ProviderCategory, message: string): AppError {
  const error = AppError.badRequest(message, { category });
  return error;
}

/** OpenMAIC's AICallFn. The key stays in the request header and is never stored or logged. */
export const callLessonModel: AICallFn = async (systemPrompt, userPrompt) => {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw providerError("missing_key", "Lesson generation needs OPENAI_API_KEY. The rest of the portal still works.");
  }
  const base = (process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    let response: Response;
    try {
      response = await fetch(`${base}/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          messages: [
            { role: "system", content: systemPrompt.slice(0, MAX_PROMPT_CHARS) },
            { role: "user", content: userPrompt.slice(0, MAX_PROMPT_CHARS) },
          ],
        }),
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw providerError("timeout", "The lesson model timed out. Nothing was saved.");
      }
      throw providerError("network", "The lesson model could not be reached. Nothing was saved.");
    }
    const raw = await response.text();
    if (!response.ok) {
      const failure = classifyProviderResponse(response.status, raw);
      throw providerError(failure.category, failure.message);
    }
    let body: { choices?: { message?: { content?: unknown } }[] };
    try {
      body = JSON.parse(raw) as { choices?: { message?: { content?: unknown } }[] };
    } catch {
      throw providerError("invalid_output", "The lesson model returned text that is not a lesson. Nothing was saved.");
    }
    const content = body.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw providerError("invalid_output", "The lesson model returned a lesson in an unsupported format. Nothing was saved.");
    }
    if (!content.trim()) {
      throw providerError("empty_output", "The lesson model returned an empty lesson. Nothing was saved.");
    }
    if (content.length > MAX_OUTPUT_CHARS) {
      throw providerError("invalid_output", "The lesson model returned more text than this portal stores. Nothing was saved.");
    }
    return content;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw providerError("network", "The lesson model could not be reached. Nothing was saved.");
  } finally {
    clearTimeout(timer);
  }
};
