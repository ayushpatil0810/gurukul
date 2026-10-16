export type BufferedCapture = {
  type: string;
  payload: Record<string, unknown>;
  at: number;
};

/**
 * Events flushed when a session row is created. Edits that happened while the
 * session request was in flight keep their original timestamps. The recording
 * clock starts at the earliest of those edits, or at `now` when nothing was buffered.
 * `session_start` is last so its sequence follows the edits it baselines.
 */
export function openRecording(input: {
  buffered: readonly BufferedCapture[];
  now: number;
  mode: string;
  baseline: string;
}): { originMs: number; entries: BufferedCapture[] } {
  const originMs = input.buffered.reduce((earliest, edit) => Math.min(earliest, edit.at), input.now);
  return {
    originMs,
    entries: [
      ...input.buffered.map((edit) => ({ type: edit.type, payload: edit.payload, at: edit.at })),
      {
        type: "session_start",
        payload: { mode: input.mode, baseline: input.baseline },
        at: input.now,
      },
    ],
  };
}
