# Phase 4 — Lesson studio

Trainers write a lesson for a concept that already exists on the concept map. Students see a published lesson only on the recommended concept. Drafts stay private. Reading a lesson does not change `mastery_state.p_know`, a hidden-test score, or an integrity signal.

## What was already here

The portal is one Next.js app with PostgreSQL, Drizzle, and Better Auth. There was no lesson table, no lesson renderer, and no model provider. `OPENAI_API_KEY` was not part of the app. Concept editing and the question bank are institute-scoped for trainers and admins. Student records stay inside the batch and institute rules from Phase 3.

## What this step uses from OpenMAIC

The reference repository `derpx06/Vortexa-3.0_CodeCrafts_LearnLoop` is a separate MIT-licensed OpenMAIC tree (copyright THU-MAIC). It was not merged. This app depends on the published packages that match that tree:

- `@openmaic/generation` 0.3.18 — `generateSceneOutlinesFromRequirements`, `generateSceneContent`, `generateSceneActions`, and `buildCompleteScene`. The package does not choose a provider. Callers pass `AICallFn`.
- `@openmaic/dsl` 0.11.3 — `validateScene` before a scene is stored.

`@openmaic/renderer` and `@openmaic/editor` were not added. They belong to the OpenMAIC app shell and would pull that application's editor, media, and agent stack into this portal. The preview reads the validated scene: slide text is shown as text, and quiz questions are shown as ungraded knowledge checks. Generated HTML and project scenes are rejected instead of executed.

## Workflow

1. A trainer or admin opens `/studio`.
2. They pick a module and a concept in that module, then enter a topic, objectives, learner level, length, and optional pasted source text (8,000 characters).
3. Outline generation calls OpenMAIC. A draft row is inserted only after the model returns at least one slide or quiz scene.
4. The trainer edits that outline and saves it.
5. Content generation builds one validated scene per outline entry. A provider error or invalid document leaves the draft unpublished and does not replace a previous good draft with invented text.
6. The trainer can edit scene text, save, and publish.
7. A student dashboard shows the published lesson for the selector's current concept. If none is published, the existing next step is unchanged.

A trainer must already be assigned to a batch in the institute. An admin is limited to their institute. Another institute is not found. Students cannot generate, edit, or publish. A student who opens a draft gets "not found".

Knowledge-check answers are visible to the author and hidden from the student. They are not coding grades.

## Provider

`callLessonModel` in `lib/engine/lesson-provider.ts` is the `AICallFn` `(systemPrompt, userPrompt) => Promise<string>`. The installed signature also accepts optional images; this wrapper does not send them.

The request is `POST {OPENAI_BASE_URL or https://api.openai.com/v1}/chat/completions` with JSON `{ model, temperature: 0.2, messages: [{ role: "system" }, { role: "user" }] }` and an `Authorization: Bearer` header. `OPENAI_MODEL` defaults to `gpt-4o-mini`. The call aborts after 45 seconds. Only a string `choices[0].message.content` is accepted. The key is read from `process.env` inside that server function. It is not written to the lesson row and is not logged. Studio pages and `lib/services/lessons.ts` are the only app imports, and none of them are client components. There is no `NEXT_PUBLIC_OPENAI` variable.

A prompt is sent only up to 64,000 characters. The previous 24,000-character cut would have dropped the end of the installed slide-content system prompt, which measured 28,683 characters. The outline prompt measured 17,536 system characters and 3,228 user characters, so it already fit.

If the key is missing, generation returns a setup error before any row is inserted, and the rest of the portal stays usable. Role checks run before that setup error, so a student is refused with 403 rather than told the key is missing.

## Phase 4.1 live provider run

The server process detected a configured `OPENAI_API_KEY`. The value was not printed, logged, or written into source. `OPENAI_BASE_URL` is unset, so the request uses `https://api.openai.com/v1`. The local `OPENAI_MODEL` override is `gpt-5.4-mini`. The code default remains `gpt-4o-mini`. A one-token chat completion with `temperature: 0.2` returned HTTP 200 and a non-empty string, so the request shape was left unchanged.

