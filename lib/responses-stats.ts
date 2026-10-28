import type { RatingRow } from "./admin-data";
import type { Question } from "./db";
import { mean, sd } from "./stats";

/** One participant (started or completed) as loaded for the Responses page. */
export type PRow = {
  id: string; listener_gender: string; age: number | null; first_language: string | null; form: string;
  repeat_device: boolean; started_at: string | Date; completed_at: string | Date | null; n_rated: number; n_total: number;
};

export const GENDER_LABEL: Record<string, string> = { male: "Male", female: "Female", other: "Other", na: "Prefer not to say" };
const AGE_GROUPS: [number, number, string][] = [[18, 20, "18–20"], [21, 24, "21–24"], [25, 29, "25–29"], [30, 39, "30–39"], [40, 49, "40–49"], [50, 120, "50+"]];
export const ageGroup = (age: number | null) => AGE_GROUPS.find(([lo, hi]) => age != null && age >= lo && age <= hi)?.[2] ?? "Unknown";

export type DimKey = "gender" | "age" | "language" | "combo" | "device";
export const DIMS: { key: DimKey; label: string; of: (p: PRow) => string; order?: string[] }[] = [
  { key: "gender", label: "Gender", of: (p) => GENDER_LABEL[p.listener_gender] ?? p.listener_gender, order: ["Male", "Female", "Other", "Prefer not to say"] },
  { key: "age", label: "Age group", of: (p) => ageGroup(p.age), order: [...AGE_GROUPS.map((g) => g[2]), "Unknown"] },
  { key: "language", label: "First language", of: (p) => p.first_language?.trim() || "Not given" },
  { key: "combo", label: "Clip combination", of: (p) => p.form, order: ["A", "B", "C", "D"] },
  { key: "device", label: "Device", of: (p) => (p.repeat_device ? "Same device as an earlier response" : "New device") },
];

const ms = (d: string | Date | null) => (d ? new Date(d).getTime() : NaN);
const minutes = (p: PRow) => (ms(p.completed_at) - ms(p.started_at)) / 60000;

