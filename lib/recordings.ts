import { sql } from "./db";

export type Rec = {
  label: string;
  speakerId: string;
  gender: "male" | "female";
  guise: "mixed" | "pure";
  file: string;
};

/** The 8 expected recordings in /Recording. H = Hindi only (pure), N = Hindi + English (mixed). */
export const RECORDINGS: Rec[] = (["F1", "F2", "M1", "M2"] as const).flatMap((sp) =>
  (["H", "N"] as const).map((g) => ({
    label: `${sp}_${g}`,
    speakerId: sp,
    gender: sp.startsWith("F") ? ("female" as const) : ("male" as const),
    guise: g === "N" ? ("mixed" as const) : ("pure" as const),
    file: `${sp}_${g}.mp4`,
  })),
);

/** Only these filenames are ever read from disk (blocks path traversal). */
export const FILE_RE = /^[FM][12]_[HN]\.mp4$/;

type ClipRow = { id: number; label: string; blob_url: string };

/**
 * Registers the 8 local recordings in the `clips` table for a study (idempotent).
 * Local clips store the bare filename in `blob_url`. Other clips are never touched or deleted.
 */
export async function syncClips(studyId: number): Promise<ClipRow[]> {
  const db = sql();
  const existing = (await db`SELECT id, label, blob_url FROM clips WHERE study_id = ${studyId}`) as ClipRow[];
  for (const r of RECORDINGS) {
    const found = existing.find((c) => c.label === r.label && FILE_RE.test(c.blob_url));
    if (found) {
      await db`UPDATE clips SET speaker_id = ${r.speakerId}, speaker_gender = ${r.gender}, guise = ${r.guise},
               blob_url = ${r.file}, form_a = false, form_b = false WHERE id = ${found.id}`;
    } else {
      await db`INSERT INTO clips (study_id, label, speaker_id, speaker_gender, guise, form_a, form_b, blob_url)
               VALUES (${studyId}, ${r.label}, ${r.speakerId}, ${r.gender}, ${r.guise}, false, false, ${r.file})`;
    }
  }
  return (await db`SELECT id, label, blob_url FROM clips WHERE study_id = ${studyId} ORDER BY label`) as ClipRow[];
}
