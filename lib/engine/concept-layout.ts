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

  // First pass: compute column depth for every concept
  const conceptColumns = concepts.map((concept) => ({
    concept,
    column: depthOf(concept.id),
  }));

  // Group concepts by column to calculate total height and center vertically
  const columnGroups = new Map<number, LayoutConcept[]>();
  for (const { concept, column } of conceptColumns) {
    const list = columnGroups.get(column) ?? [];
    list.push(concept);
    columnGroups.set(column, list);
  }

  const ROW_GAP = 160;
  const COL_GAP = 320;

  let maxRowsInAnyCol = 1;
  for (const list of columnGroups.values()) {
    if (list.length > maxRowsInAnyCol) {
      maxRowsInAnyCol = list.length;
    }
  }
  const totalGraphHeight = maxRowsInAnyCol * ROW_GAP;

  const result: ConceptNodePosition[] = [];
  for (const [colIndex, colConcepts] of columnGroups.entries()) {
    const colHeight = colConcepts.length * ROW_GAP;
    const startY = Math.max(0, (totalGraphHeight - colHeight) / 2);

    colConcepts.forEach((c, rowIdx) => {
      result.push({
        id: c.id,
        name: c.name,
        x: colIndex * COL_GAP + 40,
        y: startY + rowIdx * ROW_GAP + 40,
      });
    });
  }

  return result;
}
