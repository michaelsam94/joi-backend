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
  date_of_birth         DATE,
  phone_number          TEXT,
  address               TEXT,
  class_name            TEXT,
  note                  TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_total_points ON users(total_points);

-- Idempotent — lets `db:migrate` add these columns to a users table that already existed
-- before this profile-fields change, same as a fresh CREATE TABLE would.
ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS class_name TEXT;
-- A free-text note a moderator can keep on a member (birthdays, pastoral notes, whatever) — never
-- shown to the member themselves, only to moderators (see toDetailedUser/toPublicUser).
ALTER TABLE users ADD COLUMN IF NOT EXISTS note TEXT;

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
  -- NULL = unlimited stock (the original behavior). A non-null value is remaining stock,
  -- decremented atomically on each redemption — see PgPrizeRepository.tryReserveOne.
  quantity     INTEGER,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE prizes ADD COLUMN IF NOT EXISTS quantity INTEGER;

CREATE TABLE IF NOT EXISTS prize_redemptions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prize_id       UUID NOT NULL REFERENCES prizes(id),
  user_id        UUID NOT NULL REFERENCES users(id),
  points_spent   INTEGER NOT NULL,
  redeemed_by_id UUID NOT NULL REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Events a moderator organizes (a trip, a conference, a party). Every signed-in person can see the
-- upcoming ones; only a moderator can create/edit/remove them or touch anyone's payments.
CREATE TABLE IF NOT EXISTS events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  description  TEXT,
  location     TEXT,
  -- Price per person. 0 = free. NUMERIC rather than a float so summing installments stays exact.
  price        NUMERIC(12, 2) NOT NULL DEFAULT 0,
  event_date   DATE NOT NULL,
  -- Optional HH:MM start time — the date alone is enough for "upcoming", this is just for display.
  event_time   TEXT,
  image_url    TEXT,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_events_event_date ON events(event_date);

-- One row per *installment*, not one per member: a member may settle the price in a single payment
-- or across many, and the amount they've paid is always SUM(amount) over their rows. A moderator
-- correcting a mistake edits a row, deletes one, or records a negative amount (a refund).
CREATE TABLE IF NOT EXISTS event_payments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount         NUMERIC(12, 2) NOT NULL,
  note           TEXT,
  recorded_by_id UUID NOT NULL REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_payments_event ON event_payments(event_id);
CREATE INDEX IF NOT EXISTS idx_event_payments_event_user ON event_payments(event_id, user_id);
