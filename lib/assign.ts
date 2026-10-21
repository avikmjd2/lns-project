export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Pick the form with fewer participants (ties random). Counts should be within the same listener gender. */
export function pickForm(countA: number, countB: number): "A" | "B" {
  if (countA === countB) return Math.random() < 0.5 ? "A" : "B";
  return countA < countB ? "A" : "B";
}
