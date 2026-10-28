import { sql } from "./db";

/**
 * Replaces the untouched original default questions of the "hindi" study (Friendly, Likable, Someone like me,
 * Educated, Confident; all 1-5) with the five study questions (all 1-10, asked after every clip).
 * Safe: does nothing if the admin already changed the questions or if any answers exist
 * (clear test data first, then click Sync recordings). One statement, so it is atomic and idempotent.
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
