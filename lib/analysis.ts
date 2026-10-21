import type { RatingRow } from "./admin-data";
import { mean, sd, tPValue, welch, type TTest } from "./stats";

export type Measure = "composite" | "friendly" | "likable" | "like_me" | "educated" | "confident";
export const MEASURES: Measure[] = ["composite", "friendly", "likable", "like_me", "educated", "confident"];

export type Cell = { listener: "male" | "female"; speaker: "male" | "female"; guise: "mixed" | "pure"; mean: number; sd: number; n: number };

export function cells(rows: RatingRow[], m: Measure): Cell[] {
  const out: Cell[] = [];
  for (const guise of ["mixed", "pure"] as const)
    for (const speaker of ["male", "female"] as const)
      for (const listener of ["male", "female"] as const) {
        const v = rows.filter((r) => r.guise === guise && r.speaker_gender === speaker && r.listener_gender === listener).map((r) => r[m]);
        out.push({ listener, speaker, guise, mean: mean(v), sd: sd(v), n: v.length });
      }
  return out;
}

/**
 * Per listener: (rating of male speaker) - (rating of female speaker) within one guise.
 * Each completed listener hears exactly one speaker of each gender per guise, so this is a clean
 * within-person difference. Positive = the male speaker was rated higher.
 */
function diffs(rows: RatingRow[], guise: "mixed" | "pure", listener: "male" | "female", m: Measure) {
  const by = new Map<string, { male: number[]; female: number[] }>();
  for (const r of rows) {
    if (r.guise !== guise || r.listener_gender !== listener) continue;
    const e = by.get(r.participant_id) ?? { male: [], female: [] };
    e[r.speaker_gender].push(r[m]);
    by.set(r.participant_id, e);
  }
  const out: number[] = [];
  by.forEach((e) => { if (e.male.length && e.female.length) out.push(mean(e.male) - mean(e.female)); });
  return out;
}

export type GuiseTests = {
  guise: "mixed" | "pure";
  maleListeners: { d: number[]; mean: number; t: TTest | null };   // one-sample vs 0 (paired male-vs-female speaker)
  femaleListeners: { d: number[]; mean: number; t: TTest | null };
  interaction: TTest | null;                                       // Welch: male-listener diffs vs female-listener diffs
};

function oneSampleT(d: number[]): TTest | null {
  if (d.length < 2) return null;
  const m = mean(d), s = sd(d);
  if (!s) return null;
  const t = m / (s / Math.sqrt(d.length));
  return { t, df: d.length - 1, p: tPValue(t, d.length - 1), meanA: m, meanB: 0, nA: d.length, nB: d.length };
}
export function tests(rows: RatingRow[], guise: "mixed" | "pure", m: Measure): GuiseTests {
  const dm = diffs(rows, guise, "male", m), df = diffs(rows, guise, "female", m);
  return {
    guise,
    maleListeners: { d: dm, mean: mean(dm), t: oneSampleT(dm) },
    femaleListeners: { d: df, mean: mean(df), t: oneSampleT(df) },
    interaction: welch(dm, df),
  };
}

export type Verdict = "supported" | "partly supported" | "not supported" | "not enough data";

/** H1: male listeners favour male speakers (diff>0) AND female listeners favour female speakers (diff<0). */
export function verdictH1(g: GuiseTests): { v: Verdict; why: string } {
  const a = g.maleListeners, b = g.femaleListeners;
  if (a.d.length < 3 || b.d.length < 3) return { v: "not enough data", why: "Need at least 3 completed listeners per gender." };
  const dirM = a.mean > 0, dirF = b.mean < 0;
  const sigI = (g.interaction?.p ?? 1) < 0.05;
  if (dirM && dirF && sigI) return { v: "supported", why: "Both listener groups lean toward their own gender and the groups differ significantly (p<.05)." };
  if (dirM && dirF) return { v: "partly supported", why: "Both groups lean toward their own gender, but the group difference is not significant." };
  const sigM = dirM && (a.t?.p ?? 1) < 0.05, sigF = dirF && (b.t?.p ?? 1) < 0.05;
  if (sigM || sigF) return { v: "partly supported", why: "Only one listener group significantly favours its own gender." };
  return { v: "not supported", why: "Neither group favours its own gender." };
}

/** H2: male listeners rate female code-mixers lower than male code-mixers; female listeners rate them about equally. */
export function verdictH2(g: GuiseTests): { v: Verdict; why: string } {
  const a = g.maleListeners, b = g.femaleListeners;
  if (a.d.length < 3 || b.d.length < 3) return { v: "not enough data", why: "Need at least 3 completed listeners per gender." };
  const maleGap = a.mean > 0, maleSig = (a.t?.p ?? 1) < 0.05, femaleSig = (b.t?.p ?? 1) < 0.05;
  if (maleGap && maleSig && !femaleSig) return { v: "supported", why: "Male listeners rate female code-mixers significantly lower; female listeners show no significant gap." };
  const trend = maleGap && (a.t?.p ?? 1) < 0.1;
  if (maleGap && (maleSig || trend)) return { v: "partly supported", why: maleSig ? "Male listeners show the gap, but female listeners do too." : "Male listeners show a trend toward rating female speakers lower (p<.10), not significant at .05." };
  if (maleGap && !maleSig && femaleSig) return { v: "not supported", why: "Male listeners show no significant gap, while female listeners do (opposite of the predicted pattern)." };
  return { v: "not supported", why: "Male listeners do not rate female code-mixers lower than male code-mixers." };
}
