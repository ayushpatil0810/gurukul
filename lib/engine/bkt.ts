export type BktParams = {
  pInit: number;
  learn: number;
  slip: number;
  guess: number;
};

export const DEFAULT_BKT_PARAMS: BktParams = {
  pInit: 0.2,
  learn: 0.15,
  slip: 0.1,
  guess: 0.2,
};

/** Posterior probability of knowing the concept given one observation. */
export function bktPosterior(pKnow: number, correct: boolean, params: BktParams): number {
  if (correct) {
    const numerator = pKnow * (1 - params.slip);
    return numerator / (numerator + (1 - pKnow) * params.guess);
  }
  const numerator = pKnow * params.slip;
  return numerator / (numerator + (1 - pKnow) * (1 - params.guess));
}

/** BKT update: posterior, then a learning transition. */
export function bktUpdate(pKnow: number, correct: boolean, params: BktParams = DEFAULT_BKT_PARAMS): number {
  const posterior = bktPosterior(pKnow, correct, params);
  return clamp01(posterior + (1 - posterior) * params.learn);
}

/** A coding attempt is correct only when the hidden-test pass rate meets the threshold. */
export function attemptIsCorrect(passRate: number, threshold = 1): boolean {
  return passRate >= threshold;
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