export function median(x: number[]) {
  const a = x.filter(Number.isFinite).sort((p, q) => p - q);
  if (!a.length) return NaN;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
export function quantile(x: number[], q: number) {
  const a = x.filter(Number.isFinite).sort((p, r) => p - r);
  if (!a.length) return NaN;
  const pos = (a.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return a[lo] + (a[hi] - a[lo]) * (pos - lo);
}

/** Average rescaled rating and % of audio played, per completed participant. */
function perParticipant(ratings: RatingRow[]) {
  const m = new Map<string, { comp: number[]; played: number[] }>();
  for (const r of ratings) {
    const e = m.get(r.participant_id) ?? { comp: [], played: [] };
    if (Number.isFinite(r.composite)) e.comp.push(r.composite);
    if (r.played_pct != null) e.played.push(r.played_pct);
    m.set(r.participant_id, e);
  }
  return new Map([...m].map(([id, e]) => [id, { composite: mean(e.comp), played: mean(e.played) }]));
}

export type Group = {
  key: string; started: number; completed: number; completionPct: number;
  meanAge: number; medianMinutes: number; meanComposite: number; meanPlayed: number;
};

function orderKeys(keys: string[], order?: string[]) {
  return [...keys].sort((a, b) => {
    if (order) { const ia = order.indexOf(a), ib = order.indexOf(b); if (ia !== ib) return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib); }
    return a.localeCompare(b);
  });
}

/** Counts and averages for every value of one dimension (gender, age group, language, ...). */
export function breakdown(rows: PRow[], ratings: RatingRow[], dim: (typeof DIMS)[number]): Group[] {
  const pp = perParticipant(ratings);
  const by = new Map<string, PRow[]>();
  for (const r of rows) (by.get(dim.of(r)) ?? by.set(dim.of(r), []).get(dim.of(r))!).push(r);
  const groups = [...by].map(([key, list]) => {
    const done = list.filter((p) => p.completed_at);
    return {
      key, started: list.length, completed: done.length, completionPct: list.length ? (done.length / list.length) * 100 : NaN,
      meanAge: mean(list.map((p) => p.age).filter((a): a is number => a != null)),
      medianMinutes: median(done.map(minutes)),
      meanComposite: mean(done.map((p) => pp.get(p.id)?.composite ?? NaN).filter(Number.isFinite)),
      meanPlayed: mean(done.map((p) => pp.get(p.id)?.played ?? NaN).filter(Number.isFinite)),
    };
  });
  const order = orderKeys(groups.map((g) => g.key), dim.order);
  const byKey = new Map(groups.map((g) => [g.key, g]));
  // Without a fixed order (e.g. languages) put the biggest groups first.
  return dim.order ? order.map((k) => byKey.get(k)!) : groups.sort((a, b) => b.started - a.started || a.key.localeCompare(b.key));
}

/** Completed participants: rows = one dimension, columns = another (e.g. age group by gender). */
export function crosstab(rows: PRow[], rowDim: (typeof DIMS)[number], colDim: (typeof DIMS)[number]) {
  const done = rows.filter((p) => p.completed_at);
  const rowKeys = breakdown(done, [], rowDim).map((g) => g.key);
  const colKeys = breakdown(done, [], colDim).map((g) => g.key);
  const cell = (r: string, c: string) => done.filter((p) => rowDim.of(p) === r && colDim.of(p) === c).length;
  return { rowKeys, colKeys, cell, total: done.length };
}

export type Funnel = { label: string; n: number }[];
/** How many people reached each stage: started, 1st clip rated, ... all clips, finished. */
export function funnel(rows: PRow[]): Funnel {
  const clips = Math.max(1, ...rows.map((p) => p.n_total));
  const steps: Funnel = [{ label: "Started the survey", n: rows.length }];
  for (let i = 1; i <= clips; i++) steps.push({ label: i === 1 ? "Answered the 1st clip" : `Answered ${i} clips`, n: rows.filter((p) => p.n_rated >= i).length });
  steps.push({ label: "Finished the survey", n: rows.filter((p) => p.completed_at).length });
  return steps;
}

export type Day = { date: string; started: number; completed: number };
/** Participants who started on each calendar day (server local time), oldest first. */
export function daily(rows: PRow[]): Day[] {
  const m = new Map<string, Day>();
  for (const p of rows) {
    const date = new Date(p.started_at).toLocaleDateString("en-CA");
    const d = m.get(date) ?? { date, started: 0, completed: 0 };
    d.started++; if (p.completed_at) d.completed++;
    m.set(date, d);
  }
  return [...m.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export type Timing = { n: number; median: number; mean: number; p10: number; p90: number; min: number; max: number; fast: number };
export const FAST_MINUTES = 3;
export function timing(rows: PRow[]): Timing {
  const t = rows.filter((p) => p.completed_at).map(minutes).filter(Number.isFinite);
  return { n: t.length, median: median(t), mean: mean(t), p10: quantile(t, 0.1), p90: quantile(t, 0.9), min: Math.min(...t), max: Math.max(...t), fast: t.filter((x) => x < FAST_MINUTES).length };
}

export type Quality = { ratings: number; meanPlayed: number; shortPlays: number; participantsSkipping: number; participants: number };
/** Listening quality: how much of each clip was actually played before answering. */
export function quality(ratings: RatingRow[]): Quality {
  const withPlay = ratings.filter((r) => r.played_pct != null);
  const short = withPlay.filter((r) => (r.played_pct ?? 0) < 80);
  const people = new Set(withPlay.map((r) => r.participant_id));
  return {
    ratings: withPlay.length, meanPlayed: mean(withPlay.map((r) => r.played_pct as number)),
    shortPlays: short.length, participantsSkipping: new Set(short.map((r) => r.participant_id)).size, participants: people.size,
  };
}

export type QuestionStat = {
  q: Question; n: number; mean: number; sd: number; hist: number[]; maleMean: number; femaleMean: number; nMale: number; nFemale: number;
};
/** Score distribution for each per-clip scale question (completed participants only). */
export function questionStats(ratings: RatingRow[], questions: Question[]): QuestionStat[] {
  return questions.filter((q) => q.kind === "scale" && q.scope === "clip").map((q) => {
    const vals = ratings.map((r) => ({ v: r.scores[q.id], g: r.listener_gender })).filter((x): x is { v: number; g: string } => typeof x.v === "number");
    const hist = Array.from({ length: q.scale_max - q.scale_min + 1 }, (_, i) => vals.filter((x) => x.v === q.scale_min + i).length);
    const of = (g: string) => vals.filter((x) => x.g === g).map((x) => x.v);
    return { q, n: vals.length, mean: mean(vals.map((x) => x.v)), sd: sd(vals.map((x) => x.v)), hist, maleMean: mean(of("male")), femaleMean: mean(of("female")), nMale: of("male").length, nFemale: of("female").length };
  });
}

export type ChoiceClipStat = { q: Question; options: string[]; rows: { label: string; counts: number[]; n: number }[] };
/** For each per-clip multiple-choice question (e.g. perceived age): how often each option was chosen for each recording. */
export function choiceClipStats(ratings: RatingRow[], questions: Question[]): ChoiceClipStat[] {
  return questions.filter((q) => q.kind === "choice" && q.scope === "clip").map((q) => {
    const options = q.options ?? [];
    const labels = [...new Set(ratings.map((r) => r.clip_label))].sort();
    const rows = labels.map((label) => {
      const vals = ratings.filter((r) => r.clip_label === label).map((r) => r.texts[q.id]).filter(Boolean);
      return { label, counts: options.map((o) => vals.filter((v) => v === o).length), n: vals.length };
    });
    return { q, options, rows };
  });
}

export type FinalStat =
  | { kind: "scale"; q: Question; n: number; mean: number; sd: number; hist: number[]; maleMean: number; femaleMean: number; nMale: number; nFemale: number }
  | { kind: "choice"; q: Question; n: number; options: { label: string; count: number }[] };
/** Answers to the end-of-survey scale and choice questions (completed participants only). */
export function finalStats(rows: PRow[], finals: Map<string, Map<number, string | number>>, questions: Question[]): FinalStat[] {
  const done = rows.filter((p) => p.completed_at);
  const out: FinalStat[] = [];
  for (const q of questions.filter((x) => x.scope === "final" && x.kind !== "text")) {
    const vals = done.map((p) => ({ v: finals.get(p.id)?.get(q.id), g: p.listener_gender })).filter((x) => x.v !== undefined && x.v !== "");
    if (q.kind === "scale") {
      const nums = vals.map((x) => ({ v: Number(x.v), g: x.g })).filter((x) => Number.isFinite(x.v));
      const hist = Array.from({ length: q.scale_max - q.scale_min + 1 }, (_, i) => nums.filter((x) => x.v === q.scale_min + i).length);
      const of = (g: string) => nums.filter((x) => x.g === g).map((x) => x.v);
      out.push({ kind: "scale", q, n: nums.length, mean: mean(nums.map((x) => x.v)), sd: sd(nums.map((x) => x.v)), hist, maleMean: mean(of("male")), femaleMean: mean(of("female")), nMale: of("male").length, nFemale: of("female").length });
    } else {
      out.push({ kind: "choice", q, n: vals.length, options: (q.options ?? []).map((label) => ({ label, count: vals.filter((x) => x.v === label).length })) });
    }
  }
  return out;
}
