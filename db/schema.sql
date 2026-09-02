-- Joi database schema — plain SQL, run once against a fresh Postgres database.
-- (No ORM engine binary needed to apply this — plain psql or the migrate script works.)

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- gen_random_uuid()

CREATE TABLE IF NOT EXISTS users (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name             TEXT NOT NULL,
  username              TEXT NOT NULL UNIQUE,
  password_hash         TEXT NOT NULL,
  role                  TEXT NOT NULL DEFAULT 'MEMBER' CHECK (role IN ('MODERATOR', 'MEMBER')),
  must_change_password  BOOLEAN NOT NULL DEFAULT TRUE,
  qr_token              UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  telegram_chat_id      TEXT,
  total_points          INTEGER NOT NULL DEFAULT 0,
  active                BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_total_points ON users(total_points);

CREATE TABLE IF NOT EXISTS attendance (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  meeting_date  DATE NOT NULL,
  checked_by_id UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, meeting_date)
);
CREATE INDEX IF NOT EXISTS idx_attendance_meeting_date ON attendance(meeting_date);

CREATE TABLE IF NOT EXISTS point_transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  points        INTEGER NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('ATTENDANCE', 'MANUAL_ADD', 'MANUAL_REMOVE', 'PRIZE_REDEEM')),
  reason        TEXT,
  created_by_id UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_point_tx_user ON point_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_point_tx_created_at ON point_transactions(created_at);

CREATE TABLE IF NOT EXISTS prizes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  description  TEXT,
  points_cost  INTEGER NOT NULL,
  image_url    TEXT,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS prize_redemptions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prize_id       UUID NOT NULL REFERENCES prizes(id),
  user_id        UUID NOT NULL REFERENCES users(id),
  points_spent   INTEGER NOT NULL,
  redeemed_by_id UUID NOT NULL REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
