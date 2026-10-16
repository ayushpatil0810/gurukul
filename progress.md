# Progress

Adaptive Learning and Assessment Portal for TechSummitTrainers. The working PRD is `prd.md`. The app is the existing Next.js project. Phase 0, Phase 1, the Phase 2 telemetry, replay, integrity review, and explain-your-code steps, and the Phase 3 student and trainer dashboards are done.

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

## Phase 2 — Explain your code

Implemented and checked against `docs/PHASE2_EXPLAIN_CODE.md`.

A graded submission can be followed by two or three questions about that submission. Practice does not show the step. The questions cite a line in the submitted code or a sandbox run of it. There is one explanation set per attempt, and it keeps a copy of the code from the moment the questions were created. Answering twice keeps the first verdicts.

No model is installed, so none is called. A reasoning answer is scored from the name and literal on the cited line. If a line has nothing to check, the verdict is empty and the row needs review. An incorrect explanation does not change the hidden-test score, mastery, or an integrity signal. The PRD calls explanation results lower-weight mastery evidence and does not give a weight, so this step does not invent one.

Checked in this pass:

- `bun run test` passed 33 files and 133 tests, including grounded generation, the safe fallback, JavaScript, Java, and C++, correct, partial, incorrect, and insufficient answers, the immutable snapshot, duplicate creation, a second answer, hidden-test and reference-solution confidentiality, and student, trainer, and institute access.
- `bun run lint` passed.
- `bun run typecheck` passed.
- `bun run build` passed on Next.js 16.4.2.
- `bun run db:migrate` applied `drizzle/0004_explain_code.sql`.

Browser, on the dev server at port 3000:

- Signed in as `ada@techsummit.example`, switched practice to Graded, and submitted the factorial starter. The page showed three questions about that code, including what `factorial(2)` returns, with the cited lines.
- The answers were recorded. `2` was incorrect because that function returned 0. `factorial` and `console` were correct. The page said the answers were recorded.
- Ada opening `/replay/87aa8a56-0d0f-45a8-a1e8-902c35cbab7d` was told she does not have access.
- Signed in as `trainer@techsummit.example`, that replay showed the submitted code, the three questions, the original answers, the verdicts, the evidence, the method, and the confidence.

That graded submit failed the hidden test, so Functions mastery moved from 0.30 to 0.19, and the existing no-run review signal was stored. The explanation did not make either change. Reseed if you want the demo mastery back.

A Next.js hydration badge was open on the practice page. Submit could be clicked after the badge was collapsed.

## Phase 3 — Student and trainer dashboards

Implemented and checked against `docs/PHASE3_DASHBOARDS.md`.

`/dashboard` is the signed-in student’s own mastery, or a trainer or admin batch heatmap. `/dashboard/students/:id` is the trainer or admin drill-down. Mastery is the stored `mastery_state.p_know` value. A missing row stays “Not recorded” and is not shown as 0 or as the selector’s 0.20 start. The only band cutoff is the module threshold (seeded 0.80). The next step calls `previewRoute`, which does not insert a routing decision. Explanation verdicts stay in their own column. Students do not get replay links. No schema change and no new API route.

Checked in this pass:

- `bun run test` passed 35 files and 137 tests, including dashboard bands and the dashboard access integration test. An earlier run of those two files alone passed 4 tests. The full suite was 33 files and 133 tests before this step.
- `bun run lint` passed after the dashboard pages stopped returning JSX from inside `try/catch`.
- `bun run typecheck` passed.
- `bun run build` passed on Next.js 16.4.2. New routes: `/dashboard` and `/dashboard/students/[id]`.
- No migration was added. `bun run db:migrate` and `bun run db:seed` were not run. Existing rows were left in place.

Browser, on the dev server already listening at port 3000:

- Signed in as `trainer@techsummit.example`. October 2026 showed Ada Variables solid 90% (0.90) and Functions below threshold 19% (0.19); Ben Variables 95% (0.95), Functions 90% (0.90), Classes and Objects 35% (0.35); Cara not recorded on every concept. Inheritance and Dependency Injection had no stored mastery and the page said they are not treated as zero.
- The cohort table listed Functions at 55% (0.55), 2 of 3 stored, 1 of 2 below the threshold, 1 student blocking a later concept, and Classes and Objects at 35% (0.35), 1 of 3 stored, 1 of 1 below, 1 blocking. Population was the students enrolled in October 2026.
- The review section said 3 pending patterns do not change a grade or mastery, and linked to `/review`. Graded rows linked to replay.
- Ada’s drill-down showed the selector reason, stored 19% (0.19) separate from the predicted 30% (0.30), the graded move from 0.30 to 0.19, factorial hidden tests 0/1 with explanation “2 correct, 1 incorrect”, and the minimum question 0/1 with “No explanation”. Those question titles linked to replay.
- Signed in as `ada@techsummit.example`. Her dashboard showed the same own records, a Practice link, and no replay link. Ben and Cara were not on the page.
- Opening Ben’s `/dashboard/students/:id` showed “You can only access your own data”. Opening `/replay/87aa8a56-0d0f-45a8-a1e8-902c35cbab7d` showed “You do not have access to this recording”.
- At a 390px width the page itself did not overflow. The concept and submission tables scrolled inside their own regions. The nav links stay hidden below the existing `md` breakpoint.

Not exercised in the browser: an admin account, an empty batch, Cara’s own dashboard, and keyboard-only traversal of the heatmap. Batch, institute, empty-batch, and missing-mastery cases are in `tests/integration/dashboard-access.test.ts`.

Ada’s Functions value is 0.19 because the earlier graded factorial submit failed the hidden test. The dashboard did not change it. Reseed if you want the demo mastery back at 0.30.

## Not started

Per-batch threshold tuning and student-visible signals stay P1. Periodic snapshots and trainer notes from the PRD are not built. A keepalive batch that never reached the server still cannot be replayed.

Still out of this milestone: mastery trend charts (SD-4, P1), CSV export (TD-5, P1), module and date filters (TD-6, P1), and the institute summary (AD-1 and AD-2, P2). Explanation results are stored and are not applied to mastery. AE-5 does not give a numeric weight.

Phase 3 remaining: CI hardening beyond the current red-team run, the demo seed in PRD 13.1, the README, and the PRD 13.2 pass/fail report.

## Deferred inside the finished phases

- Question edit and delete exist as APIs. The trainer UI is a list plus create.
- A question tagged with several concepts gets the same observation on each tag. The PRD’s weighted split (AE-3) is P1.
- The selector may repeat a question after that concept’s unattempted bank is empty. Refusing repeats until then (NQ-5) is P1.
- Explanation results are stored and are not applied to mastery. AE-5 does not give a numeric weight.

Choices that are easy to miss later are in `docs/DECISIONS.md`.
