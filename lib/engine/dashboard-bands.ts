export type MasteryBand = "not_recorded" | "below_threshold" | "solid";

export type HeatCell = {
  studentId: string;
  conceptId: string;
  pKnow: number | null;
  band: MasteryBand;
  label: string;
};

export type CohortInsight = {
  conceptId: string;
  name: string;
  students: number;
  recorded: number;
  below: number;
  blocking: number;
  mean: number | null;
  belowThreshold: boolean;
};

const keyOf = (studentId: string, conceptId: string) => `${studentId}\0${conceptId}`;

export function masteryBand(pKnow: number | null, threshold: number): MasteryBand {
  if (pKnow === null || Number.isNaN(pKnow)) return "not_recorded";
  if (pKnow >= threshold) return "solid";
  return "below_threshold";
}

export function formatMastery(pKnow: number): string {
  return `${Math.round(pKnow * 100)}% (${pKnow.toFixed(2)})`;
}

export function masteryLabel(pKnow: number | null, threshold: number): string {
  const band = masteryBand(pKnow, threshold);
  if (band === "not_recorded" || pKnow === null) return "Not recorded";
  if (band === "solid") return `Solid, ${formatMastery(pKnow)}`;
  return `Below threshold, ${formatMastery(pKnow)}`;
}

export function orderByPrerequisite(
  ids: readonly string[],
  edges: readonly { conceptId: string; requiresId: string }[],
): string[] {
  const indegree = new Map(ids.map((id) => [id, 0]));
  const dependents = new Map<string, string[]>();
  for (const edge of edges) {
    if (!indegree.has(edge.conceptId) || !indegree.has(edge.requiresId)) continue;
    indegree.set(edge.conceptId, (indegree.get(edge.conceptId) ?? 0) + 1);
    const next = dependents.get(edge.requiresId) ?? [];
    next.push(edge.conceptId);
    dependents.set(edge.requiresId, next);
  }
  const ready = ids.filter((id) => (indegree.get(id) ?? 0) === 0).sort((a, b) => a.localeCompare(b));
  const ordered: string[] = [];
  while (ready.length > 0) {
    const id = ready.shift();
    if (!id) break;
    ordered.push(id);
    for (const dependent of dependents.get(id) ?? []) {
      const degree = (indegree.get(dependent) ?? 1) - 1;
      indegree.set(dependent, degree);
      if (degree === 0) {
        ready.push(dependent);
        ready.sort((a, b) => a.localeCompare(b));
      }
    }
  }
  for (const id of [...ids].sort((a, b) => a.localeCompare(b))) {
    if (!ordered.includes(id)) ordered.push(id);
  }
  return ordered;
}

export function assembleHeatmap(input: {
  studentIds: readonly string[];
  conceptIds: readonly string[];
  mastery: ReadonlyMap<string, number>;
  threshold: number;
}): HeatCell[] {
  const cells: HeatCell[] = [];
  for (const studentId of input.studentIds) {
    for (const conceptId of input.conceptIds) {
      const stored = input.mastery.get(keyOf(studentId, conceptId));
      const pKnow = stored === undefined ? null : stored;
      cells.push({
        studentId,
        conceptId,
        pKnow,
        band: masteryBand(pKnow, input.threshold),
        label: masteryLabel(pKnow, input.threshold),
      });
    }
  }
  return cells;
}

export function summarizeCohort(input: {
  students: readonly { id: string }[];
  concepts: readonly { id: string; name: string }[];
  edges: readonly { conceptId: string; requiresId: string }[];
  mastery: ReadonlyMap<string, number>;
  threshold: number;
}): CohortInsight[] {
  const dependents = new Map<string, string[]>();
  for (const edge of input.edges) {
    const list = dependents.get(edge.requiresId) ?? [];
    list.push(edge.conceptId);
    dependents.set(edge.requiresId, list);
  }
  return input.concepts.map((concept) => {
    const values = input.students.map((student) => input.mastery.get(keyOf(student.id, concept.id)) ?? null);
    const recordedValues = values.filter((value): value is number => value !== null);
    const mean = recordedValues.length === 0 ? null : recordedValues.reduce((sum, value) => sum + value, 0) / recordedValues.length;
    const below = recordedValues.filter((value) => value < input.threshold).length;
    const blocksSomething = (dependents.get(concept.id) ?? []).length > 0;
    const blocking = blocksSomething
      ? input.students.filter((student) => {
          const value = input.mastery.get(keyOf(student.id, concept.id));
          return value !== undefined && value < input.threshold;
        }).length
      : 0;
    return {
      conceptId: concept.id,
      name: concept.name,
      students: input.students.length,
      recorded: recordedValues.length,
      below,
      blocking,
      mean,
      belowThreshold: mean !== null && mean < input.threshold,
    };
  });
}

export function masteryKey(studentId: string, conceptId: string): string {
  return keyOf(studentId, conceptId);
}

export type ExplanationCounts = {
  status: "open" | "answered" | "unavailable";
  yes: number;
  partial: number;
  no: number;
  needsReview: number;
};

export function explanationLabel(summary: ExplanationCounts | null): string {
  if (!summary) return "No explanation";
  if (summary.status === "unavailable") return "Not enough structure to ask questions";
  if (summary.status === "open") return "Questions ready, not answered";
  const parts: string[] = [];
  if (summary.yes > 0) parts.push(`${summary.yes} correct`);
  if (summary.partial > 0) parts.push(`${summary.partial} partially correct`);
  if (summary.no > 0) parts.push(`${summary.no} incorrect`);
  if (summary.needsReview > 0) parts.push(`${summary.needsReview} need review`);
  return parts.length > 0 ? parts.join(", ") : "Answered";
}
