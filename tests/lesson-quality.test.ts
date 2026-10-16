import { describe, expect, it } from "vitest";
import { extractCode, blocksFromParagraphs, previewScenes } from "@/lib/engine/lesson-preview";
import { applyPhraseRepair } from "@/lib/engine/lesson-repair";
import { checkCodeSyntax, inspectLesson } from "@/lib/engine/lesson-quality";

const directive = "explanation=en;code=typescript";

function slide(content: string, title = "Return types") {
  return [
    {
      id: "scene-1",
      outlineId: "scene-1",
      type: "slide",
      title,
      order: 1,
      content: { canvas: { elements: [{ type: "text", content }] } },
    },
  ];
}

describe("lesson quality", () => {
  it("rejects a C-style declaration in a TypeScript lesson", () => {
    const issues = inspectLesson(slide("int add(int a, int b) { return a + b; }"), directive);
    expect(issues.some((issue) => issue.severity === "error" && issue.field === "code")).toBe(true);
  });

  it("rejects Chinese labels in an English lesson", () => {
    const issues = inspectLesson(slide("位置 参数列表后面"), directive);
    expect(issues).toEqual([
      expect.objectContaining({ sceneTitle: "Return types", field: "body", severity: "error" }),
    ]);
  });

  it("allows technical identifiers and valid TypeScript", () => {
    const text = "p_know stays on the server.\nfunction add(a: number, b: number): number { return a + b; }";
    expect(inspectLesson(slide(text), directive).filter((issue) => issue.severity === "error")).toEqual([]);
    expect(checkCodeSyntax("function add(a: number, b: number): number { return a + b; }", "typescript").status).toBe("valid");
  });

  it("accepts an async JavaScript function that uses await", () => {
    const sample = "async function load() {\n  try {\n    const value = await Promise.resolve(1);\n    return value;\n  } catch (error) {\n    return 0;\n  }\n}";
    expect(extractCode(sample)).toEqual([sample]);
    expect(checkCodeSyntax(sample, "javascript").status).toBe("valid");
    const issues = inspectLesson(slide(sample, "Await"), "explanation=en;code=javascript");
    expect(issues.filter((issue) => issue.severity === "error")).toEqual([]);
  });

  it("accepts arrows, promises, and object literals, and rejects TypeScript-only JavaScript", () => {
    const directive = "explanation=en;code=javascript";
    const valid = "const load = async () => { const value = await Promise.resolve(1); return value; };\nconst user = { name: \"Ada\" };";
    expect(inspectLesson(slide(valid, "Async"), directive).filter((issue) => issue.severity === "error")).toEqual([]);
    expect(checkCodeSyntax("const load = async () => await Promise.resolve(1);", "javascript").status).toBe("valid");
    expect(checkCodeSyntax("function add(a: number): number { return a; }", "javascript").status).toBe("invalid");
    expect(checkCodeSyntax("This function returns a promise to the caller.", "javascript").status).toBe("invalid");
    expect(checkCodeSyntax(" ", "javascript").status).toBe("invalid");
    expect(inspectLesson(slide("Read this if (ready) { the step continues.", "Async"), directive).filter((issue) => issue.severity === "error")).toEqual([]);
  });

  it("detects and repairs the exact Chinese-label defects in TypeScript Return Values", () => {
    const rawContent = "<p>Return Types in TypeScript\n\n位置 参数列表后面\n\n常见类型 number · string · boolean · void\n\n作用 返回值必须匹配声明类型\n\n示例\n\nfunction add(a: number, b: number): number { return a + b; }</p>";
    const rawScene = slide(rawContent, "Return Types in TypeScript")[0]!;
    const detectedIssues = inspectLesson([rawScene], directive);
    expect(detectedIssues.some((issue) => issue.severity === "error" && issue.message.includes("another script"))).toBe(true);

    const phrases = [
      { from: "位置", to: "Where it goes" },
      { from: "参数列表后面", to: "After the parameter list" },
      { from: "常见类型", to: "Common types" },
      { from: "作用", to: "What it does" },
      { from: "返回值必须匹配声明类型", to: "The returned value must match the declared type" },
      { from: "示例", to: "Example" },
    ];
    const repairResult = applyPhraseRepair([rawScene], rawScene.id, phrases);
    expect(repairResult.ok).toBe(true);
    if (!repairResult.ok) return;

    const repairedIssues = inspectLesson(repairResult.scenes, directive);
    expect(repairedIssues.filter((issue) => issue.severity === "error")).toEqual([]);
    expect(JSON.stringify(repairResult.scenes)).not.toMatch(/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/);
  });

  it("detects the exact int add defect and verifies its TypeScript replacement", () => {
    const rawScene = slide("1. Read the function\n\nExample\n\nint add(int a, int b) { return a + b; }", "Reading Simple Examples")[0]!;
    const detectedIssues = inspectLesson([rawScene], directive);
    expect(detectedIssues.some((issue) => issue.severity === "error" && issue.message.includes("C or Java declaration"))).toBe(true);

    const repairResult = applyPhraseRepair([rawScene], rawScene.id, [
      { from: "int add(int a, int b) { return a + b; }", to: "function add(a: number, b: number): number { return a + b; }" },
    ]);
    expect(repairResult.ok).toBe(true);
    if (!repairResult.ok) return;

    const repairedIssues = inspectLesson(repairResult.scenes, directive);
    expect(repairedIssues.filter((issue) => issue.severity === "error")).toEqual([]);
  });

  it("detects invalid JavaScript async examples and accepts valid async JavaScript", () => {
    const jsDirective = "explanation=en;code=javascript";
    // TypeScript-only return type annotation in JS async function
    const tsInJs = "async function getValue(): Promise<number> {\n  return 42;\n}";
    expect(checkCodeSyntax(tsInJs, "javascript")).toEqual({
      status: "invalid",
      message: "This example uses TypeScript syntax, which is not valid in a JavaScript lesson.",
    });

    // Syntax error in JS async function
    const badSyntax = "async function getValue() {\n  const x = await ;\n  return x;\n}";
    expect(checkCodeSyntax(badSyntax, "javascript").status).toBe("invalid");

    // Prose accidentally in code block
    expect(checkCodeSyntax("This function returns a promise to the caller.", "javascript").status).toBe("invalid");

    // Empty code block
    expect(checkCodeSyntax("   ", "javascript")).toEqual({
      status: "invalid",
      message: "The code block is empty.",
    });

    // Valid modern async JavaScript functions
    const validAsync = "async function getValue() {\n  return 42;\n}";
    expect(checkCodeSyntax(validAsync, "javascript")).toEqual({ status: "valid", message: "" });
    const validAwait = "async function loadData() {\n  const data = await fetch('/api');\n  return data;\n}";
    expect(checkCodeSyntax(validAwait, "javascript")).toEqual({ status: "valid", message: "" });
    const validArrow = "const getValue = async () => {\n  return await Promise.resolve(42);\n};";
    expect(checkCodeSyntax(validArrow, "javascript")).toEqual({ status: "valid", message: "" });

    // Inspect slide containing valid async JS
    expect(inspectLesson(slide(validAsync, "Async Functions Return Promises"), jsDirective).filter((i) => i.severity === "error")).toEqual([]);
  });

  it("repairs the labeled scene and leaves the other scene unchanged", () => {
    const scenes = [
      { id: "scene_3", title: "Return Types", body: "位置 参数列表后面" },
      { id: "scene_6", title: "Examples", body: "int add(int a, int b) { return a + b; }" },
    ];
    const missing = applyPhraseRepair(scenes, "scene_3", [{ from: "not stored", to: "English" }]);
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(scenes[0]?.body).toContain("位置");
    const repaired = applyPhraseRepair(scenes, "scene_3", [
      { from: "位置", to: "Where it goes" },
      { from: "参数列表后面", to: "After the parameter list" },
    ]);
    expect(repaired.ok).toBe(true);
    if (!repaired.ok) return;
    expect(repaired.scenes[0]?.body).toBe("Where it goes After the parameter list");
    expect(repaired.scenes[1]).toEqual(scenes[1]);
    expect(inspectLesson(slide(repaired.scenes[0]?.body ?? ""), "explanation=en;code=typescript").filter((issue) => issue.severity === "error")).toEqual([]);
  });
  it("rejects malformed TypeScript and leaves Java unchecked", () => {
    expect(checkCodeSyntax("function (", "typescript").status).toBe("invalid");
    expect(checkCodeSyntax("int add(int a) { return a; }", "java").status).toBe("unverified");
  });

  it("warns when a code sample has no saved language", () => {
    const issues = inspectLesson(slide("function add(a: number): number { return a; }"), "Teach in English.");
    expect(issues.some((issue) => issue.severity === "warning")).toBe(true);
    expect(issues.some((issue) => issue.severity === "error")).toBe(false);
  });
});

describe("lesson presentation", () => {
  it("turns numbered lines into steps and a table into a comparison", () => {
    expect(blocksFromParagraphs(["1. Read the body\n2. Find the return"], null)[0]).toMatchObject({ kind: "steps" });
    expect(blocksFromParagraphs(["| Return | Print |\n| --- | --- |\n| Sends a value | Shows text |"], null)[0]).toMatchObject({
      kind: "comparison",
    });
  });

  it("marks the first slide as an introduction and a quiz as a check", () => {
    const scenes = previewScenes(
      [
        ...slide("A function sends a value back.", "What a function returns"),
        {
          id: "quiz-1",
          outlineId: "quiz-1",
          type: "quiz",
          title: "Check",
          content: { questions: [{ id: "q1", question: "What comes back?", options: [{ label: "A value" }], answer: ["A"] }] },
        },
      ],
      false,
      "typescript",
    );
    expect(scenes.map((scene) => scene.role)).toEqual(["introduction", "check"]);
  });
});
