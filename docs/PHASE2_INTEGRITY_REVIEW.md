# Phase 2 — Integrity review

Trainers and admins can review four patterns computed from a graded session's event log. A pattern is evidence for a person to interpret. It is not a verdict, and it does not change a grade, a mastery value, or a student's access.

## The four patterns

The thresholds named in the PRD are used as written. Rule version `integrity-v1` also states two phrases the PRD left unnumbered, and stores those numbers on the signal:

- "Sustained" means typed changes covering at least 1000 ms.
- "Coefficient of variation below a calibrated threshold" uses 0.15.

| Pattern | Stored type | When it is stored |
|---|---|---|
| Large paste | `large_paste` | One paste of at least 150 characters, or at least 40% of the rebuilt final solution |
| Unusual typing burst | `faster_than_rhythm` | One change of at least 80 characters that is not a paste and not an autocomplete acceptance, or a sustained rate above 12 characters per second. A personal baseline of at least 30 earlier samples can also fire the rate when it is more than 3 standard deviations above that baseline. Without that baseline, confidence is lower |
| No write-run-fix iteration | `no_write_run_fix` | A submission with no stored run before it, or a first run that passes every stored test on a solution of at least 30 lines when the log has no failed run followed by an edit and another run |
| Unusually uniform typing | `evenly_typed` | At least 300 single-character inserts, inter-key coefficient of variation below 0.15, deletion ratio below 2%, and no gap between those keys longer than 5 seconds |

A paste is never described as manual typing. A large change is not given a source the log does not contain.

## When a pattern is not stored

Missing measurements produce an insufficient-evidence note, not a pattern.

- A paste with no character count is not measured.
- A sequence hole before a submission is not treated as "the student never ran the code."
- A sequence hole inside a typing span blocks the rate and the uniform-rhythm rules.
- Multi-character changes do not supply inter-key times, so the uniform-rhythm rule is not applied to them.
- Fewer than 300 single-character inserts is not stretched into a rhythm.
- Practice sessions are not analyzed.

Those notes are stored on `integrity_runs` for the session. They are separate from the review queue. A gap remains missing telemetry, not a finding about the student.

## Identity, late events, and history

Each signal has a dedupe key of rule version, type, and the evidence sequence. Checking the same recording again updates metrics on that key and does not create a second row. The review status and the review rows are left as they were.

If a later event means the rule no longer matches, `supported` becomes false. The row and its reviews stay. The queue shows only supported signals. A trainer opens the old row and can see that later events changed the result.

Detection runs when a graded submission is saved, when graded events are appended, and when a trainer uses **Check recording**. Opening the queue does not recompute signals.

## Review

`/review` lists supported signals for the actor's batches, or the whole institute for an admin. Filters are batch, pattern, and status: `pending`, `dismissed`, `needs_viva`, `escalated`. Strength sorts high, then medium, then low.

A signal page shows the measured values, the threshold that fired, context that cuts the other way, and recording limits. **Open the replay** seeks to `t_start` and labels the evidence range.

Dismiss and needs viva accept an empty note. Escalate requires a written note. The reviewer id and the review time come from the signed-in account and the server clock. Each decision is a new `reviews` row. Earlier rows are not rewritten.

Students cannot list or record reviews. A trainer needs a shared batch. An admin needs the same institute. Another institute is not found.

The queue states the limits: a second device is not visible, fast typing and assistive technology can resemble these patterns, and there is no combined score.

## What this does not do

- It does not ask the student to explain their code.
- It does not tune thresholds per batch. That remains a later setting.
- It does not show signals to the student.
- It does not schedule a viva or notify the student.
- It does not capture a camera, a microphone, a screen, or another device.
