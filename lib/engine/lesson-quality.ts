import ts from "typescript";
import { extractCode, previewScenes, type PreviewScene } from "@/lib/engine/lesson-preview";
import { parseLanguageDirective, type LessonCodeLanguage } from "@/lib/engine/lesson-languages";

export type LessonIssue = {
  sceneId: string;
  sceneTitle: string;
  field: string;
  severity: "error" | "warning";
  message: string;
};

const unexpectedScript = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/;
const foreignDeclaration = /\b(?:int|void|bool|char|float|double|long)\s+\w+\s*\(/;

export function inspectLesson(scenes: unknown, directive: string): LessonIssue[] {
  const language = parseLanguageDirective(directive);
  const views = previewScenes(scenes, false, language.code);
  return views.flatMap((scene) => inspectScene(scene, language.code));
}

export function inspectScene(scene: PreviewScene, code: LessonCodeLanguage | null): LessonIssue[] {
  const issues: LessonIssue[] = [];
  const fields: { field: string; text: string }[] = [
    { field: "title", text: scene.title },
    ...scene.paragraphs.map((text) => ({ field: "body", text })),
    ...scene.blocks.flatMap((block) => {
      if (block.kind === "code") return [{ field: "code", text: block.code }];
      if (block.kind === "steps") return block.steps.map((text) => ({ field: "body", text }));
      if (block.kind === "comparison") {
        return [...block.headers, ...block.rows.flat()].map((text) => ({ field: "body", text }));
      }
      return [{ field: "body", text: block.text }];
    }),
    ...scene.questions.flatMap((question) => [
      { field: "question", text: question.prompt },
      ...question.options.map((text) => ({ field: "option", text })),
    ]),
    ...(scene.diagram
      ? [
          ...(scene.diagram.title ? [{ field: "diagram", text: scene.diagram.title }] : []),
          ...(scene.diagram.description ? [{ field: "diagram", text: scene.diagram.description }] : []),
          ...scene.diagram.nodes.flatMap((n) => [{ field: "diagram", text: n.label }, { field: "diagram", text: n.description }]),
          ...scene.diagram.edges.flatMap((e) => (e.label ? [{ field: "diagram", text: e.label }] : [])),
        ]
      : []),
    ...(scene.stepper
      ? [
          ...(scene.stepper.title ? [{ field: "stepper", text: scene.stepper.title }] : []),
          ...scene.stepper.steps.flatMap((s) => [
            { field: "stepper", text: s.title },
            { field: "stepper", text: s.explanation },
            ...(s.callout ? [{ field: "stepper", text: s.callout }] : []),
          ]),
        ]
      : []),
    ...(scene.walkthrough
      ? [
          ...(scene.walkthrough.title ? [{ field: "walkthrough", text: scene.walkthrough.title }] : []),
          ...scene.walkthrough.annotations.flatMap((a) => [
            { field: "walkthrough", text: a.title },
            { field: "walkthrough", text: a.explanation },
          ]),
        ]
      : []),
  ];
  for (const entry of fields) {
    if (unexpectedScript.test(entry.text)) {
      issues.push({
        sceneId: scene.id,
        sceneTitle: scene.title,
        field: entry.field,
        severity: "error",
        message: "This English lesson contains text in another script.",
      });
      break;
    }
  }
  const samples = codeSamples(scene, code);
  if (samples.length === 0) return dedupe(issues);
  if (code === null) {
    issues.push({
      sceneId: scene.id,
      sceneTitle: scene.title,
      field: "code",
      severity: "warning",
      message: "No programming language was saved for this lesson, so the example was not syntax-checked.",
    });
    return dedupe(issues);
  }
  for (const sample of samples) {
    const result = checkCodeSyntax(sample, code);
    if (result.status === "invalid") {
      issues.push({
        sceneId: scene.id,
        sceneTitle: scene.title,
        field: "code",
        severity: "error",
        message: result.message,
      });
    }
    if (result.status === "unverified") {
      issues.push({
        sceneId: scene.id,
        sceneTitle: scene.title,
        field: "code",
        severity: "warning",
        message: result.message,
      });
    }
  }
  return dedupe(issues);
}

export function checkCodeSyntax(
  code: string,
  language: LessonCodeLanguage,
): { status: "valid" | "invalid" | "unverified"; message: string } {
  if (language === "java") {
    return { status: "unverified", message: "Java example syntax is not checked in this portal." };
  }
  if (language === "cpp") {
    return { status: "unverified", message: "C++ example syntax is not checked in this portal." };
  }
  if (code.trim().length === 0) return { status: "invalid", message: "The code block is empty." };
  if (foreignDeclaration.test(code)) {
    const name = language === "typescript" ? "TypeScript" : "JavaScript";
    return { status: "invalid", message: `This example uses a C or Java declaration, which is not ${name}.` };
  }
  const kind = language === "javascript" ? ts.ScriptKind.JS : ts.ScriptKind.TS;
  const fileName = language === "javascript" ? "lesson-example.js" : "lesson-example.ts";
  const options: ts.CompilerOptions = { noEmit: true, target: ts.ScriptTarget.Latest, allowJs: true };
  const host = ts.createCompilerHost(options);
  const read = host.getSourceFile.bind(host);
  host.getSourceFile = (name, version) => (name === fileName ? ts.createSourceFile(name, code, version, true, kind) : read(name, version));
  const diagnostic = ts.createProgram([fileName], options, host).getSyntacticDiagnostics()[0];
  if (!diagnostic) return { status: "valid", message: "" };
  const detail = ts.flattenDiagnosticMessageText(diagnostic.messageText, " ");
  if (language === "javascript" && /type annotation|TypeScript/i.test(detail)) {
    return { status: "invalid", message: "This example uses TypeScript syntax, which is not valid in a JavaScript lesson." };
  }
  return { status: "invalid", message: `The example is not valid ${language === "typescript" ? "TypeScript" : "JavaScript"}: ${detail}`.slice(0, 180) };
}

function codeSamples(scene: PreviewScene, code: LessonCodeLanguage | null = null): string[] {
  const fromBlocks = scene.blocks.flatMap((block) => (block.kind === "code" ? [block.code] : []));
  if (fromBlocks.length > 0) return fromBlocks;
  if (
    scene.walkthrough?.code &&
    (scene.walkthrough.language === code ||
      (code !== null && (scene.walkthrough.language === "typescript" || scene.walkthrough.language === "javascript")))
  ) {
    return [scene.walkthrough.code];
  }
  return scene.paragraphs.flatMap((paragraph) => extractCode(paragraph));
}

function dedupe(issues: LessonIssue[]): LessonIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.sceneId}:${issue.severity}:${issue.field}:${issue.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
