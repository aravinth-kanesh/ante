# Ante

**Ante** is the AI-powered interview training application for students described
in the KURF report. A React frontend calls a FastAPI backend, which grounds a
large language model in the candidate's CV, the job description and research on
the company, runs an adaptive spoken mock interview, and measures how the
candidate delivers their answers.

The name is Latin for "before": the stake you put down before the hand is played,
and the antechamber you wait in before the room that matters. It is the
preparation you do before the interview.

## Language model endpoint

The backend talks to an **OpenAI-compatible** chat API. By default it targets
King's College London's institutional endpoint (`arc:lite`), which is the
production target named in the report and does not consume paid credit. Because
the client is OpenAI-compatible, switching to OpenAI or another compatible
endpoint is a change to `backend/.env` only, with no code change.

## Layout

```
backend/   FastAPI service (Python)
frontend/  React + Vite + TypeScript single-page app
```

## Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env        # then put your real key in .env
python scripts/fetch_tts_model.py   # one-off: the interviewer's voice model
uvicorn app.main:app --reload --port 8000
```

`fetch_tts_model.py` downloads the Kokoro voice model (about 340 MB, gitignored)
used to speak the interviewer's questions. It runs locally on CPU, so there is no
API key or cost and the question text never leaves the machine. Skip it if you
like: the app falls back to the browser's own voices, which sound noticeably more
robotic.

The database schema is managed with Alembic. The app runs `alembic upgrade head`
automatically at startup, so a fresh database is created and an existing one is
migrated. You can also run it by hand for a deploy: `alembic upgrade head`.

Check it (health is public; chat requires a logged-in user):

```bash
curl localhost:8000/api/health
# {"status":"ok","model":"arc:lite"}

# sign up. The access and refresh tokens are set as httpOnly cookies in the jar;
# a readable csrf cookie must be echoed back in a header on state-changing requests.
# The password must not appear in a known breach.
curl -s -c jar.txt -X POST localhost:8000/api/auth/signup \
  -H 'content-type: application/json' \
  -d '{"email":"you@example.com","password":"a-strong-unique-password"}'

CSRF=$(awk '/csrf_token/{print $7}' jar.txt)
curl -s -b jar.txt -X POST localhost:8000/api/chat \
  -H "x-csrf-token: $CSRF" -H 'content-type: application/json' \
  -d '{"messages":[{"role":"user","content":"Say hello in five words"}]}'
# {"reply":"..."}
```

Interactive API docs are served at `http://localhost:8000/docs`.

### Accounts, auth and security

Accounts are stored in the database (SQLite in development, PostgreSQL in
production), with passwords hashed using bcrypt (per-password salt). Data access is
ownership-checked, so a user can only read their own CVs and interviews, and all
queries go through the SQLAlchemy ORM (no string-built SQL).

Sessions use httpOnly cookies rather than a token in the browser, so the token is
not exposed to JavaScript (XSS). A short-lived access token is paired with a
longer-lived, server-side **refresh session** that rotates on use and can be
revoked; reusing a rotated token revokes the whole family. State-changing requests
carry a **double-submit CSRF token** (a readable cookie echoed in the
`X-CSRF-Token` header). Passwords are checked against the Have I Been Pwned range
API (k-anonymous, fail-open), repeated failed logins lock the account for a while,
and email verification and password reset are supported.

Other hardening: a Content-Security-Policy (report-only until enabled with
`CSP_REPORT_ONLY=false`) plus `Permissions-Policy`, `X-Frame-Options`,
nosniff and, in production, HSTS; per-IP rate limits on the expensive model and
media endpoints; a request body-size limit; and structured, PII-redacting logging
with a per-request id (`LOG_FORMAT=json` for structured output).

For a real deployment:

- Set `ENVIRONMENT=production` and a strong `JWT_SECRET`
  (`python -c "import secrets;print(secrets.token_urlsafe(48))"`). In production the
  app refuses to start on the default secret, marks cookies `Secure`, and sends an
  HSTS header. Rotate any secrets that were used in development before going live.
- Terminate TLS in front of the app (reverse proxy or platform) so cookies and
  passwords are never sent in the clear.
- Point `DATABASE_URL` at PostgreSQL, e.g.
  `postgresql://user:password@host:5432/ante` (the `psycopg2-binary` driver is in
  `requirements.txt`), and run `alembic upgrade head`.
- Configure SMTP (`SMTP_HOST` and friends) and `APP_BASE_URL` so verification and
  reset emails are sent; with no SMTP set, the link is written to the log instead.
- Set `REQUIRE_EMAIL_VERIFICATION` (on by default in production) and, for a
  multi-worker deployment, point `RATE_LIMIT_STORAGE_URI` at Redis so limits are
  shared across processes.
- Browser-test the CSP, then set `CSP_REPORT_ONLY=false` to enforce it.

Endpoints:

- `POST /api/auth/signup` and `POST /api/auth/login` set the session cookies.
  `POST /api/auth/refresh` rotates them, `POST /api/auth/logout` revokes the
  session, and `GET /api/auth/config` reports whether verification is required.
- `POST /api/auth/verify`, `POST /api/auth/resend-verification`,
  `POST /api/auth/forgot-password`, `POST /api/auth/reset-password` and
  `POST /api/auth/change-password` cover the account lifecycle.
- `GET /api/auth/export` downloads all of the account's data as JSON (portability),
  and `DELETE /api/auth/me` permanently erases the account and its data.
