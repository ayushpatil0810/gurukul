# Decisions

## 2026-10-16 — Next.js stays the application server

The PRD recommends NestJS in the working copy and FastAPI in an earlier draft. This build extends the existing Next.js App Router project. Route handlers and server-side helpers are the API. A second backend would replace the project the prompt says to keep.

## 2026-10-16 — PostgreSQL through node-postgres

The starter used the Neon HTTP driver. Local development uses Docker Compose PostgreSQL, which the `pg` driver already in the repo can reach. `DATABASE_URL` remains the single connection setting. The host port is 5433 so Compose can start when another Postgres already owns 5432.

## 2026-10-16 — Redis is provisioned and unused in Phase 0

Compose starts Redis so later workers have a broker. No queue workers are implemented in this phase.

## 2026-10-16 — Runs are queued in process and in BullMQ

The request path uses an in-process pool with a per-student limit so `bun run dev` can run code without a second process. `bun run worker` starts a BullMQ worker on Redis that calls the same `SandboxRunner`. Student code is still executed only inside the container.

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

## 2026-10-16 — Hardened Docker while gVisor is absent

`docker info` on this machine lists runc, not `runsc`. The sandbox keeps the `SandboxRunner` interface and uses hardened runc: no network, a read-only root, a scratch tmpfs, a non-root user, dropped capabilities, a pid cap, memory and CPU limits, a wall-clock kill, and an output cap. The seccomp file is Docker's default allow-list from Moby 27.5.1 with `bind`, `connect`, `listen`, `accept`, and `accept4` removed so a program cannot open a socket connection. If `runsc` shows up in `docker info`, the runner adds `--runtime runsc`.

Student source is written to the scratch tmpfs from stdin. A read-only root cannot accept `docker cp` before start, and a tmpfs mounted at start would hide a file copied earlier. Expected output is compared on the host and is never placed in the container environment. The student CPU limit is applied with `ulimit` after compilation so the compiler can finish; the container wall clock still bounds both.
