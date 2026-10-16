import { eq, inArray, sql } from "drizzle-orm";
import { closeDatabase, db } from "../db/index.ts";
import { lessons, masteryState, user } from "../db/schema/index.ts";

const ids = [
  "e9434b61-2069-43ff-a805-66ca98f78f27",
  "83394199-a40e-4e10-a273-186dddb3eee0",
];
const cjk = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/;

function walk(value, path, hits) {
  if (typeof value === "string") {
    if (!cjk.test(value)) return;
    const parts = [];
    const re = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]+/g;
    for (const match of value.matchAll(re)) {
      const start = Math.max(0, match.index - 24);
      const end = Math.min(value.length, match.index + match[0].length + 24);
      parts.push(value.slice(start, end).replace(/\s+/g, " "));
    }
    hits.push({ path, parts });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, `${path}[${index}]`, hits));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) walk(child, `${path}.${key}`, hits);
  }
}

const rows = await db
  .select({
    id: lessons.id,
    title: lessons.title,
    status: lessons.status,
    languageDirective: lessons.languageDirective,
    version: lessons.version,
    conceptId: lessons.conceptId,
    publishedAt: lessons.publishedAt,
    outlineJson: lessons.outlineJson,
    scenesJson: lessons.scenesJson,
  })
  .from(lessons)
  .where(inArray(lessons.id, ids));

const target = rows.find((row) => row.id === "e9434b61-2069-43ff-a805-66ca98f78f27");
const scene3 = target?.scenesJson?.[2];
const scene6 = target?.scenesJson?.[5];
const elements = scene3?.content?.canvas?.elements ?? [];
console.log(
  JSON.stringify(
    {
      scene3: elements.map((element, index) => ({ index, type: element.type, content: element.content ?? null })),
      scene6: (scene6?.content?.canvas?.elements ?? []).map((element, index) => ({
        index,
        type: element.type,
        content: element.content ?? null,
      })),
    },
    null,
    2,
  ),
);

for (const row of rows) {
  const scenes = Array.isArray(row.scenesJson) ? row.scenesJson : [];
  const hits = [];
  walk(row.scenesJson, "scenes", hits);
  const summary = scenes.map((scene) => ({
    id: scene.id,
    outlineId: scene.outlineId,
    type: scene.type,
    title: scene.title,
    order: scene.order,
  }));
  console.log(
    JSON.stringify(
      {
        id: row.id,
        title: row.title,
        status: row.status,
        languageDirective: row.languageDirective,
        version: row.version,
        conceptId: row.conceptId,
        publishedAt: row.publishedAt,
        sceneCount: scenes.length,
        outlineCount: Array.isArray(row.outlineJson) ? row.outlineJson.length : 0,
        scenes: summary,
        cjk: hits,
      },
      null,
      2,
    ),
  );
}

const ada = await db.select({ id: user.id }).from(user).where(eq(user.email, "ada@techsummit.example")).limit(1);
const studentId = ada[0]?.id;
if (studentId) {
  const mastery = await db
    .select({ conceptId: masteryState.conceptId, pKnow: masteryState.pKnow })
    .from(masteryState)
    .where(eq(masteryState.studentId, studentId));
  const counts = await db.execute(sql`
    select
      (select count(*) from mastery_updates where student_id = ${studentId}) as updates,
      (select count(*) from attempts where session_id in (select id from learning_sessions where student_id = ${studentId})) as attempts,
      (select count(*) from signals where student_id = ${studentId}) as signals
  `);
  console.log(JSON.stringify({ mastery, counts: counts.rows ?? counts }, null, 2));
}

await closeDatabase();
