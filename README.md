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

Check it (health is public; chat requires a logged-in user):

```bash
curl localhost:8000/api/health
# {"status":"ok","model":"arc:lite"}

# create an account and capture the token
TOKEN=$(curl -s -X POST localhost:8000/api/auth/signup \
  -H 'content-type: application/json' \
  -d '{"email":"you@example.com","password":"password123"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')

curl -X POST localhost:8000/api/chat \
  -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"messages":[{"role":"user","content":"Say hello in five words"}]}'
# {"reply":"..."}
```

Interactive API docs are served at `http://localhost:8000/docs`.

### Accounts and auth

Accounts are stored in a local SQLite database (`backend/app.db`, gitignored),
with passwords hashed using bcrypt. Auth is via JWT bearer tokens. Set a strong
`JWT_SECRET` in `backend/.env` before deploying. Endpoints:

- `POST /api/auth/signup` and `POST /api/auth/login` return an access token.
- `GET /api/auth/me` returns the current user.
- `GET`/`PUT /api/profile` store the user's job description text (and mirror the
  active CV's text used by the interview).
- `GET`/`POST /api/cv`, `POST /api/cv/upload`, `GET`/`PATCH`/`DELETE /api/cv/{id}`
  and `POST /api/cv/{id}/select` manage a per-account CV library: keep several
  labelled CVs (e.g. "Finance CV", "Tech CV"), uploaded (PDF/Word/text, 2 MB limit)
  or pasted, and choose the active one used for interviews and question generation.
- `POST /api/profile/research` reads the saved job description to identify the
  company and role and writes a short briefing on how they interview.
- `POST /api/chat` now requires a bearer token.
- `POST /api/prepare/questions` generates likely interview questions grounded in
  the CV, the job description, and the company research.
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
`http://localhost:5173` and sign up. The dashboard shows the active CV, a job
description form, company research and likely questions, and a link to start a
mock interview. The **CVs** page manages a library of labelled CVs (upload or
paste, rename, select, delete). **Settings** lets you choose the interviewer's
voice. After an interview you land on a results page showing every question, your
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

All configuration lives in `backend/.env` (gitignored). See
`backend/.env.example` for the keys: `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`,
`BACKEND_CORS_ORIGINS`, `DATABASE_URL`, `JWT_SECRET`, `JWT_ALGORITHM`, and
`ACCESS_TOKEN_EXPIRE_MINUTES`.

## Docker (backend)

```bash
docker build -t kurf-backend backend/
docker run --env-file backend/.env -p 8000:8000 kurf-backend
```
