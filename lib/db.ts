import { neon } from "@neondatabase/serverless";
import { ensureSchema } from "./migrate";

export function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

export type Study = {
  id: number;
  slug: string;
  name: string;
  base_language: string;
  mix_language: string;
  locale: string;
  status: string;
  intro: string | null;
  debrief: string | null;
};

export type Question = {
  id: number;
  study_id: number;
  position: number;
  kind: "scale" | "text";
  scope: "clip" | "final";
  prompt: string;
  scale_min: number;
  scale_max: number;
  low_label: string | null;
  high_label: string | null;
  required: boolean;
  /** null = asked for every clip; otherwise only for these clip ids (per-clip questions only). */
  clip_ids: number[] | null;
};

/** Does this per-clip question apply to the given clip? */
export function appliesToClip(q: { scope: string; clip_ids: number[] | null }, clipId: number) {
  return q.scope === "clip" && (!q.clip_ids || q.clip_ids.includes(clipId));
}

export async function getStudy(slug: string): Promise<Study | null> {
  await ensureSchema();
  const rows = (await sql()`SELECT * FROM studies WHERE slug = ${slug}`) as Study[];
  return rows[0] ?? null;
}

export async function getQuestions(studyId: number): Promise<Question[]> {
  return (await sql()`SELECT * FROM questions WHERE study_id = ${studyId} ORDER BY position, id`) as Question[];
}

/** Check one submitted answer against its question; returns the value to store, or why it was rejected. */
export function validateAnswer(q: Question, v: unknown): { num: number | null; text: string | null } | "missing" | "invalid" {
  const empty = v === undefined || v === null || (typeof v === "string" && v.trim() === "");
  if (empty) return q.required ? "missing" : { num: null, text: null };
  if (q.kind === "scale") {
    const n = Number(v);
    if (!Number.isInteger(n) || n < q.scale_min || n > q.scale_max) return "invalid";
    return { num: n, text: null };
  }
  const s = String(v).trim();
  if (s.length > 2000) return "invalid";
  return { num: null, text: s };
}
