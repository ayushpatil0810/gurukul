export const EDITOR_SCHEMA_VERSION = 2;

export const editorEventTypes = [
  "insert",
  "delete",
  "replace",
  "paste",
  "undo",
  "redo",
  "autocomplete_accept",
] as const;

export type EditorEventType = (typeof editorEventTypes)[number];

export type EditorChangeInput = {
  rangeOffset: number;
  rangeLength: number;
  text: string;
};

export type EditorEventPayload = {
  schemaVersion: typeof EDITOR_SCHEMA_VERSION;
  range: { start: number; end: number };
  text: string;
  removed: string;
  length: number;
  removedLength: number;
  overlap?: true;
  incomplete?: true;
};

export type ClassifiedEdit = {
  type: EditorEventType;
  payload: EditorEventPayload;
};

const editorTypeSet = new Set<string>(editorEventTypes);

export function classifyModelChanges(input: {
  previousText: string;
  changes: readonly EditorChangeInput[];
  isUndoing: boolean;
  isRedoing: boolean;
  pasted: boolean;
  autocomplete: boolean;
}): ClassifiedEdit[] {
  const meaningful = input.changes.filter((change) => change.rangeLength > 0 || change.text.length > 0);
  const ordered = meaningful
    .filter((change) => {
      const start = change.rangeOffset;
      const end = change.rangeOffset + change.rangeLength;
      return Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end >= start && end <= input.previousText.length;
    })
    .sort((left, right) => {
      if (left.rangeOffset !== right.rangeOffset) return right.rangeOffset - left.rangeOffset;
      return right.rangeLength - left.rangeLength;
    });
  const unplaced = ordered.length !== meaningful.length;
  const spans = ordered.map((change) => ({
    start: change.rangeOffset,
    end: change.rangeOffset + change.rangeLength,
  }));
  const overlap = spans.some((left, index) => spans.slice(index + 1).some((right) => rangesOverlap(left, right)));
  const edits: ClassifiedEdit[] = [];
  for (const change of ordered) {
    const start = change.rangeOffset;
    const end = change.rangeOffset + change.rangeLength;
    const removed = input.previousText.slice(start, end);
    const text = change.text;
    if (removed.length === 0 && text.length === 0) continue;
    edits.push({
      type: classifyChange(input, removed, text),
      payload: {
        schemaVersion: EDITOR_SCHEMA_VERSION,
        range: { start, end },
        text,
        removed,
        length: text.length,
        removedLength: removed.length,
        ...(overlap ? { overlap: true as const } : {}),
        ...(unplaced ? { incomplete: true as const } : {}),
      },
    });
  }
  if (edits.length === 0 && unplaced) {
    return [
      {
        type: classifyChange(input, "?", "?"),
        payload: {
          schemaVersion: EDITOR_SCHEMA_VERSION,
          range: { start: 0, end: 0 },
          text: "",
          removed: "",
          length: 0,
          removedLength: 0,
          incomplete: true,
        },
      },
    ];
  }
  return edits;
}

export function isReconstructableEditorPayload(payload: unknown): payload is EditorEventPayload {
  if (!payload || typeof payload !== "object") return false;
  const record = payload as Record<string, unknown>;
  if (record.schemaVersion !== EDITOR_SCHEMA_VERSION) return false;
  if (record.overlap === true || record.incomplete === true) return false;
  if (typeof record.text !== "string" || typeof record.removed !== "string") return false;
  const range = record.range;
  if (!range || typeof range !== "object") return false;
  const start = (range as { start?: unknown }).start;
  const end = (range as { end?: unknown }).end;
  return typeof start === "number" && typeof end === "number" && start >= 0 && end >= start;
}

export type Reconstruction =
  | { ok: true; text: string }
  | { ok: false; reason: "legacy_or_incomplete" | "removed_mismatch" | "overlapping_changes" };

/** One editor event, using the same checks as a full reconstruction. Non-editor events leave the text unchanged. */
export function applyEditorEvent(text: string, event: { type: string; payload: unknown }): Reconstruction {
  if (!editorTypeSet.has(event.type)) return { ok: true, text };
  if (event.payload && typeof event.payload === "object" && (event.payload as { overlap?: unknown }).overlap === true) {
    return { ok: false, reason: "overlapping_changes" };
  }
  if (!isReconstructableEditorPayload(event.payload)) return { ok: false, reason: "legacy_or_incomplete" };
  const actual = text.slice(event.payload.range.start, event.payload.range.end);
  if (actual !== event.payload.removed) return { ok: false, reason: "removed_mismatch" };
  return {
    ok: true,
    text: text.slice(0, event.payload.range.start) + event.payload.text + text.slice(event.payload.range.end),
  };
}

export function reconstructDocument(
  initial: string,
  events: readonly { seq: number; type: string; payload: unknown }[],
): Reconstruction {
  const baselineEvent = [...events]
    .filter((event) => event.type === "session_start")
    .sort((left, right) => left.seq - right.seq)
    .at(-1);
  const baseline =
    baselineEvent &&
    baselineEvent.payload &&
    typeof baselineEvent.payload === "object" &&
    typeof (baselineEvent.payload as { baseline?: unknown }).baseline === "string"
      ? (baselineEvent.payload as { baseline: string }).baseline
      : initial;

  const editorEvents = events
    .filter((event) => editorTypeSet.has(event.type))
    .sort((left, right) => left.seq - right.seq);

  let text = baseline;
  for (const event of editorEvents) {
    const applied = applyEditorEvent(text, event);
    if (!applied.ok) return applied;
    text = applied.text;
  }
  return { ok: true, text };
}

function rangesOverlap(left: { start: number; end: number }, right: { start: number; end: number }): boolean {
  if (left.start === left.end && right.start === right.end) return left.start === right.start;
  return left.start < right.end && right.start < left.end;
}

function classifyChange(
  input: { isUndoing: boolean; isRedoing: boolean; pasted: boolean; autocomplete: boolean },
  removed: string,
  text: string,
): EditorEventType {
  if (input.isUndoing) return "undo";
  if (input.isRedoing) return "redo";
  if (input.pasted) return "paste";
  if (input.autocomplete) return "autocomplete_accept";
  if (removed.length > 0 && text.length > 0) return "replace";
  if (removed.length > 0) return "delete";
  return "insert";
}
