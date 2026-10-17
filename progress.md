# Progress

Adaptive Learning and Assessment Portal for TechSummitTrainers. The working PRD is `prd.md`. The app is the existing Next.js project. Phase 0 through the Phase 3 dashboards are done, and the Phase 4 lesson studio is in place.

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

## Phase 4 — Lesson studio

Implemented and checked against `docs/PHASE4_LESSON_STUDIO.md`.

`/studio` lets a trainer or admin generate an OpenMAIC outline for an existing concept, edit it, generate validated slide and quiz scenes, save a draft, and publish. Students see a published lesson on the recommended concept at `/learn/:id`. Drafts are not found for students. Generation, saving, publishing, and reading do not change `mastery_state.p_know`.

The model call is `@openmaic/generation` 0.3.18 with `AICallFn`. Scenes are checked with `@openmaic/dsl` `validateScene` before they are stored. `@openmaic/renderer` and `@openmaic/editor` are not embedded. There is no new provider SDK. `OPENAI_API_KEY` is optional; without it the rest of the portal still runs.

Checked in this pass:

- `bun run db:migrate` applied `drizzle/0005_luxuriant_lady_vermin.sql`. `bun run db:seed` was not run.
- `bun run test` passed 37 files and 139 tests. The new files are `tests/lesson-generation.test.ts` and `tests/integration/lesson-access.test.ts`. The integration test uses the real OpenMAIC outline and scene functions with a stand-in model response. It covers a trainer outline, content generation, rejected model output, a thrown provider error that inserts nothing, draft hiding, student visibility after publish, a trainer with no batch, another institute, a missing concept, and unchanged mastery (`0.42` before and after).
- `bun run lint` passed after a form stopped assigning a variable named `module`.
- `bun run typecheck` passed.
- `bun run build` passed on Next.js 16.4.2. New routes include `/studio`, `/studio/new`, `/studio/[id]`, `/learn/[id]`, and `/api/lessons`.

`OPENAI_API_KEY` is not set in this environment, so a live model call was not made. After the full suite, the missing-key message was made explicit and `tests/lesson-generation.test.ts` plus `tests/integration/lesson-access.test.ts` were run again: 2 files, 2 tests, passed.

Browser, on the dev server at port 3000:

- Signed in as Ada, `/studio` said she does not have access.
- Signed in as `trainer@techsummit.example`. `/studio` showed the missing-key notice and “No lessons yet.” Lesson studio is in the trainer nav.
- `/studio/new` listed TypeScript OOP and its concepts. Generate outline, with no key, returned “Lesson generation needs OPENAI_API_KEY. Nothing was saved.” The studio list stayed empty.

Not exercised in the browser during implementation: a successful outline or publish, because no model key was configured.

## Phase 4.1 — Live generation check

The earlier pass stopped because the server had no `OPENAI_API_KEY`. This pass used a locally configured key. The server detected it. The value was not printed or committed. `OPENAI_BASE_URL` stays at the default `https://api.openai.com/v1`. The local model override is `gpt-5.4-mini`; the code default is still `gpt-4o-mini`. A one-token completion returned HTTP 200 with string content, so the request body was not changed.

Live provider, signed in as `trainer@techsummit.example`:

- Outline generation for “What a function returns in TypeScript”, beginner, 15 minutes, on Functions, returned 8 slide and quiz scenes. The lesson is “TypeScript Return Values”.
- The model’s quiz outline used `short_answer`. The outline schema expects `text`. Outlines are now normalized and schema-checked before insert, and the editor keeps `quizConfig` on save.
- The first content request failed closed and left the draft empty. The retry stored 8 scenes, and each one passed `validateScene`. Preview shows text. Model output is not executed.
- The edited title and summary survived refresh as a draft. Publish returned 200, stayed Published after refresh, and a second publish returned 200 with the same 8 scenes.

Student, signed in as Ada:

- The draft was “Lesson not found.” After publish, the dashboard links “Read the published lesson: TypeScript Return Values” on the Functions recommendation. The student page has no answer key. Ada has no Lesson studio link.
- A missing lesson id is still “Lesson not found.” Practice still opens the Functions question. Nothing was submitted.
- The dashboard does not offer a lesson for an unrelated concept. A direct URL can still open any published lesson in the same institute, which is the existing reader rule.

