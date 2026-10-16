import { describe, expect, it } from "vitest";
import type { SceneOutline } from "@openmaic/generation";
import { normalizeOutlineValue, repairInstruction, usableOutlines } from "@/lib/engine/lesson-generation";
import { outlineSceneSchema } from "@/lib/validations/lessons";

describe("lesson outlines", () => {
  it("keeps slide and quiz scenes and drops interactive ones", () => {
    const outlines = usableOutlines([
      { id: "a", type: "interactive", title: "Widget", description: "Runs code", keyPoints: ["x"], order: 1 },
      { id: "b", type: "slide", title: "  Functions  ", description: "", keyPoints: [" maps input "], order: 4 },
      { id: "c", type: "pbl", title: "Project", description: "A project", keyPoints: [], order: 2 },
      { id: "d", type: "quiz", title: "Check", description: "One question", keyPoints: ["name it"], order: 3 },
    ] as SceneOutline[]);
    expect(outlines.map((outline) => outline.type)).toEqual(["slide", "quiz"]);
    expect(outlines[0]?.title).toBe("Functions");
    expect(outlines[0]?.description).toBe("Functions");
    expect(outlines[0]?.order).toBe(1);
  });

  it("maps the DSL short_answer quiz type onto the outline text type", () => {
    const normalized = normalizeOutlineValue({
      id: "quiz-1",
      type: "quiz",
      title: "Check",
      description: "One question",
      keyPoints: ["name it"],
      order: 1,
      quizConfig: { questionCount: 3, difficulty: "easy", questionTypes: ["short_answer", "single"] },
    });
    expect(outlineSceneSchema.safeParse(normalized).success).toBe(true);
  });

  it("includes the invalid example in a scene repair instruction", () => {
    const instruction = repairInstruction(["The example is not valid JavaScript: Expression expected."], ["const value = await"]);
    expect(instruction).toContain("Expression expected");
    expect(instruction).toContain("const value = await");
    expect(repairInstruction(["This English lesson contains text in another script."], [])).not.toContain("Replace this example");

    // Language-specific repair instructions
    const jsInstruction = repairInstruction(["The example is not valid JavaScript: Expression expected."], ["const value = await"], "javascript");
    expect(jsInstruction).toContain("Replace this example with valid JavaScript");
    const tsInstruction = repairInstruction(["The example is not valid TypeScript: Expression expected."], ["const value = await"], "typescript");
    expect(tsInstruction).toContain("Replace this example with valid TypeScript");
  });

  it("repairs an invalid JavaScript scene on retry during bounded generation", async () => {
    const { requestOneScene } = await import("@/lib/engine/lesson-generation");
    const outline: SceneOutline = {
      id: "scene_async_1",
      type: "slide",
      title: "Async Functions Return Promises",
      description: "Explain how async functions return promises in JavaScript.",
      keyPoints: ["Returns a promise", "Resolves with value"],
      order: 1,
    };

    let contentCalls = 0;
    const aiCall = async (system: string) => {
      if (system.includes("Action Generator")) return "[]";
      contentCalls += 1;
      if (contentCalls === 1) {
        // First attempt returns invalid JavaScript (missing expression after await)
        return JSON.stringify({
          background: { type: "solid", color: "#ffffff" },
          elements: [
            {
              type: "text",
              content: "<p>Async Functions Return Promises</p><p>async function getValue() { const x = await ; return x; }</p>",
            },
          ],
        });
      }
      // Second attempt repairs it with valid plain JavaScript
      return JSON.stringify({
        background: { type: "solid", color: "#ffffff" },
        elements: [
          {
            type: "text",
            content: "<p>Async Functions Return Promises</p><p>async function getValue() { const x = await Promise.resolve(42); return x; }</p>",
          },
        ],
      });
    };

    const scene = await requestOneScene(outline, "stage-1", aiCall, "explanation=en;code=javascript");
    expect(scene.title).toBe("Async Functions Return Promises");
    expect(contentCalls).toBe(2);
  });

  it("fails closed and preserves draft when repair limit is reached", async () => {
    const { requestOneScene } = await import("@/lib/engine/lesson-generation");
    const outline: SceneOutline = {
      id: "scene_async_fail",
      type: "slide",
      title: "Async Functions Return Promises",
      description: "Explain how async functions return promises in JavaScript.",
      keyPoints: ["Returns a promise"],
      order: 1,
    };

    let contentCalls = 0;
    const failingAiCall = async (system: string) => {
      if (system.includes("Action Generator")) return "[]";
      contentCalls += 1;
      return JSON.stringify({
        background: { type: "solid", color: "#ffffff" },
        elements: [
          {
            type: "text",
            content: "<p>Async Functions Return Promises</p><p>async function getValue() { const x = await ; return x; }</p>",
          },
        ],
      });
    };

    await expect(requestOneScene(outline, "stage-1", failingAiCall, "explanation=en;code=javascript")).rejects.toThrow(
      /The draft was not changed/,
    );
    expect(contentCalls).toBe(2);
  });
});
