import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { concepts, questionConcepts, questions, tests } from "@/db/schema";
import type { SubmissionLanguage } from "@/db/schema";
import { assertActorRole, type Actor } from "@/lib/auth/actor";
import { toPublicQuestion, type PublicQuestion, type StoredTest } from "@/lib/engine/public-question";
import { AppError } from "@/lib/errors";

type QuestionInput = {
  statement: string;
  difficulty: number;
  languages: SubmissionLanguage[];
  starterCode: Record<string, string>;
  conceptIds: string[];
  tests: { visibility: "visible" | "hidden"; input: string; expectedOutput: string }[];
  status: "draft" | "published" | "retired";
  referenceSolution?: string;
};

function requireEditor(actor: Actor): string {
  assertActorRole(actor, ["trainer", "admin"]);
  if (!actor.instituteId) {
    throw AppError.forbidden("Your account is not assigned to an institute");
  }
  return actor.instituteId;
}

async function assertConceptsInInstitute(instituteId: string, conceptIds: string[]) {
  const unique = [...new Set(conceptIds)];
  const rows = await db
    .select({ id: concepts.id })
    .from(concepts)
    .where(and(eq(concepts.instituteId, instituteId), inArray(concepts.id, unique)));
  if (rows.length !== unique.length) throw AppError.notFound("Concept not found");
  return unique;
}

async function loadPublicQuestions(instituteId: string, questionId?: string): Promise<PublicQuestion[]> {
  const questionRows = await db
    .select({
      id: questions.id,
      statement: questions.statement,
      difficulty: questions.difficulty,
      languages: questions.languages,
      starterCodeJson: questions.starterCodeJson,
      status: questions.status,
    })
    .from(questions)
    .where(
      questionId
        ? and(eq(questions.instituteId, instituteId), eq(questions.id, questionId))
        : eq(questions.instituteId, instituteId),
    );

  if (questionRows.length === 0) return [];
  const ids = questionRows.map((question) => question.id);
  const [testRows, conceptRows] = await Promise.all([
    db
      .select({
        id: tests.id,
        questionId: tests.questionId,
        visibility: tests.visibility,
        input: tests.input,
        expectedOutput: tests.expectedOutput,
      })
      .from(tests)
      .where(inArray(tests.questionId, ids)),
    db
      .select({
        questionId: questionConcepts.questionId,
        conceptId: questionConcepts.conceptId,
      })
      .from(questionConcepts)
      .where(inArray(questionConcepts.questionId, ids)),
  ]);

  return questionRows.map((question) => {
    const storedTests: StoredTest[] = testRows
      .filter((test) => test.questionId === question.id)
      .map((test) => ({
        id: test.id,
        visibility: test.visibility === "hidden" ? "hidden" : "visible",
        input: test.input,
        expectedOutput: test.expectedOutput,
      }));
    return toPublicQuestion(
      {
        id: question.id,
        statement: question.statement,
        difficulty: question.difficulty,
        languages: question.languages,
        starterCode: question.starterCodeJson,
        status: question.status,
      },
      storedTests,
      conceptRows.filter((link) => link.questionId === question.id).map((link) => link.conceptId),
    );
  });
}

export async function listQuestions(actor: Actor): Promise<PublicQuestion[]> {
  const instituteId = requireEditor(actor);
  return loadPublicQuestions(instituteId);
}

export async function getQuestion(actor: Actor, questionId: string): Promise<PublicQuestion> {
  const instituteId = requireEditor(actor);
  const [question] = await loadPublicQuestions(instituteId, questionId);
  if (!question) throw AppError.notFound("Question not found");
  return question;
}

export async function createQuestion(actor: Actor, input: QuestionInput): Promise<PublicQuestion> {
  const instituteId = requireEditor(actor);
  const conceptIds = await assertConceptsInInstitute(instituteId, input.conceptIds);
  const [created] = await db
    .insert(questions)
    .values({
      instituteId,
      statement: input.statement,
      difficulty: input.difficulty,
      languages: input.languages,
      starterCodeJson: input.starterCode,
      status: input.status,
      referenceSolution: input.referenceSolution ?? null,
    })
    .returning({ id: questions.id });
  if (!created) throw AppError.internal();

  await db.insert(questionConcepts).values(
    conceptIds.map((conceptId) => ({
      questionId: created.id,
      conceptId,
      instituteId,
    })),
  );
  await db.insert(tests).values(
    input.tests.map((test) => ({
      questionId: created.id,
      instituteId,
      visibility: test.visibility,
      input: test.input,
      expectedOutput: test.expectedOutput,
    })),
  );

  return getQuestion(actor, created.id);
}

export async function updateQuestion(
  actor: Actor,
  questionId: string,
  input: Partial<QuestionInput>,
) {
  const instituteId = requireEditor(actor);
  const [current] = await db
    .select({ id: questions.id })
    .from(questions)
    .where(and(eq(questions.id, questionId), eq(questions.instituteId, instituteId)))
    .limit(1);
  if (!current) throw AppError.notFound("Question not found");

  const conceptIds = input.conceptIds
    ? await assertConceptsInInstitute(instituteId, input.conceptIds)
    : undefined;

  await db
    .update(questions)
    .set({
      ...(input.statement !== undefined ? { statement: input.statement } : {}),
      ...(input.difficulty !== undefined ? { difficulty: input.difficulty } : {}),
      ...(input.languages !== undefined ? { languages: input.languages } : {}),
      ...(input.starterCode !== undefined ? { starterCodeJson: input.starterCode } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.referenceSolution !== undefined
        ? { referenceSolution: input.referenceSolution }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(questions.id, questionId));

  if (conceptIds) {
    await db.delete(questionConcepts).where(eq(questionConcepts.questionId, questionId));
    await db.insert(questionConcepts).values(
      conceptIds.map((conceptId) => ({ questionId, conceptId, instituteId })),
    );
  }

  if (input.tests) {
    await db.delete(tests).where(eq(tests.questionId, questionId));
    await db.insert(tests).values(
      input.tests.map((test) => ({
        questionId,
        instituteId,
        visibility: test.visibility,
        input: test.input,
        expectedOutput: test.expectedOutput,
      })),
    );
  }

  return getQuestion(actor, questionId);
}

export async function deleteQuestion(actor: Actor, questionId: string) {
  const instituteId = requireEditor(actor);
  const deleted = await db
    .delete(questions)
    .where(and(eq(questions.id, questionId), eq(questions.instituteId, instituteId)))
    .returning({ id: questions.id });
  if (deleted.length === 0) throw AppError.notFound("Question not found");
}
