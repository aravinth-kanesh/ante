# KURF Interview AI — Application

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

Check it:

```bash
curl localhost:8000/api/health
# {"status":"ok","model":"arc:lite"}

curl -X POST localhost:8000/api/chat \
  -H 'content-type: application/json' \
  -d '{"messages":[{"role":"user","content":"Say hello in five words"}]}'
# {"reply":"..."}
```

Interactive API docs are served at `http://localhost:8000/docs`.

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The page shows the backend health status and a box
to send a prompt to the model. The dev server proxies `/api` to the backend on
port 8000, so run the backend first.

## Configuration

All configuration lives in `backend/.env` (gitignored). See
`backend/.env.example` for the keys: `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`,
and `BACKEND_CORS_ORIGINS`.

## Docker (backend)

```bash
docker build -t kurf-backend backend/
docker run --env-file backend/.env -p 8000:8000 kurf-backend
```