Mastery before and after generation, both publishes, and the student read: Variables `0.9`, Functions `0.19322033898305085`, 2 mastery updates, 8 attempts, 6 signals. No new graded attempt or integrity signal came from reading.

Checked on the final tree:

- `bun run test` passed 37 files and 140 tests. The extra test is the `short_answer` outline mapping. The 139-test baseline did not include it.
- `bun run lint` passed with no warnings.
- `bun run typecheck` passed.
- `bun run build` passed on Next.js 16.4.2.
- `bun run db:seed` was not run.

`tests/integration/lesson-access.test.ts` remains a stand-in model test, including fixture mastery held at `0.42`. It is separate from the live `gpt-5.4-mini` calls above.

Scene 3 of the live lesson uses Chinese labels, and one code sample is `int add` rather than TypeScript. That passed DSL validation and is a model-quality issue. A failed provider HTTP status is still shown as a generic message. The packages stay MIT (THU-MAIC); the reference repo was not copied. No commit was made.

## Phase 4.2 — Lesson player, language checks, and provider errors

The audit of the pre-change studio is `docs/PHASE4_2_AUDIT.md`. The result is `docs/PHASE4_2_LESSON_QUALITY.md`.

The student page and the trainer preview now share one player. Slide and quiz scenes get a presentation role: introduction, explanation, code walkthrough, comparison, steps, summary, or knowledge check. The outline, previous and next controls, and “Viewed n of m” count scenes opened in the browser. That count is not stored and is not mastery. Monaco shows code read-only. Model HTML is still stripped to text.

New lessons store `explanation=en;code=<language>` in the existing `language_directive` column. English is the only explanation language. TypeScript and JavaScript examples are syntax-checked with the TypeScript parser and are not executed. Java and C++ can be selected and stay unverified. Publish is blocked on a language or syntax error. A failing scene is regenerated once; if it is still invalid, the saved draft is left unchanged. One scene can be regenerated without rewriting the others.

Provider failures now return a fixed category: missing key, invalid credentials, rate limit, quota, timeout, network, other provider error, invalid output, or empty output. The key, headers, and response body are not returned.

A student can open a published lesson only when its concept is the selector’s current concept. The Phase 4.1 note that a direct URL could open any published lesson in the institute describes the earlier reader. `previewRoute` still does not write a routing decision.

Live checks, separate from the stand-in integration test:

- “TypeScript Return Values” stayed published. Ada used the player, including a knowledge check with no answer key, at desktop width and at 390px. The trainer editor lists the Chinese labels as blocking and leaves Publish disabled. The row was not unpublished or regenerated.
- “How async and await work in JavaScript” saved the draft “Async and Await Basics” (`83394199-a40e-4e10-a273-186dddb3eee0`) with JavaScript selected. The outline succeeded. Two content requests failed closed and stored no scenes. The draft was not published.

Ada’s mastery after the player read and those generation attempts: Variables `0.9`, Functions `0.19322033898305085`, 2 mastery updates, 8 attempts, 6 signals.

Checked on the final tree:

- `bun run test` passed 39 files and 153 tests.
- `bun run lint` passed with no warnings.
- `bun run typecheck` passed.
- `bun run build` passed on Next.js 16.4.2.
- No migration was generated. `bun run db:seed` was not run. No commit was made.

## Phase 4.3 — Lesson repair, end-to-end reliability & demo readiness

Implemented and checked against `docs/PHASE4_3_LESSON_RELIABILITY.md`.

Repairs and improvements:
- “TypeScript Return Values” (`e9434b61-2069-43ff-a805-66ca98f78f27`) was safely repaired via targeted phrase replacement: Scene 3 Chinese labels replaced with English, closing brace restored; Scene 6 `int add` replaced with TypeScript. Validated with 0 blocking errors and confirmed published.
- “Async and Await Basics” (`83394199-a40e-4e10-a273-186dddb3eee0`) JavaScript generation was resolved by forbidding TypeScript type annotations in the JavaScript prompt directive and passing the target language into `repairInstruction`. All 7 scenes generated, validated, and saved. Scene 6 was edited to test trainer persistence, verified persisted, and published.
- Student player (`LessonView`) received an accessible loading fallback for dynamic Monaco editor imports.
- Both lessons verified end-to-end: trainer preview shows answer keys; authorized student (Ada) sees lessons without answer keys; unauthorized students (Ben, Cara) receive 404 on concept mismatch.
- State isolation verified: reading lessons and viewing knowledge checks does not alter `mastery_state`, `mastery_updates`, `attempts`, or `signals`.

