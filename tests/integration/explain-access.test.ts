import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  attempts,
  batchMembers,
  batchTrainers,
  batches,
  concepts,
  consents,
  explainQa,
  explainSets,
  institutes,
  learningSessions,
  masteryState,
  masteryUpdates,
  questions,
  signals,
  tests,
  user,
} from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { answerExplanation, ensureExplanation, listSessionExplanations, readExplanation } from "@/lib/services/explain";
import type { RunResult, SandboxRunner } from "@/sandbox/types";

const instituteId = crypto.randomUUID();
const otherInstituteId = crypto.randomUUID();
const trainerId = crypto.randomUUID();
const outsiderId = crypto.randomUUID();
const adminId = crypto.randomUUID();
const otherAdminId = crypto.randomUUID();
const adaId = crypto.randomUUID();
const benId = crypto.randomUUID();
const secret = `REFERENCE_${instituteId}`;
const hiddenOutput = `HIDDEN_OUTPUT_${instituteId}`;
const hiddenInput = `HIDDEN_INPUT_${instituteId}`;

const js = `function total(n) {
  if (n <= 1) return n;
  return n + 1;
}`;

function person(id: string, role: Actor["role"], institute: string): Actor {
  return { id, name: role, email: `${id}@example.com`, role, instituteId: institute };
}

function result(stdout: string): RunResult {
  return { outcome: "ok", stdout, stderr: "", exitCode: 0, timedOut: false, durationMs: 1, message: "ok" };
}

const runner: SandboxRunner = {
  async run(language, code) {
    if (language === "javascript" && code.includes("__explain_probe")) {
      if (code.includes("total(0)")) return result("0\n");
      if (code.includes("<=")) return result("3\n");
      if (code.includes("n < 1")) return result("4\n");
      return result("3\n");
    }
    if ((language === "java" || language === "cpp") && !code.includes("__explain_probe")) return result("4\n");
    return { ...result(""), outcome: "runtime_error", exitCode: 1, message: "runtime_error" };
  },
};

afterAll(async () => {
  await db.delete(user).where(eq(user.instituteId, instituteId));
  await db.delete(user).where(eq(user.instituteId, otherInstituteId));
  await db.delete(institutes).where(eq(institutes.id, instituteId));
  await db.delete(institutes).where(eq(institutes.id, otherInstituteId));
  const { closeDatabase } = await import("@/db");
  await closeDatabase();
});

