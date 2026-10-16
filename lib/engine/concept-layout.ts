export type LayoutConcept = { id: string; name: string };
export type LayoutEdge = { conceptId: string; requiresId: string };

export type ConceptNodePosition = {
  id: string;
  name: string;
  x: number;
  y: number;
};

/**
 * Places prerequisites to the left of the concepts that depend on them.
 */
export function layoutConceptMap(
  concepts: readonly LayoutConcept[],
  edges: readonly LayoutEdge[],
): ConceptNodePosition[] {
  const depth = new Map<string, number>();
  const visiting = new Set<string>();

  function depthOf(id: string): number {
    const known = depth.get(id);
    if (known !== undefined) return known;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const prerequisites = edges
      .filter((edge) => edge.conceptId === id)
      .map((edge) => depthOf(edge.requiresId));
    const value = prerequisites.length === 0 ? 0 : 1 + Math.max(...prerequisites);
    visiting.delete(id);
    depth.set(id, value);
    return value;
  }

  const rows = new Map<number, number>();
  return concepts.map((concept) => {
    const column = depthOf(concept.id);
    const row = rows.get(column) ?? 0;
    rows.set(column, row + 1);
    return {
      id: concept.id,
      name: concept.name,
      x: column * 260,
      y: row * 110,
    };
  });
}