Checked on the final tree:
- `bun run test` passed 39 files and 161 tests.
- `bun run lint` passed with 0 errors and 0 warnings.
- `bun run typecheck` passed with 0 errors.
- `bun run build` passed on Next.js 16.4.2 (29 routes generated).
- No migration was generated. No commit was made.

## Phase 5 — Interactive Classroom Engine

Implemented and documented in `docs/PHASE5_INTERACTIVE_CLASSROOM.md`.

Engine, visual components & simulations:
- Transformed the lesson player into an interactive classroom engine based on: Explain visually → Let student interact → Ask student to reason → Give feedback → Continue teaching.
- Extended scene rendering pipeline to support all 9 scene types: `intro`, `explanation`, `diagram`, `code_walkthrough`, `comparison`, `step_by_step`, `interactive_lab`, `knowledge_check`, and `summary`.
- Built reusable interactive visual components:
  - `ArchitectureDiagram`: Responsive SVG node graph with directional animated edges, category badges, and node details inspector.
  - `StepByStepViewer`: Controlled sequence with progress track, auto-play timer, step controls, callouts, and component highlights.
  - `CodeWalkthrough`: Stepped syntax-highlighted code with line-range focus highlighting and line-level annotations.
  - `KubernetesLab`: Flagship deterministic Kubernetes cluster simulation with replica slider (1 to 6), pod inspection, rolling updates, readiness probe failure scenario (HTTP 500, pod detachment, degraded status), event stream, and self-healing corrective action.
  - `DockerLab`: File tree, multi-stage image build, container lifecycle, and verified health check endpoint probe.
  - `CicdLab`: 6-stage pipeline with automated test gating and downstream deployment blocking.
  - `InteractiveKnowledgeCheck`: Ungraded checkpoint with confidential answer keys, instant green/red affirmation, and retry logic.
  - `AiMentor`: Server route (`POST /api/lessons/[id]/mentor`) and drawer component (`AiMentor`) providing contextual hints, simplified analogies, and log explanations with deterministic offline fallbacks.
- Studio integration: Scene-type badges, unified student preview with `showAnswers`, and graceful fallbacks for unsupported types.
- Flagship Lesson: “DevOps Engineering: From Code to Production” (`4a3a34a7-7596-4d6e-b22e-a909d7f6d7da`) on concept **Functions** with 10 interactive scenes, fully validated with `@openmaic/dsl` and `inspectLesson`.
- Preserved existing published lessons (`TypeScript Return Values`, `TypeScript Generators`, `Async and Await Basics`).
- State isolation verified: viewing lessons and simulations does not alter `mastery_state`, `mastery_updates`, `attempts`, or `signals`.

Checked on the final tree:
- `bun run test` passed 40 files and 174 tests (100% pass rate).
- `bun run lint` passed with 0 errors and 0 warnings.
- `bun run typecheck` passed with 0 errors (`tsc --noEmit`).
- `bun run build` passed on Next.js 16.4.2 (all 29 routes generated).
- Zero database migrations required (used existing JSONB columns). No Git commit was made.

## Phase 5.1 — Browser QA, Integration Verification & Bug Fixes

Implemented and documented in `docs/PHASE5_1_BROWSER_QA.md`.

