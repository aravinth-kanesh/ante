# Ante

Ante helps students prepare for job interviews. Give it your CV and a job description
and it researches the company, shows where you are strong and where you have gaps,
builds a preparation plan with likely questions, then runs a spoken mock interview
with feedback on your answers and how you deliver them.

The name means "before": the preparation you do before the interview.

## Features

- **Prepare**: company research, an honest look at how your CV fits the role, a
  preparation plan and likely questions.
- **Mock interview**: an adaptive spoken interview of a length you choose, with
  feedback on your answers, your speaking (pace, pauses, filler words) and your
  presence on camera, plus a model answer where a response falls short. You can record
  a session and watch it back with pauses and filler words marked on a timeline.
- **Progress and history**: every past interview saved to your account, with trends
  across them and the recurring things to work on.
- **More practice**: single-question drills, a question bank, a STAR-story builder,
  saved model answers and a side-by-side comparison of two interviews.
- **Accounts**: email verification, password reset, data download and account deletion.

A one-click sample interview lets you try the whole loop with no setup.

## Quick start

You need Python 3.10+, Node.js 18+ and an API key for any OpenAI-compatible chat model.
The backend and frontend run side by side, so use two terminals.

**Backend**

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python scripts/fetch_tts_model.py   # optional: natural interviewer voice
uvicorn app.main:app --reload --port 8000
```

Before starting the server, open `backend/.env`, set `ENVIRONMENT=development` and fill
in the `LLM_*` values. To run with no key at all, set `LLM_FAKE=1`.

**Frontend**

```bash
cd frontend
npm install
npm run setup                       # optional: camera feedback
npm run dev
```

Open http://localhost:5173 and create an account.

Without the two optional steps the app still works: it uses your browser's built-in
voice and hides the camera feature. The microphone and camera work best in Chrome or
Edge.

## Privacy

- Microphone audio is transcribed in memory and never saved.
- Camera analysis runs in your browser, so no video or image leaves your device.
- Recordings are only kept if you opt in, only for that session, and are deleted when
  it ends.

## Security and accessibility

Passwords are hashed and checked against known breaches, sign-in uses httpOnly cookies
with CSRF protection, and the app sets the standard security headers and rate limits.

Ante aims to meet WCAG 2.1 AA: it is fully keyboard operable, announces question
changes and errors to screen readers, gives charts a text-table alternative and
respects a reduced-motion preference. The microphone and camera are optional, so a
complete interview works without them.

## Development

| | |
| --- | --- |
| Backend | FastAPI and SQLAlchemy, with SQLite locally and PostgreSQL in production. Alembic migrations apply at startup. |
| Frontend | React, Vite and TypeScript. |
| Speech and vision | Interviewer voice, speech-to-text and webcam analysis run locally or in the browser. |
| API docs | http://localhost:8000/docs |
| Backend tests | `pytest`, from `backend/` with the virtual environment active |
| Frontend tests | `npm test` (Vitest) and `npm run e2e` (Playwright, a full interview against the offline backend) |

All backend settings live in `backend/.env`. Each one is explained in
`backend/.env.example`, and the defaults cover local use.

## Deployment

### Docker

The included stack runs PostgreSQL, the backend, and a Caddy server that serves the
built frontend and provisions HTTPS.

```bash
cp .env.example .env
docker compose up -d --build
```

Before bringing it up, edit `.env`: set `JWT_SECRET`, the `LLM_*` values, and
`SITE_ADDRESS` and `SITE_ORIGIN` for your domain. The file explains each setting,
including how to run the stack locally over plain HTTP.

### By hand

1. **Backend.** In `backend/.env`, set `ENVIRONMENT=production`, a long random
   `JWT_SECRET`, `DATABASE_URL` for your PostgreSQL instance, `BACKEND_CORS_ORIGINS` to
   your site's origin, and the `LLM_*` values. Build `backend/Dockerfile` and run it
   behind a reverse proxy that terminates TLS.
2. **Frontend.** Run `npm --prefix frontend run build` and serve `frontend/dist/` from
   the same origin as the API, proxying `/api` to the backend so the auth cookies stay
   first-party.
3. **Optional.** Set `SMTP_*` and `APP_BASE_URL` to send verification and reset emails,
   `WEB_SEARCH_ENABLED=1` to ground company research in web results, and
   `RATE_LIMIT_STORAGE_URI` to a Redis instance if you run several workers.
