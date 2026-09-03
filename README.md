# Joi Backend

⛵ Backend API + Telegram bot for **Joi**, a gamified weekly church-attendance app.
Node.js + TypeScript, Express, PostgreSQL (raw parameterized SQL via `pg` — no ORM engine
binary to install), Clean Architecture. See `../docs/PLAN.md` for the full project plan.

## Project layout

```
src/
  domain/          entities + pure business rules (buildLeaderboard, currentMeetingDate, levelForPoints...)
  application/      use-cases (one class per action) + ports (interfaces)
  infrastructure/    concrete implementations: Postgres repos, bcrypt, JWT, QR, Telegram, Google Drive, PDF, cron
  interfaces/http/   Express routes/controllers/middleware/DTOs
  config/            env loading + the composition root (container.ts) that wires it all together
db/
  schema.sql         plain SQL schema (idempotent — safe to re-run)
  migrate.ts         applies schema.sql to DATABASE_URL
  seed.ts            creates the first moderator account
test/                jest unit tests for the use-case layer
```

Dependency rule: `domain` depends on nothing. `application` depends only on `domain` and its own
`ports/*` interfaces. `infrastructure` and `interfaces/http` implement/consume those ports but are
never imported *by* `application` or `domain`. `config/container.ts` is the only file that wires
concrete infrastructure classes into use-cases.

## Setup

1. **Postgres**: create a database and note its connection string.
2. `cp .env.example .env` and fill in `DATABASE_URL` at minimum. Everything else has a sane
   default or is optional (Telegram/Google are no-ops until configured — see below).
3. `npm install`
4. `npm run db:migrate` — applies `db/schema.sql`.
5. `npm run db:seed` — creates the first moderator account (`admin` / `ChangeMe123` by default;
   override with `SEED_MODERATOR_USERNAME` / `SEED_MODERATOR_PASSWORD` / `SEED_MODERATOR_NAME`
   env vars). They'll be forced to set their own password on first login.
6. `npm run dev` — starts the API on `http://localhost:3000` with auto-reload.

For production: `npm run build && npm start`.

## Running the tests

```
npm test
```

Unit tests cover the business-logic-bearing parts of the domain/application layers: leaderboard
ranking (including ties), level thresholds, the meeting-date rollback rule, weekly-report message
formatting, check-in (including the "can't double-award points by re-scanning" rule), manual point
adjustment validation, prize redemption (including insufficient-balance rejection), and event
payments (installments accumulating, corrections, setting a total outright, the upcoming-events
cutoff, and the rule that a member's own balance never leaks anyone else's).

## API summary

All endpoints except `/health` and `/auth/login` require `Authorization: Bearer <token>`.
Endpoints marked 🔒 require the `MODERATOR` role; everything else just requires being logged in.

