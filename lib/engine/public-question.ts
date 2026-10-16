export type StoredTest = {
  id: string;
  visibility: "visible" | "hidden";
  input: string;
  expectedOutput: string;
};

export type PublicTest =
  | {
      id: string;
      visibility: "visible";
      input: string;
      expectedOutput: string;
    }
  | {
      id: string;
      visibility: "hidden";
    };

export type QuestionRecord = {
  id: string;
  statement: string;
  difficulty: number;
  languages: string[];
  starterCode: Record<string, string>;
  status: string;
};

export type PublicQuestion = QuestionRecord & {
  conceptIds: string[];
  tests: PublicTest[];
  visibleTestCount: number;
  hiddenTestCount: number;
};

/**
 * Client payload for a question. Hidden test inputs and expected outputs are omitted.
 */
export function toPublicQuestion(
  question: QuestionRecord,
  tests: readonly StoredTest[],
  conceptIds: readonly string[],
): PublicQuestion {
  const publicTests: PublicTest[] = tests.map((test) =>
    test.visibility === "hidden"
      ? { id: test.id, visibility: "hidden" }
      : {
          id: test.id,
          visibility: "visible",
          input: test.input,
          expectedOutput: test.expectedOutput,
        },
  );

  return {
    id: question.id,
    statement: question.statement,
    difficulty: question.difficulty,
    languages: question.languages,
    starterCode: question.starterCode,
    status: question.status,
    conceptIds: [...conceptIds],
    tests: publicTests,
    visibleTestCount: publicTests.filter((test) => test.visibility === "visible").length,
    hiddenTestCount: publicTests.filter((test) => test.visibility === "hidden").length,
  };
}
