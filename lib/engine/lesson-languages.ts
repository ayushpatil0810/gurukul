const lessonCodeLanguages = ["typescript", "javascript", "java", "cpp"] as const;

export type LessonCodeLanguage = (typeof lessonCodeLanguages)[number];

export type LessonLanguage = {
  explanation: "en";
  code: LessonCodeLanguage | null;
};

const recorded = /^explanation=en;code=(typescript|javascript|java|cpp)$/;

export function encodeLanguageDirective(code: LessonCodeLanguage): string {
  return `explanation=en;code=${code}`;
}

/** Legacy rows store OpenMAIC's free-text directive. Those have no selected code language. */
export function parseLanguageDirective(value: string): LessonLanguage {
  const match = recorded.exec(value.trim());
  if (!match) return { explanation: "en", code: null };
  return { explanation: "en", code: match[1] as LessonCodeLanguage };
}

export function languagePrompt(code: LessonCodeLanguage): string {
  const name = code === "cpp" ? "C++" : code === "typescript" ? "TypeScript" : code === "javascript" ? "JavaScript" : "Java";
  return [
    "Write every heading, explanation, label, and quiz prompt in English.",
    "Do not use Chinese, Japanese, Korean, or any other language in learner-facing text.",
    `Write every code example in ${name} only.`,
    code === "javascript"
      ? `Each JavaScript example must be syntactically valid plain JavaScript. Do not use TypeScript type annotations or interfaces, and do not use C or Java declarations such as "int add".`
      : code === "typescript"
        ? `Each TypeScript example must be syntactically valid. Do not use C or Java declarations such as "int add".`
        : `Mark ${name} examples with a fenced code block.`,
  ].join(" ");
}

