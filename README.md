# Ante

Ante helps students prepare for job interviews. You give it your CV and a job
description, and it researches the company, shows you where you are strong and where
you have gaps, gives you a preparation plan and likely questions, then runs a
realistic spoken mock interview with feedback on both your answers and how you
deliver them.

The name means "before": the preparation you do before the interview.

## What you need

- Python 3.10 or newer, and Node.js 18 or newer.
- A key for an OpenAI-compatible chat model (for example OpenAI). You add this to a
  settings file during setup, below.

## Running it

The app has two parts that run at the same time: the backend (the server) and the
frontend (the website). Open two terminal windows and keep both running.

**1. Backend**

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env          # then open .env and add your API key
python scripts/fetch_tts_model.py   # optional: gives the interviewer a natural voice
uvicorn app.main:app --reload --port 8000
```

**2. Frontend** (in a second terminal)

```bash
cd frontend
npm install
npm run setup                 # optional: enables the camera feedback feature
npm run dev
```

Then open http://localhost:5173 and create an account.

The two steps marked optional make the interviewer speak out loud and let it read
your body language on camera. You can skip them and the app still works: it falls
back to your browser's built-in voice and hides the camera feature. The microphone
and camera work best in Chrome or Edge.

## What is inside

- **Prepare**: company research, an honest look at where your CV fits the role, a
  preparation plan, and likely questions.
- **Mock interview**: an adaptive spoken interview with feedback on your answers, your
  speaking (pace, pauses, filler words) and your presence on camera.
- **Progress**: how you are improving across interviews, with trends for answer
  quality, speaking and on-camera presence, and the recurring things to work on.
- **History**: every past interview and its feedback, saved to your account.
- **Accounts**: sign up, verify your email, reset or change your password, download
  your data, or delete your account.

Your privacy: your microphone audio is turned into text in memory and never saved,
and the camera analysis runs inside your browser, so no video or image ever leaves
your device.

## Settings

All configuration lives in a single file, `backend/.env` (copied from
`backend/.env.example`, which lists every option with a short explanation). At a
minimum you set your API key there; sensible defaults cover everything else for local
use.

## Security

The app is built for real deployment: passwords are hashed and checked against known
breaches, sign-in uses secure httpOnly cookies with CSRF protection, and it adds the
standard protective headers and rate limits. If you deploy it publicly, serve it over
HTTPS, set a strong `JWT_SECRET`, and see `backend/.env.example` for the production
options (database, email, and so on).

## For developers

- Interactive API documentation is served at `http://localhost:8000/docs`.
- Run the backend tests with `pytest` (from `backend/`, with the virtual environment
  active).
- The backend is FastAPI + SQLAlchemy (SQLite locally, PostgreSQL in production, with
  Alembic migrations applied automatically at startup). The frontend is React +
  Vite + TypeScript. The interviewer voice, speech-to-text and webcam analysis all run
  locally or in the browser, so that content is not sent to a third party.