| Method & path | Notes |
|---|---|
| `POST /auth/login` | `{ username, password }` → `{ token, mustChangePassword, user }` |
| `POST /auth/change-password` | `{ newPassword }` — use this right after first login |
| 🔒 `POST /users` | Register a new person: `{ fullName, username, temporaryPassword, role? }` |
| `GET /users` | List everyone (moderators see username/telegramChatId too) |
| `GET /users/me` | Your own profile |
| 🔒 `PATCH /users/:id` | Edit name/role/active/telegramChatId |
| `GET /users/:id/qr` | PNG QR code (self, or any if moderator) |
| `GET /users/:id/points/history` | Point transaction log (self, or any if moderator) |
| 🔒 `POST /attendance/check-in` | `{ qrToken, meetingDate? }` — records attendance + awards points |
| 🔒 `GET /attendance?meetingDate=` | Who attended a given meeting (defaults to this week) |
| 🔒 `GET /attendance/absentees?meetingDate=` | Who didn't, with each one's all-time attendance count |
| 🔒 `POST /attendance/raffle-number` | `{ userId }` — hands out a temporary draw number. Idempotent: returns the one they already hold |
| 🔒 `GET /attendance/raffle-numbers` | Every number in play, sorted, with no indication of who holds which → `{ numbers, count }` |
| 🔒 `POST /attendance/raffle-number/reset` | Clears everyone's draw number → `{ cleared }` |
| 🔒 `POST /points/adjust` | `{ userId, points, reason }` — points can be negative |
| `GET /leaderboard` | Ranked list with level badges |
| `GET /prizes` | List prizes |
| 🔒 `POST /prizes`, `PATCH /prizes/:id`, `DELETE /prizes/:id` | Manage the prize catalog |
| 🔒 `POST /prizes/:id/redeem` | `{ userId }` — spends their points |
| `GET /events` | Upcoming events, each with *your own* paid/remaining amounts. `?upcomingOnly=false` includes past ones; moderators may add `?activeOnly=false` |
| 🔒 `POST /events`, `PATCH /events/:id`, `DELETE /events/:id` | Manage events: `{ name, description?, location?, price, eventDate, eventTime?, imageUrl? }` |
| 🔒 `GET /events/:id/payments` | The payment sheet: every member with what they've paid, what's left, and each installment |
| `GET /events/:id/payments/me` | Your own installments and balance for one event |
| 🔒 `POST /events/:id/payments` | `{ userId, amount, note? }` — records one installment (negative = refund/correction) |
| 🔒 `PUT /events/:id/payments/member/:userId` | `{ total }` — sets a member's running total outright, as a balancing entry |
| 🔒 `PATCH /events/:id/payments/:paymentId`, `DELETE /events/:id/payments/:paymentId` | Correct or remove one installment |
| 🔒 `POST /uploads/image` | Multipart form, field `image` (JPEG/PNG/WEBP/GIF, ≤5MB) → `{ url }` — use that `url` as a prize's `imageUrl` |
| `GET /uploads/:filename` | Serves an uploaded image — public, no auth (so `<img>`/Coil requests work without a token) |
| 🔒 `POST /telegram/send-weekly-report` | Manually fires the same report the Friday cron sends |
| 🔒 `POST /export/qr-sheet` | Builds the printable QR PDF and uploads it as a Google Doc |

## Telegram bot setup

1. Message **@BotFather** on Telegram, `/newbot`, follow the prompts, copy the token it gives you
   into `TELEGRAM_BOT_TOKEN`.
2. Add the bot to your leaders' group (or just message it directly for a single moderator), then
   find the chat id — easiest way is to send a message and check
   `https://api.telegram.org/bot<token>/getUpdates`. Put the id(s) into
   `TELEGRAM_ADMIN_CHAT_IDS` (comma-separated for multiple chats).
