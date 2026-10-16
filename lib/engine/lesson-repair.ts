export type PhraseRepair = { from: string; to: string };

export function applyPhraseRepair<T extends { id: string }>(
  scenes: T[],
  sceneId: string,
  phrases: PhraseRepair[],
): { ok: true; scenes: T[] } | { ok: false; reason: string } {
  if (phrases.length === 0 || phrases.some((phrase) => phrase.from.length === 0)) {
    return { ok: false, reason: "The repair text was empty." };
  }
  const index = scenes.findIndex((scene) => scene.id === sceneId);
  if (index < 0) return { ok: false, reason: "That scene is not stored." };
  const seen = new Set<string>();
  const next = scenes.map((scene, item) => (item === index ? (rewrite(structuredClone(scene), phrases, seen) as T) : scene));
  if (phrases.some((phrase) => !seen.has(phrase.from))) {
    return { ok: false, reason: "The repair text was not found in that scene." };
  }
  return { ok: true, scenes: next };
}

function rewrite(value: unknown, phrases: PhraseRepair[], seen: Set<string>): unknown {
  if (typeof value === "string") {
    let next = value;
    for (const phrase of phrases) {
      if (!next.includes(phrase.from)) continue;
      seen.add(phrase.from);
      next = next.split(phrase.from).join(phrase.to);
    }
    return next;
  }
  if (Array.isArray(value)) return value.map((item) => rewrite(item, phrases, seen));
  if (value && typeof value === "object") {
    const next: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) next[key] = rewrite(child, phrases, seen);
    return next;
  }
  return value;
}
