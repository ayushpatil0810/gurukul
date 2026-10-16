# Progress

Adaptive Learning and Assessment Portal for TechSummitTrainers. The working PRD is `prd.md`. The app is the existing Next.js project. Phase 0, Phase 1, the Phase 2 telemetry repair, the trainer replay player, and integrity review are done. Explain-your-code and dashboards are not.

## How to run

```text
.\make.cmd seed
bun run dev
bun run telemetry
```

The portal is at http://localhost:3000. Session events go to ws://localhost:3001, with an HTTP batch fallback if that socket is down. `bun run worker` starts the BullMQ sandbox worker. The request path also runs code through an in-process queue, so the worker is optional for local use.

Demo password: `PortalDemo!2026`

| Email | Role |
|---|---|
| admin@techsummit.example | admin |
| trainer@techsummit.example | trainer |
| ada@techsummit.example | student |
| ben@techsummit.example | student |
| cara@techsummit.example | student |

Postgres is on host port 5433. Redis is on 6379. GNU make is not installed on this machine; `make.cmd` is the Windows path. `bun test` runs the unit tests, the database tests, and the sandbox red-team suite.

## Phase 0 — Foundations

Done.

- Postgres, Redis, Drizzle schema for the PRD data model, and Better Auth roles (`student`, `trainer`, `admin`). Role and institute are reloaded from the database on every request.
- Concept-map create, edit, and delete. A prerequisite that would close a cycle is rejected with the named path.
- Question bank with visible and hidden tests. Hidden inputs, expected outputs, and reference solutions stay off API responses, including trainer responses.
- Login, role navigation, concept map, and trainer question list.
- Seed: TechSummitTrainers, October 2026 batch, one module (TypeScript OOP), the chain Variables → Functions → Classes and Objects → Inheritance → Dependency Injection, and 14 published JavaScript questions.

Exit checks: seed logins succeed for every role; a student cannot read another student; a cycle returns 409; hidden test bodies are absent from question payloads.

## Phase 1 — Walking skeleton

Done.

- Sandbox. JavaScript, C++, and Java run in a fresh container and the container is removed afterward. Controls: no network, read-only root, scratch tmpfs, non-root user, dropped capabilities, seccomp, CPU and wall limits, 256 MB memory, 64 processes, 64 KB output. gVisor (`runsc`) is not installed, so the runner uses hardened Docker and will pass `--runtime runsc` when that runtime exists. Expected output is compared on the host and never enters the container.
- Queue. In-process pool, about 10 runs per student per minute, and a BullMQ worker that calls the same runner.
- Assessment. Practice can start immediately. Graded sessions require a stored consent row. Run returns stdout, stderr, exit status, and timing for visible tests. Submit returns pass/fail counts and a category per hidden test.
- Practice page. Monaco editor, language selector, Run, Submit, the routing reason, and a persistent “This session is being recorded” line on graded sessions.
- Telemetry. Editor events carry sequence numbers. The server appends them, stores a hash of the previous event, and writes a data-quality note when a sequence is missing. The client buffers and retries. WebSocket ingest is `bun run telemetry`; `POST /api/sessions/:id/events` is the fallback.
- Mastery. Pure BKT (`p_init` 0.20, learn 0.15, slip 0.10, guess 0.20). A hidden submit counts as correct only when every hidden test passes. Partial credit is stored as the pass rate. Graded submits update `mastery_state` and `mastery_updates`.
- Selector. Ready concepts are those whose direct prerequisites are at or above 0.80. Among ready concepts still below that line, the lowest mastery is chosen. When every ancestor is at the threshold, the goal is chosen. The question nearest a 70% predicted success is chosen. The decision, reason, and alternatives are stored.

Seeded routes for TypeScript OOP:

- Ada: Functions at 0.30 (Variables already 0.90).
- Ben: Classes and Objects at 0.35.
- Cara: cold start, so Variables.

Exit checks: those two routes differ and the reasons are visible; the red-team suite passes; hidden tests are absent from learning and submit responses; a session timeline reads back in order, with a gap filled by a data-quality event; BKT unit tests match the hand-computed updates (a correct answer from 0.20 becomes 0.60).

## Phase 2 — Telemetry repair

Implemented and checked against `docs/PHASE2_TELEMETRY.md`.

The log can reconstruct a document when every editor event has a schema 2 range, inserted text, and removed text, and none of those events overlap or fall outside the document. Anything else fails without inventing text. Acknowledgements remove only confirmed sequences. New gap notes use server sequences at or above `1000001` and do not change mastery. Historical gap notes stay on their old sequences, the hash chain still verifies, and a late event does not replace them.

Verified on that pass:

- `bun run test` passed 27 files and 104 tests, including editor reconstruction, acknowledgement, hash-chain, authorization, consent, and the assessment database tests. The assessment file was run again after asserting that a historical gap row keeps `receivedAt` null, and it passed.
- `bun run lint` passed.
- `bun run typecheck` passed.
- `bun run build` passed on Next.js 16.4.2.