3. Restart the server. Every Friday at 13:00 **Africa/Cairo** time (`WEEKLY_REPORT_CRON`,
   evaluated in that timezone regardless of the server's own timezone) it posts attendance stats
   automatically. Test it any time with `POST /telegram/send-weekly-report`.

Until `TELEGRAM_BOT_TOKEN` is set, sends are skipped with a console warning instead of failing —
the rest of the app works fully without it.

## Google Docs QR export setup

1. In Google Cloud Console, create a service account, enable the Drive API, and download its JSON key.
2. Create a Drive folder and share it with the service account's email (Editor access).
3. Set `GOOGLE_SERVICE_ACCOUNT_JSON` (either the raw JSON as a one-line string, or a path to the
   key file) and `GOOGLE_DRIVE_FOLDER_ID` (the folder's id, from its URL) in `.env`.
4. `POST /export/qr-sheet` builds a printable PDF grid of every active member's QR code + name and
   uploads it to that folder, requesting conversion to a native Google Doc — returns the doc's URL.

Until configured, that endpoint returns a clear `503 NOT_CONFIGURED` error instead of a crash.

## Gamification rules (tunable via `.env`)

- `ATTENDANCE_POINTS` (default 10) — awarded automatically on check-in.
- `MEETING_DAY_OF_WEEK` (default 5 = Friday) — which weekday "this week's meeting" resolves to.
- Levels are computed from total points, not stored: Bronze 0+, Silver 100+, Gold 300+, Diamond 600+
  (see `levelForPoints` in `src/domain/entities/User.ts` if you want to retune the thresholds).
- Every point change — attendance, a moderator's manual add/remove, a prize redemption — is logged
  as a `PointTransaction` with a reason, so `GET /users/:id/points/history` is always a full audit trail.

## Draw numbers

An optional extra at check-in: the moderator can hand the person a temporary number to use during
the meeting — a raffle, picking teams, whatever. It's per-person and per-tap, so a meeting with no
activity never hands out a single number.

- The number lives in one nullable `users.raffle_number` column — deliberately not history. A
  partial unique index guarantees no two people hold the same number at once.
- Assignment is **idempotent**: asking again for someone who already holds a number returns that
  same number (`alreadyHeld: true`). By the time a moderator taps twice the member has usually
  written theirs down, and silently redrawing would put two different numbers in the room.
- Members see their own number on `GET /users/me`. When the moderator resets, the field simply
  stops being sent — the number disappears from their profile with nothing on the client having to
  remember to clear it.
- `GET /attendance/raffle-numbers` returns the pool a moderator draws *from*: the numbers and
  nothing else, sorted. Check-in order would leak the very link this withholds (the moderator
  scanned people in that order), so the sort is deliberate, not cosmetic. Matching a drawn number
  back to a person is a separate step — searching it on the members list.
- The pool is 1–999 (`MAX_RAFFLE_NUMBER`). Draws are uniform over the *free* numbers rather than
  guess-and-retry, so handing out the last few numbers still terminates; once the pool is empty the
  moderator is told to reset rather than left waiting.

## Event payments

An event's price can be settled in one payment or across as many as a member needs. There's no
stored "amount paid" column: `event_payments` holds one row per installment, and what someone has
paid is always `SUM(amount)` over their rows, so the total and the history can never disagree.

A moderator changes what a member has paid in whichever way fits:

- **Add a payment** — one more installment on top of what's there (`POST /events/:id/payments`).
- **Edit or delete an installment** — fixes a figure typed wrong, leaving the rest of the ledger
  alone (`PATCH`/`DELETE /events/:id/payments/:paymentId`).
- **Set the total** — "just make it say 250", recorded as a single balancing entry rather than a
  rewrite, so what was actually collected and when survives
  (`PUT /events/:id/payments/member/:userId`).

Negative amounts are allowed on purpose: that's how a refund is recorded without deleting history.
Members only ever see their own money — `GET /events` and `/events/:id/payments/me` are scoped to
the caller, and the full sheet is moderator-only.

## What's next (see docs/PLAN.md for the full roadmap)

Phase 2 is the native Kotlin/Compose Android app (`../joi-android`), built against this API.
Phase 3 adds streak bonuses, badges, push notifications, and a member-facing Telegram bot.

## Deploying to a VPS (Docker)

The repo ships with a `Dockerfile`, `docker-compose.yml` (backend + Postgres), and a `deploy.sh`
one-shot script. Verified locally: `npm run build` produces `dist/src/main.js` (the real compiled
entrypoint — matches `package.json`'s `main`/`start`), `node dist/db/migrate.js` applies
`db/schema.sql`, and the compiled server boots and answers real requests (`/leaderboard`,
`/auth/login`) against a local Postgres. The `Dockerfile` couldn't be built inside the sandbox this
was written in (Docker Hub wasn't reachable from there), so treat the VPS's first `docker compose
up --build` as its first real build — the pattern is standard multi-stage Node, low risk.

On the VPS:

```bash
# 1. Get the code onto the server (either works)
git clone https://github.com/michaelsam94/joi-backend.git /opt/joi-backend
#   — or, from your own machine: scp -r ./joi-backend root@<vps-ip>:/opt/joi-backend

cd /opt/joi-backend

# 2. First run — this copies .env.production.example to .env and stops so you can edit it
./deploy.sh

# 3. Edit .env: set JWT_SECRET, POSTGRES_PASSWORD, TELEGRAM_BOT_TOKEN, SEED_MODERATOR_PASSWORD, etc.
nano .env

# 4. Run again — builds the image, starts Postgres + the backend, applies the schema, seeds the
#    first moderator account
./deploy.sh
```

The backend is then reachable at `http://<vps-ip>:4000` (mapped from the container's internal
port 3000 — see `ports:` in `docker-compose.yml` if you need to change it again). Point the
Android app's `BASE_URL` (`app/src/main/java/com/joi/app/AppConfig.kt`) and the Telegram bot's
webhook/polling at that same address. Adding a domain + HTTPS later is just an Nginx reverse
proxy + `certbot` in front of that port — not required to get moving.

Useful commands on the VPS afterward:
```bash
docker compose logs -f backend      # tail logs
docker compose restart backend      # restart after an .env change
docker compose exec backend node dist/db/seed.js   # re-run the seed (no-op if admin already exists)
git pull && docker compose up -d --build            # deploy an update
```