describe("explain your code", () => {
  it("keeps questions with the submitted snapshot and does not change grade or mastery", async () => {
    await db.insert(institutes).values([
      { id: instituteId, name: `Explain ${instituteId}` },
      { id: otherInstituteId, name: `Other ${otherInstituteId}` },
    ]);
    await db.insert(user).values([
      { id: trainerId, name: "Trainer", email: `${trainerId}@example.com`, emailVerified: true, role: "trainer", instituteId },
      { id: outsiderId, name: "Outsider", email: `${outsiderId}@example.com`, emailVerified: true, role: "trainer", instituteId },
      { id: adminId, name: "Admin", email: `${adminId}@example.com`, emailVerified: true, role: "admin", instituteId },
      { id: otherAdminId, name: "Other admin", email: `${otherAdminId}@example.com`, emailVerified: true, role: "admin", instituteId: otherInstituteId },
      { id: adaId, name: "Ada", email: `${adaId}@example.com`, emailVerified: true, role: "student", instituteId },
      { id: benId, name: "Ben", email: `${benId}@example.com`, emailVerified: true, role: "student", instituteId },
    ]);
    const [batch] = await db.insert(batches).values({ instituteId, name: `Batch ${instituteId}` }).returning();
    await db.insert(batchTrainers).values({ batchId: batch!.id, trainerId, instituteId });
    await db.insert(batchMembers).values({ batchId: batch!.id, studentId: adaId, instituteId });
    const [concept] = await db.insert(concepts).values({ instituteId, name: `Concept ${instituteId}` }).returning();
    await db.insert(masteryState).values({ studentId: adaId, conceptId: concept!.id, instituteId, pKnow: 0.3 });
    const [question] = await db
      .insert(questions)
      .values({
        instituteId,
        statement: "Explain question",
        difficulty: 1,
        languages: ["javascript", "java", "cpp"],
        starterCodeJson: { javascript: "", java: "", cpp: "" },
        status: "published",
        referenceSolution: secret,
      })
      .returning();
    await db.insert(tests).values({
      questionId: question!.id,
      instituteId,
      visibility: "hidden",
      input: hiddenInput,
      expectedOutput: hiddenOutput,
    });
    const [consent] = await db.insert(consents).values({ instituteId, studentId: adaId, policyVersion: "test" }).returning();
    const [session] = await db
      .insert(learningSessions)
      .values({ instituteId, studentId: adaId, questionId: question!.id, mode: "graded", consentId: consent!.id })
      .returning();
    const [practice] = await db
      .insert(learningSessions)
      .values({ instituteId, studentId: adaId, questionId: question!.id, mode: "practice" })
      .returning();
    const [attempt] = await db
      .insert(attempts)
      .values({ instituteId, sessionId: session!.id, kind: "submit", language: "javascript", code: js, passRate: 1 })
      .returning();
    const [java] = await db
      .insert(attempts)
      .values({
        instituteId,
        sessionId: session!.id,
        kind: "submit",
        language: "java",
        code: "public class Main {\n  public static void main(String[] args) {\n    System.out.println(4);\n  }\n}\n",
        passRate: 1,
      })
      .returning();
    const [cpp] = await db
      .insert(attempts)
      .values({
        instituteId,
        sessionId: session!.id,
        kind: "submit",
        language: "cpp",
        code: "#include <iostream>\nint main() {\n  std::cout << 4;\n}\n",
        passRate: 1,
      })
      .returning();
    const [practiceAttempt] = await db
      .insert(attempts)
      .values({ instituteId, sessionId: practice!.id, kind: "submit", language: "javascript", code: js, passRate: 1 })
      .returning();

    const ada = person(adaId, "student", instituteId);
    const first = await ensureExplanation(ada, attempt!.id, runner);
    const second = await ensureExplanation(ada, attempt!.id, runner);
    expect(second.id).toBe(first.id);
    expect(second.questions.map((item) => item.id)).toEqual(first.questions.map((item) => item.id));
    expect(first.codeSnapshot).toBe(js);
    expect(first.questions.length).toBeGreaterThanOrEqual(2);
    expect(first.questions.every((item) => item.verdict === null && item.answer === null)).toBe(true);
    const before = JSON.stringify(first);
    expect(before).not.toContain(secret);
    expect(before).not.toContain(hiddenOutput);
    expect(before).not.toContain(hiddenInput);
    expect(before).not.toContain("graderJson");
    expect(before).not.toContain("produced 4");

    const trainerView = await listSessionExplanations(person(trainerId, "trainer", instituteId), session!.id);
    expect(trainerView.map((item) => item.attemptId)).toContain(attempt!.id);
    expect(JSON.stringify(trainerView)).not.toContain(secret);
    expect(JSON.stringify(trainerView)).not.toContain("graderJson");
    await expect(listSessionExplanations(ada, session!.id)).rejects.toMatchObject({ statusCode: 403 });
    await expect(ensureExplanation(person(benId, "student", instituteId), attempt!.id, runner)).rejects.toMatchObject({
      statusCode: 403,
    });
    await expect(readExplanation(person(outsiderId, "trainer", instituteId), attempt!.id)).rejects.toMatchObject({
      statusCode: 403,
    });
    await expect(readExplanation(person(otherAdminId, "admin", otherInstituteId), attempt!.id)).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(ensureExplanation(ada, practiceAttempt!.id, runner)).rejects.toMatchObject({ statusCode: 400 });

    const trace = first.questions.find((item) => item.prompt.includes("total(2)") && item.type === "trace");
    const edge = first.questions.find((item) => item.type === "edge");
    const mutation = first.questions.find((item) => item.type === "mutation");
    expect(trace && edge && mutation).toBeTruthy();
    const answered = await answerExplanation(ada, attempt!.id, [
      { id: trace!.id, text: "3" },
      { id: edge!.id, text: "0 and 9" },
      { id: mutation!.id, text: "nope" },
    ]);
    expect(answered.questions.find((item) => item.id === trace!.id)?.verdict).toBe("yes");
    expect(answered.questions.find((item) => item.id === edge!.id)?.verdict).toBe("partial");
    expect(answered.questions.find((item) => item.id === mutation!.id)?.verdict).toBe("no");
    expect(answered.status).toBe("answered");
    const repeated = await answerExplanation(ada, attempt!.id, [
      { id: trace!.id, text: "999" },
      { id: edge!.id, text: "999" },
      { id: mutation!.id, text: "999" },
    ]);
    expect(repeated.questions.find((item) => item.id === trace!.id)?.answer).toBe("3");
    const storedQuestions = await db.select().from(explainQa).where(eq(explainQa.attemptId, attempt!.id));
    expect(storedQuestions).toHaveLength(first.questions.length);

    await db.update(attempts).set({ code: "changed" }).where(eq(attempts.id, attempt!.id));
    const reread = await readExplanation(ada, attempt!.id);
    expect(reread.codeSnapshot).toBe(js);
    expect(JSON.stringify(reread)).not.toContain(secret);
    expect(JSON.stringify(reread)).not.toContain(hiddenOutput);

    const reviewed = await listSessionExplanations(person(adminId, "admin", instituteId), session!.id);
    const trainerAfter = reviewed.find((item) => item.attemptId === attempt!.id);
    expect(trainerAfter?.questions.find((item) => item.id === trace!.id)?.answer).toBe("3");
    expect(trainerAfter?.questions.find((item) => item.id === trace!.id)?.evidence.join(" ")).toContain("produced 3");
    expect(JSON.stringify(reviewed)).not.toContain(secret);

    const javaSet = await ensureExplanation(ada, java!.id, runner);
    const cppSet = await ensureExplanation(ada, cpp!.id, runner);
    expect(javaSet.questions.some((item) => item.type === "trace")).toBe(true);
    expect(cppSet.questions.some((item) => item.type === "trace")).toBe(true);
    const javaReason = javaSet.questions.find((item) => item.type === "reasoning");
    expect(javaReason).toBeTruthy();
    await db
      .update(explainQa)
      .set({ graderJson: { method: "facts", expected: null, tokens: [], literal: null } })
      .where(eq(explainQa.id, javaReason!.id));
    const javaAnswered = await answerExplanation(
      ada,
      java!.id,
      javaSet.questions.map((item) => ({ id: item.id, text: item.type === "trace" ? "4" : "System prints 4" })),
    );
    expect(javaAnswered.questions.find((item) => item.id === javaReason!.id)?.verdict).toBeNull();
    expect(javaAnswered.questions.find((item) => item.id === javaReason!.id)?.reviewStatus).toBe("needs_review");
    expect(javaAnswered.questions.find((item) => item.type === "trace")?.verdict).toBe("yes");

    const [mastery] = await db.select().from(masteryState).where(eq(masteryState.studentId, adaId));
    expect(mastery?.pKnow).toBeCloseTo(0.3);
    const updates = await db.select().from(masteryUpdates).where(eq(masteryUpdates.studentId, adaId));
    expect(updates).toHaveLength(0);
    const [saved] = await db.select().from(attempts).where(eq(attempts.id, attempt!.id));
    expect(saved?.passRate).toBe(1);
    const raised = await db.select().from(signals).where(eq(signals.sessionId, session!.id));
    expect(raised).toHaveLength(0);
    const sets = await db.select().from(explainSets).where(eq(explainSets.attemptId, attempt!.id));
    expect(sets).toHaveLength(1);
  });
});
