import { eq, sql } from "drizzle-orm";
import { closeDatabase, db } from "../db/index.ts";
import { masteryState, user } from "../db/schema/index.ts";

const [ada] = await db.select({ id: user.id }).from(user).where(eq(user.email, "ada@techsummit.example"));
const mastery = await db
  .select({ conceptId: masteryState.conceptId, pKnow: masteryState.pKnow })
  .from(masteryState)
  .where(eq(masteryState.studentId, ada.id));
const counts = await db.execute(sql`
  select
    (select count(*) from mastery_updates where student_id = ${ada.id}) as updates,
    (select count(*) from attempts where session_id in (select id from learning_sessions where student_id = ${ada.id})) as attempts,
    (select count(*) from signals where student_id = ${ada.id}) as signals,
    (select count(*) from reviews r where exists (select 1 from signals s where s.id = r.signal_id and s.student_id = ${ada.id})) as reviews
`);
console.log(JSON.stringify({ mastery, counts: counts.rows ?? counts }));
await closeDatabase();
