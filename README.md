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

19 unit tests cover the business-logic-bearing parts of the domain/application layers: leaderboard
ranking (including ties), level thresholds, the meeting-date rollback rule, weekly-report message
formatting, check-in (including the "can't double-award points by re-scanning" rule), manual point
adjustment validation, and prize redemption (including insufficient-balance rejection).

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
| 🔒 `POST /points/adjust` | `{ userId, points, reason }` — points can be negative |
| `GET /leaderboard` | Ranked list with level badges |
| `GET /prizes` | List prizes |
| 🔒 `POST /prizes`, `PATCH /prizes/:id`, `DELETE /prizes/:id` | Manage the prize catalog |
| 🔒 `POST /prizes/:id/redeem` | `{ userId }` — spends their points |
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

## What's next (see docs/PLAN.md for the full roadmap)

Phase 2 is the native Kotlin/Compose Android app (`../joi-android`), built against this API.
Phase 3 adds streak bonuses, badges, push notifications, and a member-facing Telegram bot.
