import { sql } from "./db";
import { SCHEMA, UPGRADES } from "./schema";
import { applyStudyQuestions, applyMissingQuestions, applyResearchQuestions, applyTrimmedQuestions, applyAgeRanges } from "./default-questions";

let ready: Promise<void> | null = null;

async function run() {
  const db = sql();
  const [s] = (await db`
    SELECT
      to_regclass('public.studies') IS NOT NULL AS studies,
      to_regclass('public.questions') IS NOT NULL AS questions,
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'questions' AND column_name = 'clip_ids') AS clip_ids,
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ratings' AND column_name = 'friendly') AS old_ratings,
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'participants' AND column_name = 'first_language') AS first_language,
      EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'participants_form_abcd') AS combos,
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'studies' AND column_name = 'defaults_applied') AS defaults_applied,
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'participants' AND column_name = 'repeat_device') AS repeat_device,
      EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'questions_kind_check_v2') AS choice_kind,
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'studies' AND column_name = 'research_questions_applied') AS research_flag,
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'studies' AND column_name = 'trimmed_questions_applied') AS trimmed_flag
  `) as { studies: boolean; questions: boolean; clip_ids: boolean; old_ratings: boolean; first_language: boolean; combos: boolean; defaults_applied: boolean; repeat_device: boolean; choice_kind: boolean; research_flag: boolean; trimmed_flag: boolean }[];
  // The statements are idempotent; only run them when something is missing or outdated so that
  // the default questions are seeded once and not re-created after an admin deletes them.
  if (!s.studies || !s.questions || !s.clip_ids || s.old_ratings || !s.first_language || !s.defaults_applied || !s.repeat_device || !s.choice_kind || !s.research_flag || !s.trimmed_flag) {
    for (const stmt of SCHEMA) await db.query(stmt);
  }
  // Allow clip combinations A-D on participants.form (the first schema only allowed A and B).
  if (!s.combos) {
    for (const stmt of UPGRADES) await db.query(stmt);
  }
  // Swap the untouched original default questions for the nine study questions (no-op otherwise).
  await applyStudyQuestions();
  // Add any newer questions (leadership, feedback) that may be
  // missing from studies that were migrated before these were added.
  await applyMissingQuestions();
  // Add the similarity, naturalness, perceived-age, attitude and schooling questions (once per study).
  await applyResearchQuestions();
  // Remove the entertainingness and ambition questions (once per study).
  await applyTrimmedQuestions();
  // Finer perceived-age ranges (updates the question only while it still has the original coarse ones).
  await applyAgeRanges();
}

/** Creates or upgrades the database tables on first use (once per server instance). */
export function ensureSchema(): Promise<void> {
  ready ??= run().catch((e) => { ready = null; throw e; });
  return ready;
}
