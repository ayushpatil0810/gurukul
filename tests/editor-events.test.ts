import { describe, expect, it } from "vitest";

import {
  classifyModelChanges,
  reconstructDocument,
  type ClassifiedEdit,
} from "@/lib/engine/editor-events";

function apply(previous: string, edits: readonly ClassifiedEdit[]) {
  return reconstructDocument(
    previous,
    edits.map((edit, index) => ({ seq: index + 1, type: edit.type, payload: edit.payload })),
  );
}

describe("editor event reconstruction", () => {
  it("reconstructs insert, delete, replace, undo, and redo", () => {
    const steps: { text: string; edit: ClassifiedEdit }[] = [];
    let text = "";

    const insert = classifyModelChanges({
      previousText: text,
      changes: [{ rangeOffset: 0, rangeLength: 0, text: "ab" }],
      isUndoing: false,
      isRedoing: false,
      pasted: false,
      autocomplete: false,
    });
    expect(insert.map((edit) => edit.type)).toEqual(["insert"]);
    expect(insert[0]?.payload.removed).toBe("");
    text = "ab";
    steps.push({ text, edit: insert[0]! });

    const deleted = classifyModelChanges({
      previousText: text,
      changes: [{ rangeOffset: 1, rangeLength: 1, text: "" }],
      isUndoing: false,
      isRedoing: false,
      pasted: false,
      autocomplete: false,
    });
    expect(deleted[0]?.type).toBe("delete");
    expect(deleted[0]?.payload.removed).toBe("b");
    text = "a";
    steps.push({ text, edit: deleted[0]! });

    const replaced = classifyModelChanges({
      previousText: text,
      changes: [{ rangeOffset: 0, rangeLength: 1, text: "xy" }],
      isUndoing: false,
      isRedoing: false,
      pasted: false,
      autocomplete: false,
    });
    expect(replaced[0]?.type).toBe("replace");
    expect(replaced[0]?.payload).toMatchObject({ text: "xy", removed: "a", range: { start: 0, end: 1 } });
    text = "xy";
    steps.push({ text, edit: replaced[0]! });

    const undone = classifyModelChanges({
      previousText: text,
      changes: [{ rangeOffset: 0, rangeLength: 2, text: "a" }],
      isUndoing: true,
      isRedoing: false,
      pasted: false,
      autocomplete: false,
    });
    expect(undone[0]?.type).toBe("undo");
    text = "a";
    steps.push({ text, edit: undone[0]! });

    const redone = classifyModelChanges({
      previousText: text,
      changes: [{ rangeOffset: 0, rangeLength: 1, text: "xy" }],
      isUndoing: false,
      isRedoing: true,
      pasted: false,
      autocomplete: false,
    });
    expect(redone[0]?.type).toBe("redo");
    text = "xy";
    steps.push({ text, edit: redone[0]! });

    const timeline = reconstructDocument(
      "",
      steps.map((step, index) => ({ seq: index + 1, type: step.edit.type, payload: step.edit.payload })),
    );
    expect(timeline).toEqual({ ok: true, text: "xy" });
  });

  it("keeps every change from one editor callback", () => {
    const edits = classifyModelChanges({
      previousText: "hello",
      changes: [
        { rangeOffset: 0, rangeLength: 0, text: "X" },
        { rangeOffset: 5, rangeLength: 0, text: "!" },
      ],
      isUndoing: false,
      isRedoing: false,
      pasted: false,
      autocomplete: false,
    });
    expect(edits).toHaveLength(2);
    expect(edits.map((edit) => edit.payload.range.start)).toEqual([5, 0]);
    expect(apply("hello", edits)).toEqual({ ok: true, text: "Xhello!" });
  });

  it("records pasted and suggested text instead of only its length", () => {
    const pasted = classifyModelChanges({
      previousText: "hello",
      changes: [{ rangeOffset: 1, rangeLength: 3, text: "i" }],
      isUndoing: false,
      isRedoing: false,
      pasted: true,
      autocomplete: false,
    });
    expect(pasted[0]?.type).toBe("paste");
    expect(pasted[0]?.payload.removed).toBe("ell");
    expect(apply("hello", pasted)).toEqual({ ok: true, text: "hio" });

    const suggested = classifyModelChanges({
      previousText: "hio",
      changes: [{ rangeOffset: 3, rangeLength: 0, text: "()" }],
      isUndoing: false,
      isRedoing: false,
      pasted: false,
      autocomplete: true,
    });
    expect(suggested[0]?.type).toBe("autocomplete_accept");
    expect(suggested[0]?.payload.text).toBe("()");
  });

  it("does not invent source text for a legacy length-only event", () => {
    const result = reconstructDocument("ab", [
      { seq: 1, type: "insert", payload: { length: 1 } },
      { seq: 2, type: "insert", payload: { schemaVersion: 2, range: { start: 2, end: 2 }, text: "c", removed: "" } },
    ]);
    expect(result).toEqual({ ok: false, reason: "legacy_or_incomplete" });
    expect(result).not.toHaveProperty("text");
  });

  it("applies non-overlapping changes at different positions in end-to-start order", () => {
    const edits = classifyModelChanges({
      previousText: "hello",
      changes: [
        { rangeOffset: 0, rangeLength: 0, text: "X" },
        { rangeOffset: 4, rangeLength: 1, text: "" },
      ],
      isUndoing: false,
      isRedoing: false,
      pasted: false,
      autocomplete: false,
    });
    expect(edits.map((edit) => edit.type)).toEqual(["delete", "insert"]);
    expect(apply("hello", edits)).toEqual({ ok: true, text: "Xhell" });
  });

  it("applies a longer change before an insert at the same offset", () => {
    const edits = classifyModelChanges({
      previousText: "ab",
      changes: [
        { rangeOffset: 0, rangeLength: 0, text: "Z" },
        { rangeOffset: 0, rangeLength: 2, text: "" },
      ],
      isUndoing: false,
      isRedoing: false,
      pasted: false,
      autocomplete: false,
    });
    expect(edits.map((edit) => edit.payload.range)).toEqual([
      { start: 0, end: 2 },
      { start: 0, end: 0 },
    ]);
    expect(apply("ab", edits)).toEqual({ ok: true, text: "Z" });
  });

  it("refuses overlapping changes instead of guessing the document", () => {
    const edits = classifyModelChanges({
      previousText: "abcd",
      changes: [
        { rangeOffset: 1, rangeLength: 0, text: "X" },
        { rangeOffset: 1, rangeLength: 0, text: "Y" },
      ],
      isUndoing: false,
      isRedoing: false,
      pasted: false,
      autocomplete: false,
    });
    expect(edits.every((edit) => edit.payload.overlap === true)).toBe(true);
    const result = apply("abcd", edits);
    expect(result).toEqual({ ok: false, reason: "overlapping_changes" });
    expect(result).not.toHaveProperty("text");
  });

  it("ignores a no-op change and fails when a change cannot be placed", () => {
    expect(
      classifyModelChanges({
        previousText: "ab",
        changes: [{ rangeOffset: 0, rangeLength: 0, text: "" }],
        isUndoing: false,
        isRedoing: false,
        pasted: false,
        autocomplete: false,
      }),
    ).toEqual([]);

    const edits = classifyModelChanges({
      previousText: "ab",
      changes: [
        { rangeOffset: 0, rangeLength: 0, text: "Z" },
        { rangeOffset: 5, rangeLength: 1, text: "nope" },
      ],
      isUndoing: false,
      isRedoing: false,
      pasted: false,
      autocomplete: false,
    });
    expect(edits.every((edit) => edit.payload.incomplete === true)).toBe(true);
    const result = apply("ab", edits);
    expect(result).toEqual({ ok: false, reason: "legacy_or_incomplete" });
    expect(result).not.toHaveProperty("text");
  });

  it("fails when text, removed content, or the range is missing", () => {
    const base = { schemaVersion: 2, range: { start: 0, end: 0 }, text: "a", removed: "" };
    expect(reconstructDocument("", [{ seq: 1, type: "insert", payload: { ...base, removed: undefined } }])).toEqual({
      ok: false,
      reason: "legacy_or_incomplete",
    });
    expect(reconstructDocument("", [{ seq: 1, type: "insert", payload: { ...base, text: undefined } }])).toEqual({
      ok: false,
      reason: "legacy_or_incomplete",
    });
    expect(reconstructDocument("", [{ seq: 1, type: "delete", payload: { schemaVersion: 2, text: "", removed: "a" } }])).toEqual({
      ok: false,
      reason: "legacy_or_incomplete",
    });
  });

  it("applies a session baseline and later reconstructable edits", () => {
    const result = reconstructDocument("", [
      {
        seq: 2,
        type: "session_start",
        payload: { schemaVersion: 2, baseline: "cat" },
      },
      {
        seq: 1,
        type: "insert",
        payload: { schemaVersion: 2, range: { start: 3, end: 3 }, text: "s", removed: "" },
      },
    ]);
    expect(result).toEqual({ ok: true, text: "cats" });
  });
});
