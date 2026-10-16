import { afterEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import { callLessonModel, classifyProviderResponse, redactSecrets, safeProviderMessage } from "@/lib/engine/lesson-provider";

const originalKey = process.env.OPENAI_API_KEY;
const originalFetch = globalThis.fetch;

afterEach(() => {
  process.env.OPENAI_API_KEY = originalKey;
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("lesson provider errors", () => {
  it("redacts bearer tokens and key-shaped strings", () => {
    expect(redactSecrets("Authorization: Bearer sk-live-secret and sk-live-secret")).not.toContain("sk-live-secret");
    expect(redactSecrets("Authorization: Bearer sk-live-secret")).toContain("Bearer [redacted]");
  });

  it("maps status codes without copying the response body", () => {
    expect(classifyProviderResponse(401, "bad key sk-live-secret").message).not.toContain("sk-live-secret");
    expect(classifyProviderResponse(401, "no").category).toBe("invalid_credentials");
    expect(classifyProviderResponse(429, "slow").category).toBe("rate_limited");
    expect(classifyProviderResponse(402, "payment").category).toBe("quota");
    expect(classifyProviderResponse(500, "insufficient_quota").category).toBe("quota");
    expect(classifyProviderResponse(503, "down").category).toBe("provider_error");
  });

  it("keeps only a known safe sentence from a wrapped provider error", () => {
    expect(safeProviderMessage("Error: The lesson model rejected the API key. Check OPENAI_API_KEY. Nothing was saved. sk-live-secret")).toContain(
      "rejected the API key",
    );
    expect(safeProviderMessage("Error: The lesson model rejected the API key. Check OPENAI_API_KEY. Nothing was saved. sk-live-secret")).not.toContain(
      "sk-live-secret",
    );
    expect(safeProviderMessage("upstream stack /home/secret")).toBeNull();
  });

  it("returns a credential error and leaves no secret in the message", async () => {
    process.env.OPENAI_API_KEY = "unit-test-key";
    globalThis.fetch = vi.fn(async () => new Response("unit-test-key", { status: 401 })) as typeof fetch;
    await expect(callLessonModel("system", "user")).rejects.toMatchObject({
      statusCode: 400,
      details: { category: "invalid_credentials" },
    });
    try {
      await callLessonModel("system", "user");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).message).not.toContain("unit-test-key");
    }
  });

  it("reports a timeout without publishing", async () => {
    process.env.OPENAI_API_KEY = "unit-test-key";
    globalThis.fetch = vi.fn(async () => {
      const error = new Error("aborted");
      error.name = "AbortError";
      throw error;
    }) as typeof fetch;
    await expect(callLessonModel("system", "user")).rejects.toMatchObject({ details: { category: "timeout" } });
  });
});