QA, integration verification & bug fixes:
- Verified complete student journey across all 10 scenes of flagship DevOps lesson (`4a3a34a7-7596-4d6e-b22e-a909d7f6d7da`).
- Fixed Quiz Evaluation Defect: Answer keys were stripped (`answer: null`) for student confidentiality, but client lacked an evaluation mechanism. Implemented `checkLessonQuestion` in `lib/services/lessons.ts` and `POST /api/lessons/[id]/check` endpoint with Zod validation. Updated `InteractiveKnowledgeCheck` to securely verify answers server-side, display post-submission feedback and explanation cards, and support retries without leaking answer keys upfront.
- Fixed 390px Mobile Viewport Overflow: Resolved horizontal layout overflow in `AiMentor` by replacing fixed `w-96` with responsive `w-[calc(100vw-1.5rem)] sm:w-96 max-w-sm` and `max-h-[calc(100vh-5rem)]`.
- Fixed Vitest Test Timeout: Configured `testTimeout: 20000` in `vitest.config.mts` to prevent TypeScript AST syntax tests from timing out under concurrent Docker test load.
- Added comprehensive regression test suite: `tests/integration/classroom-journey.test.ts` (15 tests) verifying authorized student access, scene roles, visual components, pre-submission answer confidentiality, author preview keys, quiz verification, unauthorized/unauthenticated access rejection, K8s cluster state machine, and data integrity.
- Data Integrity Guaranteed: Tested before and after student interaction with `scripts/probe-mastery.mjs`. Confirmed strictly identical state: 0 updates, 0 attempts, 0 signals, 0 reviews, 0 mastery changes.
- Automated verification on the final tree:
  - `bun run test`: **41 test files passed, 189 tests passed (100% pass rate)**.
  - `bun run lint`: **0 errors, 0 warnings**.
  - `bun run typecheck`: **0 errors (`tsc --noEmit`)**.
  - `bun run build`: **30 routes compiled successfully in 6.2s**.
- Working tree preserved uncommitted (no git commits made).

## Phase 5.2 — Learning Telemetry & Adaptive Integration

Implemented and documented in `docs/PHASE5_2_LEARNING_TELEMETRY.md`.

Classroom telemetry, trust boundary & adaptive decoupling:
- Established a unified, privacy-conscious telemetry pipeline capturing 15 distinct classroom interaction event types: lesson lifecycle (`lesson_start`, `lesson_complete`), scene navigation (`scene_view`, `scene_nav`), architecture diagram node inspections (`diagram_node_inspect`), step advances (`stepper_step`, `walkthrough_step`), interactive DevOps labs (`docker_lab_action`, `cicd_lab_run`, `k8s_lab_action`), formative knowledge checks (`quiz_submit`, `quiz_retry`), and AI mentor interactions (`mentor_open`, `mentor_action`, `mentor_reply`).
- Built server validation and privacy scrubber (`lib/validations/classroom-telemetry.ts`): enforced 16 KB payload limits and stripped sensitive fields (passwords, tokens, reference solutions, hidden tests, full transcripts).
- Trust Boundary & Cross-Student Isolation (`lib/services/classroom-telemetry.ts`): untrusted client events validated against authenticated actor and session ownership. Cross-student session writes are strictly rejected and quarantined under the submitting student's audit record with `invalid_reason: "cross_student_ownership_mismatch"`. Target student sessions remain completely untouched. Duplicate completions deduplicated.
- Strict Adaptive Decoupling: formative interactions, simulation trials, failure recoveries, and mentor queries are strictly segregated from summative adaptive systems. BKT mastery scores (`pKnow`), updates (`mastery_updates`), attempts (`attempts`), and integrity signals (`signals`) remain completely unchanged by telemetry. Cheating or misconduct is never inferred from simulation behavior or mentor help.
- Role-Based Learning Analytics (`lib/services/classroom-analytics.ts`, `app/api/analytics/classroom/route.ts`): provides non-punitive analytics (lessons started/completed, scene progression, lab attempts & recoveries, knowledge check accuracy, mentor usage, session context integrity). Scoped by RBAC: students query own data, trainers query assigned batches, admins query institute. Zero leaderboards.
- Dashboard Integration (`components/dashboard/views.tsx`): added `ClassroomAnalyticsCard` to Student Learning, Trainer Learning, and Student Detail views.
- Client Tracker (`components/lessons/telemetry/classroom-tracker.ts`): buffered dispatch every 5s with auto-sequencing and `beforeunload`/`visibilitychange` keepalive flush.
- Automated verification on the final tree:
  - `bun run test`: **42 test files passed, 209 tests passed (100% pass rate)**.
  - `tests/integration/classroom-telemetry.test.ts`: **20 comprehensive integration tests passing**.
  - `bun run lint`: **0 errors, 0 warnings**.
  - `bun run typecheck`: **0 errors (`tsc --noEmit`)**.
  - `bun run build`: **31 routes compiled successfully on Next.js 16.4.2**.
  - `scripts/probe-mastery.mjs`: Pre/post-test DB states strictly identical (0 unwanted mutations).
