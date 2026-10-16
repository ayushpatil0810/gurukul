import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/errors";
import { ingestErrorMessage } from "@/lib/engine/ingest-error";
import { eventBatchSchema } from "@/lib/validations/assessment";
import { formatZodErrors } from "@/lib/validations/validate";

const source = "REFERENCE_SOLUTION_SHOULD_NOT_ECHO";

describe("ingest errors", () => {
  it("does not echo source text from a rejected event batch", () => {
    const parsed = eventBatchSchema.safeParse({
      events: [{ seq: 1_000_001, t: 0, type: "insert", payload: { text: source } }],
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(JSON.stringify(formatZodErrors(parsed.error))).not.toContain(source);
      expect(ingestErrorMessage(parsed.error)).toBe("Could not store events");
    }

    const body = eventBatchSchema.safeParse({
      events: [{ seq: "nope", t: 0, type: "insert", payload: source }],
    });
    expect(body.success).toBe(false);
    if (!body.success) {
      expect(JSON.stringify(formatZodErrors(body.error))).not.toContain(source);
    }
  });

  it("hides database errors and keeps safe authorization messages", () => {
    expect(ingestErrorMessage(new Error(`duplicate key value ${source}`))).toBe("Could not store events");
    expect(ingestErrorMessage(AppError.forbidden("You can only open your own session"))).toBe(
      "You can only open your own session",
    );
  });
});