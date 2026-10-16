# Phase 2 — Explain your code

After a graded submission, the student answers two or three short questions about the code they submitted. The result is stored with that submission. It does not change the hidden-test score, mastery, or an integrity signal.

## What is asked

Questions come from `lib/engine/explain-questions.ts`. The scanner is line-based. It is not a parser and it is not an AST. A question is stored only when it cites a source line, or when the sandbox ran the submitted program and produced output.

The project has no AI provider and no parser package. Nothing in this step calls a model. `questionsFromUntrusted` is the gate a model payload would have to pass. A payload that is not two or three grounded questions, or that states a reference solution, a hidden test, or the expected answer, is discarded and the deterministic questions are kept.

| Type | What it asks | How it is checked |
|---|---|---|
| `trace` | What a JavaScript call returns, or what a Java or C++ program writes with no extra input | The same sandbox interface used for assessments. The expected text is the run output |
| `edge` | What a JavaScript call returns for an empty or zero input, when the code has a condition and the output differs from the trace | Sandbox output |
| `mutation` | What a JavaScript call would return if one comparison on a cited line were changed, and only when that change changes the output | Sandbox output of the modified copy. The stored snapshot is still the original submission |
| `reasoning` | Why a cited line is written the way it is | The answer must name the identifier on that line, and a literal when the line has one |

JavaScript probes append a call after the original source. That probe is not stored. Java and C++ are not rewritten; only the original program is run.

If two grounded questions cannot be made, the attempt is stored as `unavailable` with a note. No generic language question is added.

## How an answer is scored

The stored verdict uses the existing words `yes`, `partial`, and `no`.

| Verdict | Shown as | Meaning |
|---|---|---|
| `yes` | Correct | The answer matches the recorded output, or it names the cited identifier and literal. Extra words do not add credit |
| `partial` | Partially correct | The recorded value is present along with a conflicting number, or only part of the cited line is named |
| `no` | Incorrect | The answer misses the recorded value or the cited name |
| null | Not enough evidence | The cited line has nothing to check. `review_status` is `needs_review` |

A blank answer is incorrect. A long answer that never names the cited fact is incorrect.

Sandbox answers are compared after trimming and JSON normalization. `3` and `the result is 3` can both be correct. `14` is not treated as `4`.

## What is stored

Migration `drizzle/0004_explain_code.sql` adds `explain_sets` and columns on `explain_qa`.

One set per attempt. A second request returns the same set. The set copies `attempts.code` into `code_snapshot` at creation. Later edits to the attempt do not change that copy.

Each question stores its type, text, line range, quote, and a private `grader_json`. The student payload never includes `grader_json`. Before the student submits answers, verdicts and evidence are omitted. After submission, evidence describes the observed run or the cited line. A second answer submission returns the first verdicts and does not regrade.

Hidden-test inputs, hidden-test expected outputs, and reference solutions are not read while questions are built.

## Who can see it

The student who submitted can prepare and answer questions for their own graded submission. Another student cannot. A trainer can read explanations for a student in a shared batch. An admin can read them inside the same institute. Another institute gets not found. Students cannot open the session explanation list; that list uses the same boundary as replay.

The student sees the step on the practice page only after a graded submit. Practice submissions are refused. The trainer sees the snapshot, questions, original answers, verdicts, evidence, method, confidence, and any needs-review mark on the replay page for that session.

## What this step does not do

- No model judges free-text reasoning. A reasoning answer is scored from the name and literal on the cited line. If that is not enough to be sure, the verdict is null and the row needs review.
- Mastery is unchanged. The PRD says explanation results are lower-weight evidence, and it does not give a weight. This step does not invent one and does not write a mastery update.
- An incorrect explanation does not create an `explanation_mismatch` signal and does not change the submission's pass rate.
- The answer box is not part of the editor event log. Contest mode, trainer overrule, and a viva link are not built.

Checked commands and browser results for this step are in `progress.md`.
