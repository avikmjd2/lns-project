import { sql, TRAITS } from "./db";

export type RatingRow = {
  participant_id: string; study_slug: string; listener_gender: string; age: number | null; form: string;
  clip_label: string; speaker_id: string; speaker_gender: "male" | "female"; guise: "mixed" | "pure";
  friendly: number; likable: number; like_me: number; educated: number; confident: number;
  composite: number; played_pct: number | null; rated_at: string;
};

/** One row per rating, joined with listener + clip attributes. Only completed participants. */
export async function getRatings(studyId?: number): Promise<RatingRow[]> {
  const db = sql();
  const q = `
    SELECT r.participant_id, s.slug AS study_slug, p.listener_gender, p.age, p.form,
           c.label AS clip_label, c.speaker_id, c.speaker_gender, c.guise,
           r.friendly, r.likable, r.like_me, r.educated, r.confident,
           ROUND((r.friendly + r.likable + r.like_me + r.educated + r.confident) / 5.0, 2)::float AS composite,
           r.played_pct, r.rated_at
    FROM ratings r
    JOIN participants p ON p.id = r.participant_id
    JOIN clips c ON c.id = r.clip_id
    JOIN studies s ON s.id = p.study_id
    WHERE p.completed_at IS NOT NULL ${studyId ? "AND p.study_id = $1" : ""}
    ORDER BY r.rated_at`;
  return (studyId ? await db.query(q, [studyId]) : await db.query(q)) as RatingRow[];
}

export const CSV_COLUMNS = [
  "participant_id", "study_slug", "listener_gender", "age", "form", "clip_label", "speaker_id",
  "speaker_gender", "guise", ...TRAITS, "composite", "played_pct", "rated_at",
] as const;

export function toCsv(rows: RatingRow[]) {
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [CSV_COLUMNS.join(",")];
  for (const r of rows) lines.push(CSV_COLUMNS.map((c) => esc((r as Record<string, unknown>)[c])).join(","));
  return lines.join("\n");
}
