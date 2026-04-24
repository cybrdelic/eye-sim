export type CandidateScore<T> = {
  item: T;
  score: number;
  reasons?: Record<string, number>;
};

export function selectBestCandidate<T>(candidates: CandidateScore<T>[], opts?: { minScore?: number; tieBreakEpsilon?: number }) {
  const minScore = opts?.minScore ?? -Infinity;
  const eps = opts?.tieBreakEpsilon ?? 1e-6;

  if (candidates.length === 0) return null;

  let best: CandidateScore<T> | null = null;
  let secondBest: CandidateScore<T> | null = null;

  for (const c of candidates) {
    if (!best || c.score > best.score) {
      secondBest = best;
      best = c;
    } else if (!secondBest || c.score > secondBest.score) {
      secondBest = c;
    }
  }

  if (!best || best.score < minScore) return null;

  if (secondBest && Math.abs(best.score - secondBest.score) <= eps) {
    // Tie: caller should add more discriminators.
    return { best, secondBest, isTie: true as const };
  }

  return { best, secondBest, isTie: false as const };
}
