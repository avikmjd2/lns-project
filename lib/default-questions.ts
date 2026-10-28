import { sql } from "./db";

/**
 * Replaces the untouched original default questions of the "hindi" study (Friendly, Likable, Someone like me,
 * Educated, Confident; all 1-5) with the nine study questions (all 1-10, asked after every clip).
 * Safe: does nothing if the admin already changed the questions or if any answers exist.
 */
export async function applyStudyQuestions(): Promise<void> {
  await sql()`
    WITH del AS (
      DELETE FROM questions q USING studies s
      WHERE q.study_id = s.id AND s.slug = 'hindi'
        AND (SELECT COUNT(*) FROM questions x WHERE x.study_id = s.id) = 5
        AND (SELECT COUNT(*) FROM questions x WHERE x.study_id = s.id AND x.scope = 'clip' AND x.scale_min = 1 AND x.scale_max = 5
             AND x.prompt IN ('Friendly', 'Likable', 'Someone like me', 'Educated', 'Confident')) = 5
        AND NOT EXISTS (SELECT 1 FROM answers a JOIN questions y ON y.id = a.question_id WHERE y.study_id = s.id)
      RETURNING q.study_id
    )
    INSERT INTO questions (study_id, position, kind, scope, prompt, scale_min, scale_max, low_label, high_label)
    SELECT d.study_id, v.pos, v.kind, 'clip', v.prompt, v.mn, v.mx, v.low, v.high
    FROM (SELECT DISTINCT study_id FROM del) d
    CROSS JOIN (VALUES
      (1, 'scale', 'Rate this person on intelligence', 1, 10, 'Not at all', 'Extremely'),
      (2, 'scale', 'Rate this person on friendliness', 1, 10, 'Not at all', 'Extremely'),
      (3, 'scale', 'Rate this person on sense of humor', 1, 10, 'Not at all', 'Extremely'),
      (4, 'scale', 'Rate this person on trustworthiness', 1, 10, 'Not at all', 'Extremely'),
      (5, 'scale', 'How likely would you be to talk to this person if he/she approached you?', 1, 10, 'Not at all likely', 'Very likely'),
      (6, 'scale', 'Rate this person on leadership', 1, 10, 'Not at all', 'Extremely'),
      (7, 'scale', 'Rate this person on entertainingness', 1, 10, 'Not at all', 'Extremely'),
      (8, 'scale', 'Rate this person on ambition', 1, 10, 'Not at all', 'Extremely'),
      (9, 'text',  'Any additional feedback about this speaker?', 1, 10, NULL, NULL)
    ) AS v(pos, kind, prompt, mn, mx, low, high)`;
}

/**
 * Additive migration: inserts questions that are missing from studies that were already upgraded
 * from the original 5 defaults but predate leadership / entertainingness / ambition / feedback.
 * Runs at most once per study (studies.defaults_applied), so questions the admin later deletes,
 * rewords or makes optional are never put back.
 */
export async function applyMissingQuestions(): Promise<void> {
  const db = sql();
  // Find all studies that already have the upgraded core questions (scale 1-10).
  const studies = (await db`
    SELECT s.id AS study_id
    FROM studies s
    WHERE NOT s.defaults_applied AND EXISTS (
      SELECT 1 FROM questions q
      WHERE q.study_id = s.id AND q.scope = 'clip' AND q.kind = 'scale'
        AND q.scale_min = 1 AND q.scale_max = 10
        AND q.prompt = 'Rate this person on intelligence'
    )
  `) as { study_id: number }[];

  for (const { study_id } of studies) {
    const toAdd = [
      { pos: 6, kind: "scale", prompt: "Rate this person on leadership",             mn: 1, mx: 10, low: "Not at all", high: "Extremely", required: true  },
      { pos: 7, kind: "scale", prompt: "Rate this person on entertainingness",        mn: 1, mx: 10, low: "Not at all", high: "Extremely", required: true  },
      { pos: 8, kind: "scale", prompt: "Rate this person on ambition",                mn: 1, mx: 10, low: "Not at all", high: "Extremely", required: true  },
      { pos: 9, kind: "text",  prompt: "Any additional feedback about this speaker?", mn: 1, mx: 10, low: null,         high: null,        required: false },
    ];
    for (const q of toAdd) {
      await db`
        INSERT INTO questions (study_id, position, kind, scope, prompt, scale_min, scale_max, low_label, high_label, required)
        SELECT ${study_id}, ${q.pos}, ${q.kind}, 'clip', ${q.prompt}, ${q.mn}, ${q.mx}, ${q.low}, ${q.high}, ${q.required}
        WHERE NOT EXISTS (
          SELECT 1 FROM questions x WHERE x.study_id = ${study_id} AND x.prompt = ${q.prompt}
        )`;
    }
    // Patch any previously-inserted rows that had required=false incorrectly set for scale questions.
    await db`
      UPDATE questions SET required = true
      WHERE study_id = ${study_id}
        AND kind = 'scale'
        AND prompt IN (
          'Rate this person on leadership',
          'Rate this person on entertainingness',
          'Rate this person on ambition'
        )
        AND required = false`;
  }
  // From now on this study's question list belongs to the admin: never touch it again.
  await db`UPDATE studies SET defaults_applied = true WHERE NOT defaults_applied`;
}