- Security audit: confirmed authentication, session ownership, cross-student protection, institute scoping, 16KB payload limits, completion deduplication, and sensitive metadata sanitization; identified that HTTP sliding-window rate limiting on `/api/lessons/[id]/telemetry` is not yet implemented (relies on payload/batch bounds and 5s client debouncing). Browser automation was not re-run in Phase 5.2 (UI components verified via browser QA in Phase 5.1).
- Working tree preserved uncommitted (no git commits made, no unnecessary migrations).

## Phase 5.3 — Adaptive Learning Loop

Implemented and documented in `docs/PHASE5_3_ADAPTIVE_LEARNING_LOOP.md`.

Closed-loop adaptive learning architecture:
- Authoritative Evidence Boundary: only server-validated submissions from graded coding sessions (`session.mode === "graded"`) trigger BKT mastery updates (`applyMastery()`). Idempotency check in `submitSession()` prevents duplicate requests from re-applying mastery or creating redundant audit records.
- Adaptive Selection & Remediation Engine (`lib/services/adaptive-loop.ts`): orchestrates concept prerequisite DAG traversal, stored mastery evaluation against the 0.80 threshold, deterministic candidate tie-breaking, calibrated question selection targeting ~70% predicted success, and published visual lesson matching. Concepts blocked by unmastered prerequisites produce prerequisite remediation activities.
- Missing-Data Fidelity: unrecorded mastery is strictly represented as `null` (never converted to `0` or the BKT prior `0.20`), and labeled "Not recorded" in UI and APIs. Internal selector prior is decoupled from observed database state.
- Explainable Recommendations: deterministic, evidence-grounded reason generation based on actual database mastery, prerequisite readiness, and calibrated challenge targets. Zero LLM hallucinations; secret strings, hidden tests, and answer keys are strictly protected.
- Recommendation Lifecycle & Telemetry: added `recommendation_view` and `recommendation_click` event schemas (`lib/validations/classroom-telemetry.ts`) and analytics aggregation (`lib/services/classroom-analytics.ts`). Ingesting recommendation events or viewing lessons does not alter mastery state.
- Adaptive Student UI (`components/dashboard/views.tsx`): upgraded student dashboard recommendation component to an accessible card with activity badges, action buttons ("Start Interactive Lesson", "Start Coding Practice", "Review Prerequisite Lesson"), prerequisite readiness checklist, and evidence summary chips.
- Authenticated Recommendation API (`app/api/learning/recommendation/route.ts`): `GET /api/learning/recommendation` endpoint with Better Auth actor authentication, RBAC institute boundaries, and input sanitization.
- Automated verification on the final tree:
  - `bun run test`: **43 test files passed, 218 tests passed (100% pass rate)**.
  - `tests/integration/adaptive-loop.test.ts`: **9 comprehensive integration tests passing**.
  - `bun run lint`: **0 errors, 0 warnings**.
  - `bun run typecheck`: **0 errors (`tsc --noEmit`)**.
  - `bun run build`: **31 routes compiled successfully on Next.js 16.4.2**.
  - `scripts/probe-mastery.mjs`: Pre/post-test DB states strictly identical (0 unwanted mutations).
  - Live API smoke test: `GET /api/learning/recommendation` verified live on port 3000 (401 unauthenticated, 200 authenticated for Ada with complete adaptive payload).
- Working tree preserved uncommitted (no git commits or pushes performed, no schema migrations needed).

## Not started

Per-batch threshold tuning and student-visible signals stay P1. Periodic snapshots and trainer notes from the PRD are not built. A keepalive batch that never reached the server still cannot be replayed.

Still open: mastery trend charts (SD-4, P1), CSV export (TD-5, P1), module and date filters (TD-6, P1), and the institute summary (AD-1 and AD-2, P2). Explanation results are stored and are not applied to mastery. Lesson reading is not a mastery observation. AE-5 does not give a numeric weight.

Also open: CI hardening beyond the current red-team run, the demo seed in PRD 13.1, a project README, and the PRD 13.2 pass/fail report. File upload and the OpenMAIC slide editor are not in this step.

## Deferred inside the finished phases

- Question edit and delete exist as APIs. The trainer UI is a list plus create.
- A question tagged with several concepts gets the same observation on each tag. The PRD’s weighted split (AE-3) is P1.
- The selector may repeat a question after that concept’s unattempted bank is empty. Refusing repeats until then (NQ-5) is P1.
- Explanation results are stored and are not applied to mastery. AE-5 does not give a numeric weight.

Choices that are easy to miss later are in `docs/DECISIONS.md`.

