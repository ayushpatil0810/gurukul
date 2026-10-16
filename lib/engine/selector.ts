import { DEFAULT_BKT_PARAMS, type BktParams } from "@/lib/engine/bkt";

export type SelectorConcept = {
  id: string;
  name: string;
};

export type SelectorEdge = {
  conceptId: string;
  requiresId: string;
};

export type SelectorQuestion = {
  id: string;
  conceptId: string;
  difficulty: number;
};

export type SelectorAlternative = {
  conceptId: string;
  name: string;
  mastery: number;
  note: string;
};

export type SelectorDecision = {
  conceptId: string;
  questionId: string | null;
  reason: string;
  alternatives: SelectorAlternative[];
  predictedSuccess: number | null;
};

/**
 * P(success) ≈ BKT opportunity probability, scaled down as difficulty rises.
 * Difficulty 1 keeps the base probability. Each step up multiplies by 0.9.
 */
export function predictedSuccess(
  pKnow: number,
  difficulty: number,
  params: BktParams = DEFAULT_BKT_PARAMS,
): number {
  const base = pKnow * (1 - params.slip) + (1 - pKnow) * params.guess;
  const factor = 1 - (difficulty - 1) * 0.1;
  return clamp01(base * factor);
}

export function selectNextQuestion(input: {
  goalId: string;
  concepts: readonly SelectorConcept[];
  edges: readonly SelectorEdge[];
  mastery: Readonly<Record<string, number>>;
  threshold: number;
  questions: readonly SelectorQuestion[];
  attemptedQuestionIds: readonly string[];
  pInit?: number;
  params?: BktParams;
}): SelectorDecision {
  const params = input.params ?? DEFAULT_BKT_PARAMS;
  const pInit = input.pInit ?? params.pInit;
  const names = new Map(input.concepts.map((concept) => [concept.id, concept.name]));
  const masteryOf = (id: string) => input.mastery[id] ?? pInit;
  const prereqs = directPrereqs(input.edges);
  const ancestorIds = collectAncestors(input.goalId, prereqs);
  const scope = [...ancestorIds, input.goalId];
  const ready = (id: string) => (prereqs.get(id) ?? []).every((required) => masteryOf(required) >= input.threshold);

  const readyBelow = scope
    .filter((id) => ready(id) && masteryOf(id) < input.threshold)
    .sort((left, right) => masteryOf(left) - masteryOf(right) || left.localeCompare(right));

  const ancestorsMastered = ancestorIds.every((id) => masteryOf(id) >= input.threshold);
  const chosen = readyBelow[0] ?? input.goalId;
  const goalName = names.get(input.goalId) ?? "the goal";
  const chosenName = names.get(chosen) ?? chosen;
  const mastery = masteryOf(chosen);
  const reason =
    chosen === input.goalId && ancestorsMastered && mastery >= input.threshold
      ? `${chosenName} is the goal, and every prerequisite is at or above ${input.threshold.toFixed(2)}.`
      : `${chosenName} is your weakest ready concept for ${goalName} at ${mastery.toFixed(2)}.`;

  const alternatives = scope
    .filter((id) => id !== chosen)
    .map((id) => ({
      conceptId: id,
      name: names.get(id) ?? id,
      mastery: masteryOf(id),
      note: ready(id)
        ? masteryOf(id) >= input.threshold
          ? "Already at the threshold."
          : "Ready, with higher mastery."
        : "Waiting on a prerequisite.",
    }))
    .sort((left, right) => left.conceptId.localeCompare(right.conceptId));

  const attempted = new Set(input.attemptedQuestionIds);
  const forConcept = input.questions.filter((question) => question.conceptId === chosen);
  const fresh = forConcept.filter((question) => !attempted.has(question.id));
  const candidates = fresh.length > 0 ? fresh : forConcept;
  let best: SelectorQuestion | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestPredicted: number | null = null;

  for (const question of candidates) {
    const predicted = predictedSuccess(mastery, question.difficulty, params);
    const distance = Math.abs(predicted - 0.7);
    const closer = distance < bestDistance - 1e-12;
    const tie = Math.abs(distance - bestDistance) <= 1e-12 && (best === null || question.id < best.id);
    if (closer || tie) {
      best = question;
      bestDistance = distance;
      bestPredicted = predicted;
    }
  }

  return {
    conceptId: chosen,
    questionId: best?.id ?? null,
    reason,
    alternatives,
    predictedSuccess: bestPredicted,
  };
}

function directPrereqs(edges: readonly SelectorEdge[]): Map<string, string[]> {
  const prereqs = new Map<string, string[]>();
  for (const edge of edges) {
    const list = prereqs.get(edge.conceptId) ?? [];
    list.push(edge.requiresId);
    prereqs.set(edge.conceptId, list);
  }
  return prereqs;
}

function collectAncestors(goalId: string, prereqs: ReadonlyMap<string, readonly string[]>): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  const stack = [...(prereqs.get(goalId) ?? [])];
  while (stack.length > 0) {
    const id = stack.pop();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    found.push(id);
    for (const next of prereqs.get(id) ?? []) stack.push(next);
  }
  return found;
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
