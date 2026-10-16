# Phase 4.2 lesson quality

## Player

`LessonView` is now the student player and the trainer preview. A lesson still stores only slide and quiz scenes. The player gives each scene a presentation role:

- First slide: concept introduction.
- Slide with a detected code example: code walkthrough, shown in the existing Monaco editor, read-only.
- Slide with a markdown table: comparison.
- Slide whose lines are all numbered: steps.
- Last slide titled as a summary or review: summary.
- Any other slide: explanation.
- Quiz: knowledge check. Options are visible. A written question is not submitted. The student view does not show the answer key.

The outline, previous and next controls, and “Viewed n of m” count scenes opened in the browser. That count is not stored and is not mastery. Arrow keys move scenes unless focus is in a field. At 390px the outline scrolls sideways and the page does not overflow.

Interactive and PBL scenes are still dropped. There is no chart, because a scene has no validated number series. The concept map stays on `/curriculum`.

## Language

The create form saves `explanation=en;code=<language>` in the existing `language_directive` column. No new migration. English is the only explanation language. Hindi is not offered. Example languages are TypeScript, JavaScript, Java, and C++. Java and C++ are labeled “syntax not checked.”

| Capability | Supported languages | Evidence |
|---|---|---|
| Lesson explanations | English | Configured in the form and prompt. A unit test rejects CJK, kana, and Hangul text in an English lesson. Hindi is unsupported. |
| Lesson code examples | TypeScript and JavaScript are syntax-checked. Java and C++ can be selected and are unverified. | `tests/lesson-quality.test.ts` uses the TypeScript parser and does not execute the sample. |
| Coding assessments | Java, JavaScript, C++ are configured. JavaScript is covered by the assessment tests. Java and C++ execution is unverified in this repository. | `submissionLanguages` in `db/schema/portal.ts`. The runner was not changed. |
| Hindi explanations | Unsupported | No prompt, control, or test accepts Hindi. |

Older lessons keep OpenMAIC’s free-text directive. Their code samples are a warning, not a pass. Republishing “TypeScript Return Values” is blocked because scene 3 still contains Chinese. The already published row was not unpublished.

## Validation and repair

Publish is refused when a scene has an error. Warnings do not block publish. A content request checks each scene, and if the check fails it asks OpenMAIC to regenerate that scene once. If it is still invalid, the request throws and the saved draft is left as it was. One scene can be regenerated from the editor without rewriting the others. Model output is parsed as data. It is not executed.

## Provider errors

`callLessonModel` returns a category and a fixed sentence. The response body, headers, and key are not returned.

| Category | When |
|---|---|
| missing_key | `OPENAI_API_KEY` is empty |
| invalid_credentials | HTTP 401 or 403 |
| rate_limited | HTTP 429 |
| quota | HTTP 402, or a quota or billing phrase in the body |
| timeout | The 45-second abort |
| network | The request cannot connect |
| provider_error | Another non-OK status |
| invalid_output | The body is not JSON, the content is not a string, or it is too long |
| empty_output | The string is blank |

Outline generation only forwards one of those known sentences. Any other wrapped error stays generic.

## Live checks

These are separate from the stand-in test in `tests/integration/lesson-access.test.ts`.

“TypeScript Return Values” was already published. In the browser, Ada can move through scenes, open a knowledge check with no answer key, and use the player at 390px wide. The trainer editor shows the Chinese text as blocking and the unchecked examples as warnings. Publish is disabled. Nothing was republished.

“How async and await work in JavaScript” was created on Functions with JavaScript selected. The live outline succeeded and was saved as draft “Async and Await Basics” (`83394199-a40e-4e10-a273-186dddb3eee0`). Two content requests failed closed. The first rejection was invalid JavaScript in “What Async and Await Do.” After the checker was corrected so an `async function` is not stripped down to `function`, the second rejection was invalid JavaScript in “Async Functions Return Promises.” The outline draft is still stored. It was not published.

Ada’s mastery after the player read and these generation attempts: Variables `0.9`, Functions `0.19322033898305085`, 2 mastery updates, 8 attempts, 6 signals.

## Access

A student can open a published lesson only when its concept is the selector’s current concept. `previewRoute` does the read and does not write a routing decision. A published lesson on another concept returns “Lesson not found.” The integration test covers that. The dashboard still links only the latest published lesson for the recommended concept.

## Commands

Recorded on the final tree:

- `bun run test` passed 39 files and 153 tests.
- `bun run lint` passed with no warnings.
- `bun run typecheck` passed.
- `bun run build` passed on Next.js 16.4.2.

No migration was generated. `bun run db:seed` was not run. No commit was made.

## Remaining

The items below from Phase 4.2 were resolved in Phase 4.3 (see `docs/PHASE4_3_LESSON_RELIABILITY.md`):
- “TypeScript Return Values” was safely repaired: scene 3 Chinese text was replaced with English equivalents and scene 6 `int add` with valid TypeScript, passing validation and publishing cleanly.
- “Async and Await Basics” draft content generation was resolved with plain JavaScript guidance and language-aware repair instructions; all 7 scenes were saved, validated, edited, and published.
- Remaining portal-wide limitations: Java and C++ examples are still not syntax-checked. Hindi is not offered. Interactive and PBL scenes are dropped.

