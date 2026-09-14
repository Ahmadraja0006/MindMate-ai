CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  email VARCHAR(180) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('elderly','caregiver','admin')),
  age INTEGER CHECK (age IS NULL OR age BETWEEN 1 AND 120),
  language VARCHAR(10) NOT NULL DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS caregiver_links (
  caregiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  elderly_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (caregiver_id, elderly_id)
);

CREATE TABLE IF NOT EXISTS game_sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_key VARCHAR(40) NOT NULL,
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  accuracy INTEGER NOT NULL CHECK (accuracy BETWEEN 0 AND 100),
  response_time NUMERIC(10,2) NOT NULL DEFAULT 0,
  difficulty_before INTEGER NOT NULL CHECK (difficulty_before BETWEEN 1 AND 4),
  difficulty_after INTEGER NOT NULL CHECK (difficulty_after BETWEEN 1 AND 4),
  total_questions INTEGER NOT NULL DEFAULT 1,
  correct_answers INTEGER NOT NULL DEFAULT 0,
  client_created_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(180) NOT NULL,
  reminder_time VARCHAR(50) NOT NULL,
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_game_sessions_user_date ON game_sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reminders_user ON reminders(user_id);