- `GET /api/auth/me` returns the current user.
- `GET`/`PUT /api/profile` store the user's job description text (and mirror the
  active CV's text used by the interview).
- `GET`/`POST /api/cv`, `POST /api/cv/upload`, `GET`/`PATCH`/`DELETE /api/cv/{id}`
  and `POST /api/cv/{id}/select` manage a per-account CV library: keep several
  labelled CVs (e.g. "Finance CV", "Tech CV"), uploaded (PDF/Word/text, 2 MB limit)
  or pasted, and choose the active one used for interviews and question generation.
- `POST /api/profile/research` reads the saved job description to identify the
  company and role and writes a short briefing on how they interview.
- `POST /api/chat` requires a logged-in session (cookie).
- `POST /api/prepare/questions` generates likely interview questions grounded in
  the CV, the job description, and the company research.
- `POST /api/prepare/plan` produces a competency gap analysis (each competency rated
  strong, partial or gap against the role, citing the CV) and a prioritised
  preparation plan. `GET` on both `/questions` and `/plan` returns the last saved
  result so it survives navigation.
- `POST /api/interview/start` runs a mock interview (requires a saved CV):
  `/start` returns the first question, `/{id}/answer` takes an answer and returns
  the next question (or `done`), `/{id}/finish` returns feedback, `GET /{id}`
  returns the transcript (with each answer's stored delivery and nonverbal
  metrics), and `GET /api/interview` lists the user's past sessions. Questions are
  grounded in the CV, job description and company research and go through the
  moderation layer.
- `POST /api/speech/transcribe` transcribes a spoken answer (multipart audio) with
  faster-whisper and returns the transcript plus delivery metrics (speaking pace,
  pauses, filler words).
- `GET /api/speech/voices` lists the interviewer voices this server can synthesise,
  and `POST /api/speech/say` returns WAV audio for a line of text, spoken by a
  local Kokoro model (British and American voices, no API key, nothing sent
  externally). The frontend falls back to browser voices when the model is absent.
- `POST /api/vision/analyse` aggregates webcam samples (sent from the browser, no
  image data) into nonverbal metrics (eye contact, head steadiness, expression,
  posture). Delivery and nonverbal metrics are attached to the answer and inform
  the final feedback. Audio and video are processed in memory and never stored.

### Moderation

`POST /api/chat` does not call the model directly. A layer in `app/services/`
frames the model as an interview coach, then uses the model itself to judge the
user's message and the reply: off-topic, unsafe, or manipulative input is
declined politely, and a reply that drifts is regenerated once before a fallback.
The checks are model-based rather than keyword lists, and each is a separate
call, so a message can cost up to three model calls; toggle them in `.env`
(`MODERATE_INPUT_ENABLED`, etc.) if the provider rate-limits.

Sanity-check it against deliberate misuse:

```bash
cd backend && source .venv/bin/activate
python scripts/moderation_smoke.py
```

### Tests

```bash
cd backend
source .venv/bin/activate
pytest
```

## Frontend

```bash
cd frontend
npm install
npm run setup   # downloads the MediaPipe webcam models into public/ (one-off)
npm run dev
```

The frontend is a React + Vite + TypeScript app styled with Tailwind CSS. Open
`http://localhost:5173` and sign up. The dashboard is a home showing the active CV
and a job description form, with links to Prepare and to start a mock interview.
The **Prepare** page is the AI-assisted preparation tool: company research, a
competency gap analysis and preparation plan, and likely questions, all tailored to
the CV and role. The **CVs** page manages a library of labelled CVs (upload or
paste, rename, select, delete). **Settings** lets you choose the interviewer's voice
and delete your account. After an interview you land on a results page showing every question, your
answers with their delivery and nonverbal readouts, and the feedback; the history
page lists past sessions and reopens any of them. The dev server proxies `/api` to
the backend on port 8000, so run the backend first.

`npm run setup` vendors the MediaPipe models used by the interview's optional
camera feedback so they are served from the app's own origin (no CDN). It is only
needed for the camera; the rest of the app runs without it, and if the models are
missing the camera option degrades gracefully. Speaking your answers requires the
backend to have `faster-whisper` installed (in `requirements.txt`); the Whisper
model downloads on first use. Both features work best in Chrome or Edge and need
microphone/camera permission (served over `https` or `localhost`).

## Configuration

All configuration lives in `backend/.env` (gitignored); `backend/.env.example` is
the annotated, complete list of keys. The main groups are the language model
(`LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`), the environment and database
(`ENVIRONMENT`, `DATABASE_URL`, `BACKEND_CORS_ORIGINS`), auth and cookies
(`JWT_SECRET`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `REFRESH_TOKEN_EXPIRE_DAYS`,
`COOKIE_SAMESITE`, `CSRF_ENABLED`), account security
(`REQUIRE_EMAIL_VERIFICATION`, `MAX_FAILED_LOGINS`, `CHECK_BREACHED_PASSWORDS`),
email (`SMTP_*`, `APP_BASE_URL`), rate limiting (`*_RATE_LIMIT`,
`RATE_LIMIT_STORAGE_URI`), and hardening (`CSP_REPORT_ONLY`, `MAX_REQUEST_BYTES`,
`LOG_FORMAT`). Sensible defaults keep local development working with none of these
set beyond the model key.

## Docker (backend)

```bash
docker build -t ante-backend backend/
docker run --env-file backend/.env -p 8000:8000 ante-backend
```
