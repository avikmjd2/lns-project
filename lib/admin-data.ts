import { sql, type Question } from "./db";

export type RatingRow = {
  participant_id: string; study_slug: string; listener_gender: string; age: number | null; first_language: string | null; repeat_device: boolean; form: string;
  clip_id: number; clip_label: string; speaker_id: string; speaker_gender: "male" | "female"; guise: "mixed" | "pure";
  played_pct: number | null; rated_at: string;
  /** Numeric answers to per-clip scale questions, keyed by question id. */
  scores: Record<number, number>;
  /** Text answers to per-clip questions, keyed by question id. */
  texts: Record<number, string>;
  /** Mean of the per-clip scale answers, each rescaled to 1-5 so different ranges are comparable. */
  composite: number;
};

type Base = Omit<RatingRow, "scores" | "texts" | "composite">;
type AnswerRow = { participant_id: string; clip_id: number | null; question_id: number; num_value: number | null; text_value: string | null };

/** One row per (completed participant, clip), with that clip's answers attached. */
export async function getRatings(studyId: number | undefined, questions: Question[]): Promise<RatingRow[]> {
  const db = sql();
  const where = studyId ? "AND p.study_id = $1" : "";
  const args = studyId ? [studyId] : [];
  const base = (await db.query(`
    SELECT r.participant_id, s.slug AS study_slug, p.listener_gender, p.age, p.first_language, p.repeat_device, p.form,
           c.id AS clip_id, c.label AS clip_label, c.speaker_id, c.speaker_gender, c.guise, r.played_pct, r.rated_at
    FROM ratings r
    JOIN participants p ON p.id = r.participant_id
    JOIN clips c ON c.id = r.clip_id
    JOIN studies s ON s.id = p.study_id
    WHERE p.completed_at IS NOT NULL ${where}
    ORDER BY r.rated_at`, args)) as Base[];
  const ans = (await db.query(`
    SELECT a.participant_id, a.clip_id, a.question_id, a.num_value, a.text_value
    FROM answers a JOIN participants p ON p.id = a.participant_id
    WHERE p.completed_at IS NOT NULL AND a.clip_id IS NOT NULL ${where}`, args)) as AnswerRow[];

  const byKey = new Map<string, AnswerRow[]>();
  for (const a of ans) {
    const k = `${a.participant_id}:${a.clip_id}`;
    (byKey.get(k) ?? byKey.set(k, []).get(k)!).push(a);
  }
  const qById = new Map(questions.map((q) => [q.id, q]));
  return base.map((r) => {
    const scores: Record<number, number> = {}, texts: Record<number, string> = {};
    const rescaled: number[] = [];
    for (const a of byKey.get(`${r.participant_id}:${r.clip_id}`) ?? []) {
      if (a.num_value !== null) {
        scores[a.question_id] = a.num_value;
        const q = qById.get(a.question_id);
        if (q && q.scale_max > q.scale_min) rescaled.push(1 + (4 * (a.num_value - q.scale_min)) / (q.scale_max - q.scale_min));
      }
      if (a.text_value !== null) texts[a.question_id] = a.text_value;
    }
    const composite = rescaled.length ? Math.round((rescaled.reduce((x, y) => x + y, 0) / rescaled.length) * 100) / 100 : NaN;
    return { ...r, scores, texts, composite };
  });
}

/** End-of-survey answers, keyed by participant id then question id. */
export async function getFinalAnswers(studyId: number | undefined) {
  const where = studyId ? "AND p.study_id = $1" : "";
  const rows = (await sql().query(`
    SELECT a.participant_id, a.question_id, a.num_value, a.text_value
    FROM answers a JOIN participants p ON p.id = a.participant_id
    WHERE p.completed_at IS NOT NULL AND a.clip_id IS NULL ${where}`, studyId ? [studyId] : [])) as AnswerRow[];
  const out = new Map<string, Map<number, string | number>>();
  for (const r of rows) {
    const m = out.get(r.participant_id) ?? new Map<number, string | number>();
    m.set(r.question_id, r.num_value ?? r.text_value ?? "");
    out.set(r.participant_id, m);
  }
  return out;
}

const esc = (v: unknown) => {
  const s = v == null ? "" : v instanceof Date ? v.toISOString() : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * Long format CSV: one row per participant x clip. Columns for every question in the study(ies);
 * end-of-survey answers are repeated on each of that participant's rows.
 */
export function toCsv(rows: RatingRow[], questions: Question[], finals: Map<string, Map<number, string | number>>) {
  const qcols = questions.map((q) => ({ q, name: `q${q.id}_${q.scope}_${q.prompt.replace(/[^A-Za-z0-9]+/g, "_").slice(0, 30)}` }));
  const head = ["participant_id", "study_slug", "listener_gender", "age", "first_language", "repeat_device", "form", "clip_label", "speaker_id",
    "speaker_gender", "guise", ...qcols.map((c) => c.name), "composite_1to5", "played_pct", "rated_at"];
  const lines = [head.join(",")];
  for (const r of rows) {
    const cells = qcols.map(({ q }) =>
      q.scope === "final" ? finals.get(r.participant_id)?.get(q.id) : q.kind === "scale" ? r.scores[q.id] : r.texts[q.id]);
    lines.push([r.participant_id, r.study_slug, r.listener_gender, r.age, r.first_language, r.repeat_device, r.form, r.clip_label, r.speaker_id,
      r.speaker_gender, r.guise, ...cells, Number.isFinite(r.composite) ? r.composite : "", r.played_pct, r.rated_at].map(esc).join(","));
  }
  return lines.join("\n");
}