The live `bun run telemetry` process was not started in that pass. WebSocket and HTTP ingest share `appendEvents`; that service path was tested, and the socket handler was read. Migration `0002_strong_onslaught` was already applied on the local database.

## Phase 2 — Trainer replay

Implemented and checked against `docs/PHASE2_REPLAY.md`.

Trainers and admins open `/replay` and `/replay/:sessionId`. Access uses `decideReplayRead`: a trainer needs a shared batch, an admin needs the same institute, and a student is refused even for their own session. The page rebuilds the editor with `reconstructDocument`. Incomplete, overlapping, missing-baseline, and sequence-gap points hide the editor and name the range. A gap is not presented as misconduct.

Seeded recordings after `.\make.cmd seed`:

- http://localhost:3000/replay/demo-replay-valid
- http://localhost:3000/replay/demo-replay-incomplete

Checked in this pass:

- `bun run test` passed 29 files and 117 tests, including replay reconstruction, playback, and authorization.
- `bun run lint` passed.
- `bun run typecheck` passed.
- `bun run build` passed on Next.js 16.4.2. The replay route awaits its params inside a Suspense child, and the root navigation is inside Suspense, which this Next.js version requires for a dynamic page.

Browser, signed in as `trainer@techsummit.example` on the already running dev server at port 3000:

- `/replay` listed Ada's sessions, including the two seeded recordings.
- On `demo-replay-valid`, play ran to the end, pause stopped the clock at 1.683s on the second insert, previous and next moved one event, selecting an event moved the slider, and 0.5× was selected. The editor showed `function total(n) { return n + 1; }` after the second insert.
- On `demo-replay-incomplete`, the first insert showed `let value = 1`. The incomplete insert and the recording gap hid the editor, named the range, and said the gap is a limit of the recording rather than misconduct.

Not exercised in the browser: dragging the slider (automation exposed it as readonly even while its value tracked playback), Space and arrow keys on the replay region, and a signed-in student opening replay. Student and guessed-id refusal are covered by `tests/integration/replay-access.test.ts`.

## Phase 2 — Integrity review

Implemented and checked against `docs/PHASE2_INTEGRITY_REVIEW.md`.

Graded sessions produce four review patterns from the stored event log: large paste, unusual typing burst, no write-run-fix iteration, and unusually uniform typing. The queue is `/review`. A signal opens the replay at its start time. Dismiss and needs viva can omit a note. Escalate requires one. Reviewer and time are set on the server, and each decision is appended. A later event that removes the pattern keeps the row and its reviews, and drops it from the queue. Students are refused. A gap does not become a pattern.

Seeded recording after `.\make.cmd seed`: http://localhost:3000/replay/demo-review-paste

Checked in this pass:

- `bun run test` passed 31 files and 127 tests, including the four signal boundaries, insufficient evidence, gaps, ordinary edits, idempotent detection, late events, replay links, batch and institute access, student denial, server-set reviewer and time, review history, and unchanged mastery and pass rate.
- `bun run lint` passed.
- `bun run typecheck` passed.
- `bun run build` passed on Next.js 16.4.2.
- `bun run db:migrate` applied `0003_aberrant_nomad`. `bun run db:seed` wrote the demo review session.

Browser, signed in as `trainer@techsummit.example` on the dev server at port 3000:

- `/review` listed Ada's large paste (high, pending, 0:05.0) above the no-run pattern (medium, 0:08.0), with batch, pattern, and status filters.
- The large-paste page showed the measured counts, the clipboard context, and dismiss / needs viva / escalate. No decision was saved, so the seeded item stays pending.
- Opening `/replay/demo-review-paste?t=5000&from=5000&to=5000` showed the evidence-range notice, the slider at 5000, and the paste event selected.

Clicks on the queue and the replay link did not navigate during automation; a hydration overlay was present. The same URLs opened correctly with direct navigation.

## Not started

The rest of Phase 2: explain-your-code and dashboards. Per-batch threshold tuning and student-visible signals stay P1. Periodic snapshots and trainer notes from the PRD are not built. A keepalive batch that never reached the server still cannot be replayed.

Phase 3: CI hardening beyond the current red-team run, the demo seed in PRD 13.1, remaining P1 items, accessibility, the README, and the PRD 13.2 pass/fail report.

## Deferred inside the finished phases

- Question edit and delete exist as APIs. The trainer UI is a list plus create.
- A question tagged with several concepts gets the same observation on each tag. The PRD’s weighted split (AE-3) is P1.
- The selector may repeat a question after that concept’s unattempted bank is empty. Refusing repeats until then (NQ-5) is P1.
- Explain-your-code evidence (AE-5) waits for Phase 2.

Choices that are easy to miss later are in `docs/DECISIONS.md`.
