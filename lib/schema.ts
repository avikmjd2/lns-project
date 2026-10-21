// One statement per entry (Neon's HTTP driver runs a single statement per call).
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
  `CREATE TABLE IF NOT EXISTS ratings (
    id SERIAL PRIMARY KEY,
    participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    clip_id INT NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
    friendly INT NOT NULL CHECK (friendly BETWEEN 1 AND 5),
    likable INT NOT NULL CHECK (likable BETWEEN 1 AND 5),
    like_me INT NOT NULL CHECK (like_me BETWEEN 1 AND 5),
    educated INT NOT NULL CHECK (educated BETWEEN 1 AND 5),
    confident INT NOT NULL CHECK (confident BETWEEN 1 AND 5),
    played_pct INT,
    rated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (participant_id, clip_id)
  )`,
  `INSERT INTO studies (slug, name, base_language, mix_language)
   VALUES ('hindi', 'Voices & Speaking Styles', 'Hindi', 'English')
   ON CONFLICT (slug) DO NOTHING`,
];
