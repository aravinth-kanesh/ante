# AI-Powered Interview Training Application for Students

Foundation for the AI interview training application described in the KURF
report. It stands up an end-to-end slice: a React frontend calls a FastAPI
backend, which calls a large language model and returns the reply.

The structure is intentionally minimal but laid out to grow: retrieval over the
CV and job description, computer-vision analysis, and speech analysis are added
later as new services and routers.

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
uvicorn app.main:app --reload --port 8000
```

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
- `GET`/`PUT /api/profile` store the user's CV and job description text.
- `POST /api/chat` now requires a bearer token.

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
npm run dev
```

Open `http://localhost:5173`. You are taken to a login page; sign up for an
account, then the dashboard shows the backend health status, a form to save your
CV and job description, and a box to send a prompt to the model. The dev server
proxies `/api` to the backend on port 8000, so run the backend first.

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
