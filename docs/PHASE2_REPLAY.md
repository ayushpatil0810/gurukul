# Phase 2 — Replay

Trainers and admins can play a student's recorded session. The player rebuilds the editor from the session baseline and the stored editor events. It uses `reconstructDocument` for every frame. It does not invent code when that function cannot.

## Who can open a recording

`GET /api/sessions/:id/replay` and the pages `/replay` and `/replay/:sessionId` call `readReplay`.

- A trainer can open a session when they teach a batch that includes that student. This is the same batch rule as reading a student profile.
- An admin can open a session in their institute.
- A student cannot open replay, including their own session.
- A session in another institute is reported as not found.
- An unknown session id is reported as not found.
- A signed-out request is rejected before any events are read.

The response includes the student name, the session mode, the question statement, and the event log. It does not include hidden tests, reference solutions, or authentication secrets. Those keys are removed from event payloads if they are present. The page does not write editor text to the server log.

The student event API is unchanged. A student still cannot read another student's events by guessing a session id.

## What the player shows

The timeline is built once from the loaded events. Playback, pause, and seeking only move a clock. They do not change the event list and they do not apply an edit a second time.

- Play and pause.
- A slider from the start of the recording to the last event time.
- Speeds 0.5×, 1×, 2×, 4×, and 8×.
- Previous and next event.
- Markers labeled Edit, Run, Submit, and Gap.
- A list of events with type and session-relative time.
- The selected event shows its sequence, append order, and a run or submission outcome when one was stored.

Space plays or pauses when the replay region is focused and the key is not aimed at a button or the slider. Arrow keys move one event in that same case. The slider itself moves with the arrow keys when it is focused.

Reaching a time by playing and seeking to that same time uses the same frame, so the editor text matches.

Run, submit, focus, blur, visibility, and data-quality events do not change the editor text.

## When the code cannot be rebuilt

`reconstructDocument` reports `legacy_or_incomplete`, `removed_mismatch`, or `overlapping_changes`. The player also reports `missing_baseline` when no `session_start` baseline exists, and `sequence_gap` when a later edit would have to cross client sequence numbers that were not stored.

For those points the editor is hidden and the page says that no code is available. That state is separate from a recording whose baseline is an empty program. The warning names the time and sequence range. A later `session_start` with its own baseline can be rebuilt on its own, and the unplayable span is not filled in to get there.

A data-quality note is described as missing telemetry. The page does not treat a gap or a reconstruction failure as misconduct.

## What this does not do

- Integrity signals that link into this player are described in `docs/PHASE2_INTEGRITY_REVIEW.md`. The player does not compute a score.
- It does not ask the student to explain their code.
- It does not change a grade, a mastery value, or a routing decision.
- It does not store periodic snapshots. Each frame is rebuilt from the baseline and the editor events up to that point.
- It does not play events that were never stored. A failed keepalive still leaves that batch only in the browser's `localStorage`.
