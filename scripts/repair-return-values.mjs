import { eq, sql } from "drizzle-orm";
import { closeDatabase, db } from "../db/index.ts";
import { lessons, masteryState, user } from "../db/schema/index.ts";
import { applyPhraseRepair } from "../lib/engine/lesson-repair.ts";
import { inspectLesson } from "../lib/engine/lesson-quality.ts";
import { encodeLanguageDirective } from "../lib/engine/lesson-languages.ts";
import { saveRepairedLesson } from "../lib/services/lessons.ts";

const lessonId = "e9434b61-2069-43ff-a805-66ca98f78f27";
const repairs = [
  {
    sceneId: "scene_3",
    phrases: [
      { from: "位置", to: "Where it goes" },
      { from: "参数列表后面", to: "After the parameter list" },
      { from: "常见类型", to: "Common types" },
      { from: "作用", to: "What it does" },
      { from: "返回值必须匹配声明类型", to: "The returned value must match the declared type" },
      { from: "示例", to: "Example" },
      {
        from: "function add(a: number, b: number): number { return a + b;",
        to: "function add(a: number, b: number): number { return a + b; }",
      },
      { from: "<strong>  return a + b;</strong>", to: "<strong>  return a + b;</strong></p><p style=\"font-size:20px;\"><strong>}</strong>" },
    ],
  },
  {
    sceneId: "scene_6",
    phrases: [
      {
        from: "int add(int a, int b) { return a + b; }",
        to: "function add(a: number, b: number): number { return a + b; }",
      },
    ],
  },
];

const [row] = await db.select().from(lessons).where(eq(lessons.id, lessonId));
if (!row) throw new Error("lesson missing");
let scenes = row.scenesJson;
for (const repair of repairs) {
  const applied = applyPhraseRepair(scenes, repair.sceneId, repair.phrases);
  if (!applied.ok) throw new Error(applied.reason);
  scenes = applied.scenes;
}
const directive = encodeLanguageDirective("typescript");
const issues = inspectLesson(scenes, directive);
const unchanged = Array.isArray(row.scenesJson)
  ? row.scenesJson.every((scene, index) => {
      if (scene.id === "scene_3" || scene.id === "scene_6") return true;
      return JSON.stringify(scene) === JSON.stringify(scenes[index]);
    })
  : false;
console.log(
  JSON.stringify(
    {
      status: row.status,
      version: row.version,
      issues,
      unchanged,
      save: process.argv.includes("--save"),
    },
    null,
    2,
  ),
);
if (issues.some((issue) => issue.severity === "error")) {
  await closeDatabase();
  process.exit(1);
}
if (process.argv.includes("--save")) {
  const [trainer] = await db.select().from(user).where(eq(user.email, "trainer@techsummit.example"));
  if (!trainer?.instituteId) throw new Error("trainer missing");
  const saved = await saveRepairedLesson(
    { id: trainer.id, name: trainer.name, email: trainer.email, role: "trainer", instituteId: trainer.instituteId },
    lessonId,
    row.version,
    repairs,
    "typescript",
  );
  console.log(JSON.stringify({ savedStatus: saved.status, savedVersion: saved.version, savedIssues: saved.issues, codeLanguage: saved.codeLanguage }));
}

const [ada] = await db.select({ id: user.id }).from(user).where(eq(user.email, "ada@techsummit.example"));
if (ada) {
  const mastery = await db
    .select({ conceptId: masteryState.conceptId, pKnow: masteryState.pKnow })
    .from(masteryState)
    .where(eq(masteryState.studentId, ada.id));
  const counts = await db.execute(sql`
    select
      (select count(*) from mastery_updates where student_id = ${ada.id}) as updates,
      (select count(*) from attempts where session_id in (select id from learning_sessions where student_id = ${ada.id})) as attempts,
      (select count(*) from signals where student_id = ${ada.id}) as signals,
      (select count(*) from reviews where reviewer_id = ${ada.id} or exists (select 1 from signals s where s.id = reviews.signal_id and s.student_id = ${ada.id})) as reviews
  `);
  console.log(JSON.stringify({ mastery, counts: counts.rows ?? counts }));
}

await closeDatabase();
