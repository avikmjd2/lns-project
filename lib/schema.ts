// One statement per entry (Neon's HTTP driver runs a single statement per call).
// Idempotent: safe to run repeatedly, and upgrades the first (fixed 5-trait) version of the schema.
export const SCHEMA: string[] = [
  `CREATE TABLE IF NOT EXISTS studies (
    id SERIAL PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    base_language TEXT NOT NULL DEFAULT 'Hindi',
    mix_language TEXT NOT NULL DEFAULT 'English',
    locale TEXT NOT NULL DEFAULT 'en',
    status TEXT NOT NULL DEFAULT 'open',
    intro TEXT,
    debrief TEXT,
    traits JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS clips (
    id SERIAL PRIMARY KEY,
    study_id INT NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    speaker_id TEXT NOT NULL,
    speaker_gender TEXT NOT NULL CHECK (speaker_gender IN ('male','female')),
    guise TEXT NOT NULL CHECK (guise IN ('mixed','pure')),
    form_a BOOLEAN NOT NULL DEFAULT false,
    form_b BOOLEAN NOT NULL DEFAULT false,
    blob_url TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    study_id INT NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
    listener_gender TEXT NOT NULL,
    age INT,
    form TEXT NOT NULL CHECK (form IN ('A','B')),
    clip_order JSONB NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
  )`,
  // One row per (participant, clip) once the clip's questions are answered.
  `CREATE TABLE IF NOT EXISTS ratings (
    id SERIAL PRIMARY KEY,
    participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    clip_id INT NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
    played_pct INT,
    rated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (participant_id, clip_id)
  )`,
  // Upgrade from the first schema (fixed trait columns); those columns are no longer used.
  `ALTER TABLE ratings DROP COLUMN IF EXISTS friendly`,
  `ALTER TABLE ratings DROP COLUMN IF EXISTS likable`,
  `ALTER TABLE ratings DROP COLUMN IF EXISTS like_me`,
  `ALTER TABLE ratings DROP COLUMN IF EXISTS educated`,
  `ALTER TABLE ratings DROP COLUMN IF EXISTS confident`,
  `CREATE TABLE IF NOT EXISTS questions (
    id SERIAL PRIMARY KEY,
    study_id INT NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
    position INT NOT NULL DEFAULT 0,
    kind TEXT NOT NULL CHECK (kind IN ('scale','text')),
    scope TEXT NOT NULL DEFAULT 'clip' CHECK (scope IN ('clip','final')),
    prompt TEXT NOT NULL,
    scale_min INT NOT NULL DEFAULT 1,
    scale_max INT NOT NULL DEFAULT 5,
    low_label TEXT,
    high_label TEXT,
    required BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  // clip_id is NULL for end-of-survey (scope 'final') questions.
  `CREATE TABLE IF NOT EXISTS answers (
    id SERIAL PRIMARY KEY,
    participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    clip_id INT REFERENCES clips(id) ON DELETE CASCADE,
    question_id INT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    num_value INT,
    text_value TEXT,
    answered_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  // NULL = the question is asked for every clip; otherwise only for the listed clip ids.
  `ALTER TABLE questions ADD COLUMN IF NOT EXISTS clip_ids INT[]`,
  // Set once a study's question list has been brought up to date; after that it is never touched again.
  `ALTER TABLE studies ADD COLUMN IF NOT EXISTS defaults_applied BOOLEAN NOT NULL DEFAULT false`,
  // True when the person said they are a different person using a device that already completed the survey.
  `ALTER TABLE participants ADD COLUMN IF NOT EXISTS repeat_device BOOLEAN NOT NULL DEFAULT false`,
  // Multiple-choice questions: the allowed answers live in questions.options; the chosen text is stored in answers.text_value.
  `ALTER TABLE questions ADD COLUMN IF NOT EXISTS options TEXT[]`,
  `ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_kind_check`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'questions_kind_check_v2') THEN
       ALTER TABLE questions ADD CONSTRAINT questions_kind_check_v2 CHECK (kind IN ('scale','text','choice'));
     END IF;
   END $$`,
  // Set once the similarity / naturalness / perceived-age / attitude / schooling questions have been added to a study.
  `ALTER TABLE studies ADD COLUMN IF NOT EXISTS research_questions_applied BOOLEAN NOT NULL DEFAULT false`,
  // Add first_language to participants (upgrade).
  `ALTER TABLE participants ADD COLUMN IF NOT EXISTS first_language TEXT`,
  `CREATE INDEX IF NOT EXISTS answers_participant_idx ON answers (participant_id)`,
  `INSERT INTO studies (slug, name, base_language, mix_language)
   VALUES ('hindi', 'Voices & Speaking Styles', 'Hindi', 'English')
   ON CONFLICT (slug) DO NOTHING`,
  // Seed the five default 1-5 clip questions for any study that has no questions yet.
  `INSERT INTO questions (study_id, position, kind, scope, prompt, scale_min, scale_max, low_label, high_label)
   SELECT s.id, v.pos, 'scale', 'clip', v.prompt, 1, 5, 'Not at all', 'Very'
   FROM studies s
   CROSS JOIN (VALUES (1,'Friendly'),(2,'Likable'),(3,'Someone like me'),(4,'Educated'),(5,'Confident')) AS v(pos, prompt)
   WHERE NOT EXISTS (SELECT 1 FROM questions q WHERE q.study_id = s.id) AND s.slug = 'hindi'`,
];

// Runs after SCHEMA whenever the 4-combination constraint is missing.
// The first schema only allowed form A or B; clip combinations are now A, B, C or D.
export const UPGRADES: string[] = [
  `ALTER TABLE participants DROP CONSTRAINT IF EXISTS participants_form_check`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'participants_form_abcd') THEN
       ALTER TABLE participants ADD CONSTRAINT participants_form_abcd CHECK (form IN ('A','B','C','D'));
     END IF;
   END $$`,
];
