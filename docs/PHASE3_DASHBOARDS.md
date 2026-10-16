# Phase 3 — Student and trainer dashboards

`/dashboard` shows a student their own mastery, or a trainer and admin the batches they are already allowed to see. A trainer opens one student at `/dashboard/students/:id`. Nothing on these pages recalculates BKT, changes a score, or writes a routing decision.

## What a number means

Mastery is the stored `mastery_state.p_know` value. The dashboard does not fill a missing row with the selector’s starting estimate of 0.20, and it does not treat a missing row as zero.

The only threshold is the module’s `mastery_threshold`. Seeded modules use 0.80, the same value the selector already uses. The PRD names four heatmap words and does not define a second cutoff, so this page does not invent one.

| Stored value | Label |
|---|---|
| No `mastery_state` row | Not recorded |
| `p_know` below the module threshold | Below threshold |
| `p_know` at or above the module threshold | Solid |

A stored `0` is below the threshold. It is not shown as “not recorded.”

`mastery_state.confidence` is displayed as “Not estimated” when it is still the column default of 0. The BKT update does not write confidence, so the page does not invent a confidence score. A non-zero stored value is shown as stored.

## Student page

The next step is `previewRoute`, which calls the existing selector and does not insert a `routing_decisions` row. The sentence on the page is the selector’s own reason. If the chosen concept has no stored mastery, the page says the number in that sentence is the selector’s starting estimate.

Each concept shows its prerequisites as met, below the threshold, or not recorded. The latest `mastery_updates` row, when one exists, is the “why”: the cause type, the before and after values, and the time. A seeded record with no update says that no graded update explains it. When graded submissions are tagged to the concept, the page counts how many of the last four passed every hidden test. That count is not a mastery value. A question tagged to several concepts is counted once for each tag, which matches the current mastery update.

Graded submissions list the hidden-test pass count and, separately, the explanation verdicts. Practice runs are omitted. Students do not get replay links, because replay stays trainer-only. Explanation results are not given a mastery weight.

## Trainer page

Rows are students in one authorized batch. Columns are that module’s concepts, ordered by prerequisites. Cells are built from one mastery query for those students and concepts.

A concept is listed under “Below the module threshold” when the mean of its stored values is under the module threshold. Students with no record are left out of the mean and counted beside it. “Blocks a later concept” counts students whose stored value for a prerequisite is under the threshold. A missing record is not counted as blocking.

Recent graded submissions link to the existing replay page. The review section links to `/review` and shows how many pending, supported signals `listReviewQueue` returns for that batch. The copy says a signal does not change a grade or mastery.

An admin sees batches in their institute. A trainer sees batches they are assigned to. Another institute is not found. A batch in the same institute that the trainer does not teach is forbidden.

## Not in this step

There is no second mastery engine, no new table, and no change to scoring, selection, explanation grading, or integrity rules. Per-concept trend charts, CSV export, module and date filters, and the institute summary stay out. Those are P1 or P2 in the PRD.

The commands and the browser pass are recorded in `progress.md`.
