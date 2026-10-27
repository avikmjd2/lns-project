export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Pick the form with fewer participants (ties random). Kept for backwards compatibility. */
export function pickForm(countA: number, countB: number): "A" | "B" {
  if (countA === countB) return Math.random() < 0.5 ? "A" : "B";
  return countA < countB ? "A" : "B";
}

/**
 * Every listener hears exactly 4 clips: one per speaker (F1, F2, M1, M2).
 * Within the female pair the two clips have opposite styles, and so do the two male clips.
 * N = Hindi + English (mixed), H = Hindi only (pure).
 *   Female options: FA = F1_N + F2_H,  FB = F1_H + F2_N
 *   Male options:   MA = M1_N + M2_H,  MB = M1_H + M2_N
 *   Combos: A = FA+MA, B = FA+MB, C = FB+MA, D = FB+MB
 */
export type Combo = "A" | "B" | "C" | "D";
export const COMBOS: Combo[] = ["A", "B", "C", "D"];

const FEMALE_OPTIONS: [string, string][] = [["F1_N", "F2_H"], ["F1_H", "F2_N"]];
const MALE_OPTIONS: [string, string][] = [["M1_N", "M2_H"], ["M1_H", "M2_N"]];

export function buildAssignment(c: Combo): string[] {
  const f = FEMALE_OPTIONS[c === "A" || c === "B" ? 0 : 1];
  const m = MALE_OPTIONS[c === "A" || c === "C" ? 0 : 1];
  return [...f, ...m];
}

/** Least-filled combo wins; ties are broken at random. */
export function pickCombo(counts: Record<Combo, number>): Combo {
  const min = Math.min(...COMBOS.map((c) => counts[c]));
  const lowest = COMBOS.filter((c) => counts[c] === min);
  return lowest[Math.floor(Math.random() * lowest.length)];
}
