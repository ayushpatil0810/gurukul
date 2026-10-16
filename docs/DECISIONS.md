# Decisions

## 2026-10-16 — Next.js stays the application server

The PRD recommends NestJS in the working copy and FastAPI in an earlier draft. This build extends the existing Next.js App Router project. Route handlers and server-side helpers are the API. A second backend would replace the project the prompt says to keep.

## 2026-10-16 — PostgreSQL through node-postgres

The starter used the Neon HTTP driver. Local development uses Docker Compose PostgreSQL, which the `pg` driver already in the repo can reach. `DATABASE_URL` remains the single connection setting.

## 2026-10-16 — Redis is provisioned and unused in Phase 0

Compose starts Redis so later workers have a broker. No queue workers are implemented in this phase. TODO(phase-1): BullMQ workers.

## 2026-10-16 — One user table, extended for role and institute

Better Auth already owns `user`. Adding `role` and `institute_id` there avoids a second identity table. Clients cannot set either field (`input: false`), and create/update hooks force new accounts to `student` with no institute. Seed and other server code assign roles with Drizzle, not from request bodies.

## 2026-10-16 — Auth tables are the institute_id exception

`account`, `session`, and `verification` belong to Better Auth and are keyed by `user_id`. Institute membership lives on `user`. Every product table carries `institute_id` or a foreign key to a table that does.

## 2026-10-16 — Trainers are a junction, not an id array

`batches.trainer_ids` in the PRD is `batch_trainers` so each trainer is a real foreign key and batch access can be queried.

## 2026-10-16 — Learning sessions are not auth sessions

Better Auth uses the `session` table. Product sessions are stored in `learning_sessions`.

## 2026-10-16 — Test bodies live in Postgres

There is no object store in this phase. `tests.input` and `tests.expected_output`, attempt code, and reference solutions are columns. They are server-only. Client payloads never include hidden inputs or expected outputs, including for trainers.

## 2026-10-16 — Institute policy defaults

Open questions in the PRD do not fix retention or the default threshold. Seeded policy uses 180 days and a mastery threshold of 0.80, matching the module default in CM-3.
