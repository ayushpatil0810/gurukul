# Phase 4.2 audit

This is the state of Lesson Studio before the quality and player changes. Support is marked tested, configured, or unverified. A language that appeared in one model sample is not treated as support.

## Coding assessments

Configured in `db/schema/portal.ts` as `submissionLanguages`: `java`, `javascript`, `cpp`. The practice runner rejects any other language. Seeded questions and the assessment integration tests use JavaScript only. Java and C++ are configured in the schema and the practice language control, and they are not covered by an execution test in this repository. TypeScript is not an assessment language.

## Lesson generation languages

There is no lesson language control. `lessons.language_directive` stores the string returned by OpenMAIC, and content generation then ignores it and sends “Teach in the language of the outline.” English is not selected, persisted, or checked. Hindi is not implemented. The live TypeScript lesson was English prose with Chinese labels and a C-style `int add` example, so model output is not evidence of language support.

## Scene model and rendering

Stored scenes are `slide` or `quiz` after `@openmaic/dsl` `validateScene`. Interactive and PBL outlines are dropped before save. The student and trainer views both use `LessonView`, which prints extracted text and quiz options. HTML from the model is stripped to text and is not executed. There is no scene navigator, no per-scene layout, and no diagram or chart renderer.

OpenMAIC can emit interactive and PBL documents. This portal rejects them. No scene type is interactive. No numeric chart is rendered, because a scene does not carry a validated data series. The concept map on `/curriculum` is a separate `@xyflow/react` view and is not part of a lesson.

## Access

A student who opens a draft, another institute’s lesson, or an unknown id gets “Lesson not found.” The dashboard links only the latest published lesson for the selector’s concept. `readLessonForStudent` currently allows any published lesson in the same institute by id. Phase 4 says a student sees a lesson for the recommended concept, so this pass will enforce that on the server. `previewRoute` already reads the selector without writing a routing decision.

## Provider

`callLessonModel` posts chat completions with temperature 0.2, a 45-second abort, and a 64,000-character prompt cap. A missing key is a setup error. Every other failure becomes one generic message. Non-OK bodies are not classified. Outline generation catches the provider error inside OpenMAIC and returns `success: false`, so the studio currently cannot tell a bad key from a bad outline.

## Smallest safe plan

1. Persist `explanation=en;code=<language>` in the existing `language_directive` column. No new migration. English is the only explanation language. Example languages are TypeScript, JavaScript, Java, and C++. Only TypeScript and JavaScript are syntax-checked, with the TypeScript parser and no execution.
2. Block publish on unexpected CJK, kana, or Hangul text in an English lesson, and on invalid TypeScript or JavaScript examples. Retry the failing scene once. Keep the last saved draft if that retry fails.
3. Classify provider failures without returning headers, keys, or raw bodies.
4. Replace the flat preview with one player: outline, previous/next, viewed-scene progress that is not mastery, and layouts for introduction, explanation, code, comparison, steps, knowledge check, and summary. Those layouts are presentations of slide and quiz scenes, not new stored types.
5. Restrict a student read to the selector’s current concept.
6. Leave BKT, the selector, grades, and integrity signals unchanged.

The result of that plan is in `docs/PHASE4_2_LESSON_QUALITY.md`. This file stays the before-change audit.
