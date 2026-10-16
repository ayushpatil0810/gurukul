# Phase 2 — Telemetry

Editor events can be replayed from the log, and an acknowledgement cannot drop a newer event that was still waiting. Integrity review is described in `docs/PHASE2_INTEGRITY_REVIEW.md`. Explain-your-code is not part of this change.

## Event envelope

Every new client event has:

| Field | Meaning |
|---|---|
| `seq` | Session sequence, assigned once by the browser. It starts at 1 and only increases. |
| `t` | Milliseconds since the recording clock. The clock starts at the first buffered edit, or when the recorder is created if the buffer is empty. |
| `type` | One of the existing session, editor, run, submit, focus, blur, and visibility types, plus `replace`. |
| `payload` | Type-specific data. New events include `schemaVersion: 2`. |
| `prevHash` | SHA-256 of the previous chained event. The client cannot set this. |
| `chainIndex` | Append order used by the hash chain. |
| `schemaVersion` | Column. `1` is a historical row. `2` is a row written by this ingest. |
| `receivedAt` | Server clock when the row was inserted. Null on historical rows. |

`t` is the client's original elapsed time. Retries send the same value. `receivedAt` is a separate server timestamp. A client field named `receivedAt`, `prevHash`, `chainIndex`, or `misconduct` is removed before storage.

The hash covers `prevHash`, `seq`, `t`, `type`, and `payload` only. `chainIndex`, the schema column, and `receivedAt` sit outside the hash, so the old chain still verifies.

## Editor changes

Monaco's content callback can contain more than one change. Each change becomes its own event. Offsets in that callback refer to the document from before the callback. Changes are applied from the end of the document toward the start. When two changes start at the same offset, the longer range is applied first. That is enough for ranges that do not overlap.

Two ranges overlap when they cover the same character, and two inserts at the same offset overlap as well. Touching at an edge does not. Overlapping changes are stored with `overlap: true`. `reconstructDocument` returns `overlapping_changes` and does not produce a document. A change whose offset falls outside the document marks that callback `incomplete: true`. Reconstruction returns `legacy_or_incomplete` and does not produce a document. If every change in the callback is outside the document, one incomplete event is stored so the hole is visible.

A reconstructable editor payload contains:

- `range.start` and `range.end` as offsets into the document before that change
- `text`, the inserted characters
- `removed`, the characters that occupied that range
- `length` and `removedLength`, derived from those strings

The type is `undo` or `redo` when the Monaco content event says `isUndoing` or `isRedoing`. Those flags are on the callback, so they describe the edit that just happened. Paste is marked from a capture-phase DOM paste listener that runs before Monaco applies the clipboard edit. Autocomplete is marked by wrapping `SuggestModel.accept`, so the flag is set before that call applies the edit. Both flags are cleared when the content callback finishes and again on a zero-delay timer, so a paste or suggestion that inserts nothing cannot label the next edit. If `SuggestModel.accept` is not present on the loaded Monaco build, an accepted suggestion is stored as `insert`, `delete`, or `replace`.

`session_start` carries `baseline`, the document text before the edits that were waiting for the session row. Those edits are recorded first, and `session_start` follows them. The recording clock is the earliest buffered edit, or the session-open time when the buffer is empty. An edit that arrives while session creation is still in progress stays in that buffer and is recorded after the batch, with the timestamp it had when it was captured. Reconstruction starts from the baseline and applies editor events in client `seq` order. Run, submit, focus, blur, copy, cut, and visibility events stay as they were and are skipped during reconstruction.

An editor event that only has a length, or any editor event whose payload is missing `text`, `removed`, or the range, is not reconstructable. Nothing is invented for it. `reconstructDocument` returns `legacy_or_incomplete` and does not produce a document.

## Acknowledgements

The browser keeps a queue in `EventBuffer` and in `localStorage`. Each send is a snapshot of at most 100 events.

