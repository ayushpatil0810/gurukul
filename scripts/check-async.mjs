import { eq } from "drizzle-orm";
import { closeDatabase, db } from "../db/index.ts";
import { lessons, user } from "../db/schema/index.ts";
import { previewScenes } from "../lib/engine/lesson-preview.ts";
import { checkCodeSyntax, inspectLesson } from "../lib/engine/lesson-quality.ts";
import { saveSceneEdits } from "../lib/services/lessons.ts";

const lessonId = "83394199-a40e-4e10-a273-186dddb3eee0";
const [row] = await db.select().from(lessons).where(eq(lessons.id, lessonId));
const views = previewScenes(row.scenesJson, false, "javascript");
const samples = views.flatMap((scene) =>
  scene.blocks.flatMap((block) => (block.kind === "code" ? [{ title: scene.title, status: checkCodeSyntax(block.code, "javascript").status, start: block.code.slice(0, 80) }] : [])),
);
console.log(JSON.stringify({ issues: inspectLesson(row.scenesJson, row.languageDirective), samples, summary: views.at(-2)?.paragraphs?.[0]?.slice(0, 180) }, null, 2));

if (process.argv.includes("--edit")) {
  const [trainer] = await db.select().from(user).where(eq(user.email, "trainer@techsummit.example"));
  const summary = views.find((scene) => scene.title === "Summary and Takeaways");
  const saved = await saveSceneEdits(
    { id: trainer.id, name: trainer.name, email: trainer.email, role: "trainer", instituteId: trainer.instituteId },
    lessonId,
    row.version,
    [
      {
        id: summary.id,
        title: summary.title,
        body: `${summary.paragraphs.join("\n\n")}\n\nNext, write one small async function and name what it returns.`,
        questions: summary.questions.map((question) => ({ id: question.id, prompt: question.prompt, options: question.options })),
      },
    ],
  );
  const [again] = await db.select().from(lessons).where(eq(lessons.id, lessonId));
  const reread = previewScenes(again.scenesJson, false, "javascript");
  console.log(
    JSON.stringify({
      editedVersion: saved.version,
      storedVersion: again.version,
      editedIssues: saved.issues.filter((issue) => issue.severity === "error"),
      persisted: reread.find((scene) => scene.id === summary.id)?.paragraphs.join(" ").includes("name what it returns"),
      otherCode: reread.filter((scene) => scene.id !== summary.id).flatMap((scene) => scene.blocks.filter((block) => block.kind === "code")).length,
    }),
  );
}

await closeDatabase();
