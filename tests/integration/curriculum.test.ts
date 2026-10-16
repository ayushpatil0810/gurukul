import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { institutes, user } from "@/db/schema";
import type { Actor } from "@/lib/auth/actor";
import { addPrerequisite, createConcept } from "@/lib/services/concepts";
import { createQuestion, getQuestion, listQuestions } from "@/lib/services/questions";

const instituteId = crypto.randomUUID();
const trainerId = crypto.randomUUID();
const hiddenInput = `HIDDEN_INPUT_${instituteId}`;
const hiddenExpected = `HIDDEN_EXPECTED_${instituteId}`;

const trainer: Actor = {
  id: trainerId,
  name: "Trainer",
  email: `${trainerId}@example.com`,
  role: "trainer",
  instituteId,
};

afterAll(async () => {
  await db.delete(user).where(eq(user.id, trainerId));
  await db.delete(institutes).where(eq(institutes.id, instituteId));
  const { closeDatabase } = await import("@/db");
  await closeDatabase();
});

describe("curriculum services against postgres", () => {
  it("rejects a prerequisite cycle and omits hidden tests from question responses", async () => {
    await db.insert(institutes).values({ id: instituteId, name: `Curriculum ${instituteId}` });
    await db.insert(user).values({
      id: trainerId,
      name: "Trainer",
      email: `${trainerId}@example.com`,
      emailVerified: true,
      role: "trainer",
      instituteId,
    });

    const variables = await createConcept(trainer, { name: `Variables ${instituteId}` });
    const functions = await createConcept(trainer, { name: `Functions ${instituteId}` });
    const classes = await createConcept(trainer, { name: `Classes ${instituteId}` });
    await addPrerequisite(trainer, functions.id, variables.id);
    await addPrerequisite(trainer, classes.id, functions.id);

    await expect(addPrerequisite(trainer, variables.id, classes.id)).rejects.toMatchObject({
      statusCode: 409,
    });
    await expect(addPrerequisite(trainer, variables.id, classes.id)).rejects.toThrow(/cycle/i);

    const created = await createQuestion(trainer, {
      statement: `Add ${instituteId}`,
      difficulty: 2,
      languages: ["javascript"],
      starterCode: { javascript: "console.log('todo')" },
      conceptIds: [functions.id],
      status: "published",
      referenceSolution: "console.log('secret reference')",
      tests: [
        { visibility: "visible", input: "1 2\n", expectedOutput: "3\n" },
        { visibility: "hidden", input: hiddenInput, expectedOutput: hiddenExpected },
      ],
    });

    const listed = await listQuestions(trainer);
    const fetched = await getQuestion(trainer, created.id);
    for (const payload of [created, fetched, ...listed]) {
      const serialized = JSON.stringify(payload);
      expect(serialized).not.toContain(hiddenInput);
      expect(serialized).not.toContain(hiddenExpected);
      expect(serialized).not.toContain("secret reference");
    }

    const hidden = created.tests.find((test) => test.visibility === "hidden");
    expect(hidden).toEqual({ id: expect.any(String), visibility: "hidden" });
    expect(Object.keys(hidden ?? {}).sort()).toEqual(["id", "visibility"]);
  });
});