- WebSocket ingest (`bun run telemetry`) replies `{ ok, batchId, acked }`.
- `POST /api/sessions/:id/events` replies `{ success, data, acked }`.

`acked` is the client sequence numbers now stored, including duplicates that were already stored. The queue drops only those sequences. An acknowledgement is accepted only when it is an array of integers. An omitted list, an empty list, a malformed list, a failed response, or a network throw leaves the queue unchanged, including every original `t` and payload. An event appended while that request was in flight stays queued.

A partial acknowledgement removes only the named sequences. The HTTP fallback then sends what is still queued. An empty acknowledgement does not immediately send the same batch again. WebSocket ingest does not treat `batchId` as an acknowledgement.

Sequence numbers are unique per session. The primary key is `(session_id, seq)`, so an acknowledgement names one stored row. Client sequences stop at `1000000`. Server notes start at `1000001`.

The same event delivered twice is stored once. The first `t`, payload, and `receivedAt` remain.

## Ordering and gaps

Client events are stored on their own sequence numbers. The hash chain follows `chainIndex`, which is the order the server appended rows.

If a batch arrives with a hole, the server writes one `data_quality` event on a server sequence at or above `1000001`. Its payload is:

```json
{
  "missingFrom": 3,
  "missingTo": 4,
  "reason": "sequence_gap",
  "interpretation": "missing_telemetry",
  "misconduct": false
}
```

The missing client sequences stay free. When those events arrive later, they are appended with their original timestamps, and a second note with `resolved: true` and `reason: "sequence_gap_resolved"` is added. The first note is kept. A range is resolved only when every sequence in that range has a real client event, and the same range is not resolved again. A late sequence outside the range does not close it. Two notes can name overlapping ranges; each note resolves only its own range. Neither note changes a grade or a mastery value.

Events that arrive together are sorted by sequence before the gap check, so a reordered batch does not create a false hole. A duplicate sequence is ignored.

Historical rows are different. Older gap notes were written on the missing client sequence, with `chain_index` equal to `seq` and `schema_version` 1. Those sequences are already occupied, so a late copy of the original event cannot replace them. Their text is not invented. The client sequence is still acknowledged, so the browser does not retry that row forever. The hash chain still verifies: new rows link to the last `chain_index`, and `received_at` stays null on the historical rows. New sessions do not occupy client sequences with quality notes.

Two ingest requests for the same session lock that `learning_sessions` row inside the append transaction, then plan and insert. A duplicate `(session_id, seq)` or `(session_id, chain_index)` does not overwrite the first row.

## Privacy and authorization

Only the student who owns the session can append or list its events. A graded session still requires a stored consent row, and the practice page still shows "This session is being recorded" for graded sessions. Keystrokes are not captured while graded mode is selected and consent has not been accepted.

Hidden tests and reference solutions are not added to event payloads. Run and submit events store outcomes and categories, not test bodies. The ingest path does not log editor text.

WebSocket ingest and `POST /api/sessions/:id/events` use the same event schema, the same `appendEvents` authorization and consent checks, and the same deduplication. A client cannot set `prevHash`, `chainIndex`, `receivedAt`, `schema_version`, or `misconduct`; those fields are removed from the payload, and the server writes the chain, the schema column, and `receivedAt`. An HTTP validation failure returns field messages from the schema, not the request body. The socket returns "Could not store events" for an invalid batch. Database failures and invalid JSON on both paths return that same sentence. Authorization and consent failures still return their own short messages, such as a forbidden session or missing graded consent.

## What this does not do

- Trainer replay of this log is described in `docs/PHASE2_REPLAY.md`.
- Integrity review of this log is described in `docs/PHASE2_INTEGRITY_REVIEW.md`. This ingest path still does not decide misconduct.
- It does not record keystrokes that happened before graded consent. The baseline at recording start includes the editor as it was then.
- It does not retry an unacknowledged batch after the tab is destroyed if the final keepalive request fails. That batch remains under its session key in `localStorage`.
