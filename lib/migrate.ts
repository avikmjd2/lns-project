import { sql } from "./db";
import { SCHEMA } from "./schema";

let ready: Promise<void> | null = null;

async function run() {
  const db = sql();
  const [s] = (await db`
    SELECT
      to_regclass('public.studies') IS NOT NULL AS studies,
      to_regclass('public.questions') IS NOT NULL AS questions,
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'questions' AND column_name = 'clip_ids') AS clip_ids,
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ratings' AND column_name = 'friendly') AS old_ratings
  `) as { studies: boolean; questions: boolean; clip_ids: boolean; old_ratings: boolean }[];
  // The statements are idempotent; only run them when something is missing or outdated so that
  // the default questions are seeded once and not re-created after an admin deletes them.
  if (!s.studies || !s.questions || !s.clip_ids || s.old_ratings) {
    for (const stmt of SCHEMA) await db.query(stmt);
  }
}

/** Creates or upgrades the database tables on first use (once per server instance). */
export function ensureSchema(): Promise<void> {
  ready ??= run().catch((e) => { ready = null; throw e; });
  return ready;
}
