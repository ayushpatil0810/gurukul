const BLOCKED_PAYLOAD_KEYS = new Set([
  "receivedAt",
  "received_at",
  "prevHash",
  "prev_hash",
  "chainIndex",
  "chain_index",
  "schema_version",
  "misconduct",
]);

export function sanitizeClientPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (BLOCKED_PAYLOAD_KEYS.has(key)) continue;
    next[key] = value;
  }
  return next;
}

export function gradedRecordingAllowed(session: { mode: string; consentId: string | null }): boolean {
  return session.mode !== "graded" || session.consentId !== null;
}