The live trainer lesson is “TypeScript Return Values” (`e9434b61-2069-43ff-a805-66ca98f78f27`) on TypeScript OOP / Functions. The brief was topic “What a function returns in TypeScript”, beginner, 15 minutes, and the return-value objective. The real provider returned 8 scenes: 6 slides and 2 quizzes. No interactive or PBL scene was stored.

The first outline response included quiz `questionTypes` of `short_answer`, which is the DSL quiz type. The outline schema only accepts `single`, `multiple`, and `text`, so the saved row could not be re-read. `normalizeOutlineValue` now maps `short_answer` and `short-answer` to `text` before validation, and `createLesson` parses every outline before insert. After that change the same draft opened with all 8 scenes. Saving an outline keeps `quizConfig`.

The first content request failed closed: the draft stayed empty and the UI said the output could not be saved. The failure message now names the scene and the first DSL issue. The retry returned HTTP 200. All 8 stored scenes passed `@openmaic/dsl` `validateScene`. The preview shows slide and quiz text. Generated code is rendered as text. The author sees “Answer key” and “This is not a grade.”

An edited scene title and the summary body survived a browser refresh while the lesson was still a draft. Publish returned HTTP 200. A refresh still said Published, with the same 8 scenes. A second publish returned HTTP 200 and left the scenes in place.

Ada could not open the draft (`Lesson not found`) and has no Lesson studio link. After publish, her dashboard recommends Functions and links only “Read the published lesson: TypeScript Return Values”. Opening that page showed the slides and questions with no answer key. `/learn/00000000-0000-4000-8000-000000000099` still says “Lesson not found.” `/practice` still opened the Functions question. Submit was not used. Concepts without a mastery row still appear as waiting, and the pathway stays usable when a lesson id is missing.

A second published Functions lesson, “TypeScript Generators”, is also in the local database. The dashboard shows the latest `publishedAt` for the recommended concept, which is now Return Values. `readLessonForStudent` still opens any published lesson in the same institute by id. The dashboard does not link a lesson for an unrelated concept.

Ada’s stored mastery before this run and after outline generation, content generation, both publishes, and the student read: Variables `0.9`, Functions `0.19322033898305085`, 2 mastery updates, 8 attempts, 6 integrity signals. The lesson table has 2 rows. Those reads did not add an attempt, a mastery update, or a signal.

Commands on the final tree, all exit 0:

- `bun run test` — 37 files, 140 tests. The previous tree was 139. The added test maps `short_answer` onto the outline `text` type.
- `bun run lint` — no warnings.
- `bun run typecheck`
- `bun run build` — Next.js 16.4.2. Lesson routes are `/studio`, `/studio/new`, `/studio/[id]`, `/learn/[id]`, and `/api/lessons`.

`bun run db:seed` was not run.

`tests/integration/lesson-access.test.ts` still drives OpenMAIC with a stand-in response. It is not this live call. It covers student 403, an unknown concept, an unassigned trainer, invalid text and a thrown provider that insert nothing, a content failure that leaves the draft empty, a hidden draft, another institute, publish only after valid scenes, a student answer of null, and fixture mastery held at `0.42`.

Model output that passed the schema still needs a human read. Scene 3 uses Chinese labels for an English TypeScript lesson, and one example is written as `int add` rather than TypeScript. A non-OK provider response is still reported as a generic “did not return a lesson” message. The successful calls did not require a change to that message. The reference repository was not copied. The packages are MIT, copyright THU-MAIC, and still need a human license review before redistribution.

## Not in this step

File upload, the OpenMAIC slide editor, interactive widgets, and PBL projects. Lesson completion is not recorded and is not a mastery observation. The PRD does not define a weight for reading a lesson.
