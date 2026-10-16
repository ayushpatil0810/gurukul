export type PrerequisiteEdge = {
  conceptId: string;
  requiresId: string;
};

export type CycleCheck =
  | { ok: true }
  | { ok: false; message: string; path: string[] };

function label(id: string, names: ReadonlyMap<string, string>): string {
  return names.get(id) ?? id;
}

/**
 * Edge direction: conceptId depends on requiresId.
 * Adding the edge is rejected when it would close a directed cycle.
 */
export function checkPrerequisiteEdge(
  edges: readonly PrerequisiteEdge[],
  conceptId: string,
  requiresId: string,
  names: ReadonlyMap<string, string> = new Map(),
): CycleCheck {
  if (conceptId === requiresId) {
    return {
      ok: false,
      path: [conceptId, conceptId],
      message: `A concept cannot be a prerequisite of itself (${label(conceptId, names)}).`,
    };
  }

  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const next = adjacency.get(edge.conceptId) ?? [];
    next.push(edge.requiresId);
    adjacency.set(edge.conceptId, next);
  }

  const path = findPath(adjacency, requiresId, conceptId);
  if (!path) return { ok: true };

  const cycle = [conceptId, ...path];
  const rendered = cycle.map((id) => label(id, names)).join(" → ");
  return {
    ok: false,
    path: cycle,
    message: `Adding this prerequisite would create a cycle: ${rendered}. A concept map must stay a directed acyclic graph.`,
  };
}

function findPath(
  adjacency: ReadonlyMap<string, readonly string[]>,
  start: string,
  goal: string,
): string[] | null {
  const seen = new Set<string>();
  const stack: { id: string; path: string[] }[] = [{ id: start, path: [start] }];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || seen.has(current.id)) continue;
    seen.add(current.id);

    for (const next of adjacency.get(current.id) ?? []) {
      const nextPath = [...current.path, next];
      if (next === goal) return nextPath;
      if (!seen.has(next)) stack.push({ id: next, path: nextPath });
    }
  }

  return null;
}
