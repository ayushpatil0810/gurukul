import { eq } from "drizzle-orm";
import { closeDatabase, db } from "../db/index.ts";
import { lessons, user } from "../db/schema/index.ts";
import { callLessonModel, lessonModelConfigured } from "../lib/engine/lesson-provider.ts";
import { generateLessonContent } from "../lib/services/lessons.ts";
import { writeFile } from "node:fs/promises";

const lessonId = "83394199-a40e-4e10-a273-186dddb3eee0";
console.log(JSON.stringify({ configured: lessonModelConfigured() }));
const [row] = await db.select().from(lessons).where(eq(lessons.id, lessonId));
const [trainer] = await db.select().from(user).where(eq(user.email, "trainer@techsummit.example"));
if (!row || !trainer?.instituteId) throw new Error("lesson or trainer missing");
console.log(JSON.stringify({ status: row.status, version: row.version, scenes: Array.isArray(row.scenesJson) ? row.scenesJson.length : 0, directive: row.languageDirective }));
const calls = [];
const record = async (system, user) => {
  const result = await callLessonModel(system, user);
  calls.push({
    edit: user.includes("EDIT MODE"),
    instruction: user.includes("Invalid example"),
    result: result.slice(0, 2500),
  });
  return result;
};
try {
  const saved = await generateLessonContent(
    { id: trainer.id, name: trainer.name, email: trainer.email, role: "trainer", instituteId: trainer.instituteId },
    lessonId,
    row.version,
    record,
  );
  console.log(
    JSON.stringify({
      status: saved.status,
      version: saved.version,
      sceneCount: saved.scenes.length,
      titles: saved.scenes.map((scene) => scene.title),
      roles: saved.scenes.map((scene) => scene.role),
      issues: saved.issues,
    }),
  );
} catch (error) {
  const message = error instanceof Error ? error.message : "generation failed";
  await writeFile("scripts/async-calls.json", JSON.stringify({ message, calls }, null, 2));
  console.log(JSON.stringify({ failed: message.slice(0, 800), calls: calls.length }));
}
await closeDatabase();
