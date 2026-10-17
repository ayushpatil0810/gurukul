import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { institutes, user } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { createConcept, createModule } from "@/lib/services/concepts";
import { createQuestion } from "@/lib/services/questions";
import {
  getPracticeCatalog,
  getPracticeQuestionDetail,
} from "@/lib/services/practice";
import { runSession, startSession, submitSession } from "@/lib/services/assessment";
import { RunQueue } from "@/sandbox/queue";
import type { SandboxRunner } from "@/sandbox/types";

const instituteId = crypto.randomUUID();
const trainerId = crypto.randomUUID();
const studentId = crypto.randomUUID();

const trainer: Actor = {
  id: trainerId,
  name: "Taylor Trainer",
  email: `${trainerId}@example.com`,
  role: "trainer",
  instituteId,
};

const student: Actor = {
  id: studentId,
  name: "Ada Student",
  email: `${studentId}@example.com`,
  role: "student",
  instituteId,
};

const mockRunner: SandboxRunner = {
  async run(_language, _code, stdin) {
    const tokens = stdin.trim().split(/\s+/);
    let out = "5\n";
    if (tokens.length >= 2) {
      const sum = Number(tokens[0]) + Number(tokens[1]);
      out = `${sum}\n`;
    }
    return {
      outcome: "ok",
      stdout: out,
      stderr: "",
      exitCode: 0,
      timedOut: false,
      durationMs: 5,
      message: "The program completed successfully.",
    };
  },
};

const deps = {
  runner: mockRunner,
  queue: new RunQueue({ concurrency: 2, perStudentPerMinute: 30 }),
};

afterAll(async () => {
  await db.delete(user).where(eq(user.instituteId, instituteId));
  await db.delete(institutes).where(eq(institutes.id, instituteId));
  const { closeDatabase } = await import("@/db");
  await closeDatabase();
});

describe("Practice Lab (LeetCode Style, Modular, Ungraded)", () => {
  it("enforces student isolation, presents challenges by module, and operates in ungraded practice mode", async () => {
    // 1. Create institute & users
    await db.insert(institutes).values({ id: instituteId, name: `Practice Lab Test ${instituteId}` });
    await db.insert(user).values([
      {
        id: trainerId,
        email: trainer.email,
        name: trainer.name,
        role: "trainer",
        instituteId,
        emailVerified: true,
      },
      {
        id: studentId,
        email: student.email,
        name: student.name,
        role: "student",
        instituteId,
        emailVerified: true,
      },
    ]);

    // 2. Create concept & module
    const concept = await createConcept(trainer, {
      name: "Algorithms & Arithmetic",
      description: "Fundamental arithmetic operations and I/O parsing.",
    });

    const module = await createModule(trainer, {
      name: "Algorithmic Foundations",
      goalConceptId: concept.id,
      masteryThreshold: 0.8,
      conceptIds: [concept.id],
    });

    // 3. Create published questions with visible and hidden tests
    const q1 = await createQuestion(trainer, {
      statement: "Read two integers and print their sum.",
      difficulty: 1,
      languages: ["javascript"],
      starterCode: {
        javascript: "const fs = require('fs');\nconst [a, b] = fs.readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number);\nconsole.log(a + b);\n",
      },
      conceptIds: [concept.id],
      status: "published",
      tests: [
        { visibility: "visible", input: "2 3\n", expectedOutput: "5\n" },
        { visibility: "hidden", input: "10 20\n", expectedOutput: "30\n" },
      ],
    });

    const q2 = await createQuestion(trainer, {
      statement: "Write a function that returns the factorial of n for n up to 10.",
      difficulty: 3,
      languages: ["javascript"],
      starterCode: {
        javascript: "function factorial(n) { return n <= 1 ? 1 : n * factorial(n - 1); }\n",
      },
      conceptIds: [concept.id],
      status: "published",
      tests: [
        { visibility: "visible", input: "5\n", expectedOutput: "120\n" },
        { visibility: "hidden", input: "3\n", expectedOutput: "6\n" },
      ],
    });

    // 4. Test Catalog retrieval
    const catalog = await getPracticeCatalog(student, module.id);
    expect(catalog.student.id).toBe(student.id);
    expect(catalog.activeModuleId).toBe(module.id);
    expect(catalog.challenges.length).toBe(2);

    const challenge1 = catalog.challenges.find((c) => c.id === q1.id);
    expect(challenge1).toBeDefined();
    expect(challenge1?.title).toBe("Sum of Two Integers from Stdin");
    expect(challenge1?.difficultyLabel).toBe("Easy");
    expect(challenge1?.conceptName).toBe("Algorithms & Arithmetic");
    expect(challenge1?.status).toBe("todo");

    const challenge2 = catalog.challenges.find((c) => c.id === q2.id);
    expect(challenge2).toBeDefined();
    expect(challenge2?.difficultyLabel).toBe("Medium");

    expect(catalog.stats.total).toBe(2);
    expect(catalog.stats.solved).toBe(0);
    expect(catalog.stats.easy.total).toBe(1);
    expect(catalog.stats.medium.total).toBe(1);

    // 5. Test Question Detail retrieval (LeetCode format)
    const detail = await getPracticeQuestionDetail(student, q1.id);
    expect(detail.id).toBe(q1.id);
    expect(detail.title).toBe("Sum of Two Integers from Stdin");
    expect(detail.difficultyLabel).toBe("Easy");
    expect(detail.examples.length).toBeGreaterThanOrEqual(1);
    expect(detail.constraints.length).toBeGreaterThanOrEqual(1);
    expect(detail.hints.length).toBeGreaterThanOrEqual(1);
    expect(detail.editorial).toBeDefined();
    expect(detail.editorial.complexity.time).toBeDefined();
    expect(detail.allChallenges.length).toBe(2);

    // 6. Test Practice Session Execution (Strictly Practice & Ungraded)
    const practiceSession = await startSession(student, {
      questionId: q1.id,
      mode: "practice",
    });
    // In practice mode, recording is false and no consent is required
    expect(practiceSession.mode).toBe("practice");
    expect(practiceSession.recording).toBe(false);

    // Run sample tests
    const runResult = await runSession(
      student,
      practiceSession.id,
      {
        language: "javascript",
        code: "const fs = require('fs');\nconst [a, b] = fs.readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number);\nconsole.log(a + b);",
      },
      deps,
    );
    expect(runResult.tests.length).toBe(1);
    expect(runResult.tests[0].passed).toBe(true);

    // Submit solution (ungraded)
    const submitResult = await submitSession(
      student,
      practiceSession.id,
      {
        language: "javascript",
        code: "const fs = require('fs');\nconst [a, b] = fs.readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number);\nconsole.log(a + b);",
      },
      deps,
    );
    expect(submitResult.correct).toBe(true);
    // Crucial invariance: Practice mode MUST NOT mutate mastery!
    expect(submitResult.mastery).toEqual([]);

    // 7. Verify status is now 'solved' in catalog
    const updatedCatalog = await getPracticeCatalog(student, module.id);
    const updatedChallenge1 = updatedCatalog.challenges.find((c) => c.id === q1.id);
    expect(updatedChallenge1?.status).toBe("solved");
    expect(updatedCatalog.stats.solved).toBe(1);
  });
});
