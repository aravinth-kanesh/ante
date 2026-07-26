# Production hardening and security roadmap

This is the checklist for making Ante genuinely sturdy and secure for real,
public users. It records what is already done and what remains, in priority order,
so nothing is lost. It complements the "Accounts, auth and security" section of the
main `README.md`.

Status legend: **[done]** implemented and tested, **[todo]** not yet done.

## Already in place [done]

- **Password storage**: bcrypt with a per-password salt (`app/security.py`). Plain
  passwords are never stored.
- **No SQL injection**: all queries go through the SQLAlchemy ORM (parameterised).
  The only raw SQL is the internal migration in `app/db.py`, which uses fixed table
  and column names, never user input.
- **Access control**: every per-user endpoint requires a valid JWT, and data is
  ownership-checked (`_owned`, `_owned_cv`, and `user_id` filters), so a user can
  only read their own CVs and interviews. No IDOR.
- **JWT**: signed tokens with an expiry. A startup guard in `app/main.py` refuses to
  boot in production on the default secret and warns in development.
- **Right to erasure**: `DELETE /api/auth/me` deletes the account and all its data
  (profile, CVs, interview sessions and turns). Surfaced as a confirm-by-email
  danger zone in Settings.
- **Rate limiting**: login and signup are throttled per IP with slowapi
  (`AUTH_RATE_LIMIT`, default `10/minute`).
- **Security headers**: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: no-referrer`, and `Strict-Transport-Security` in production.
- **Input validation**: Pydantic schemas (email format, password length, typed
  bodies). Login does not reveal whether an email exists.
- **Secrets**: kept in `backend/.env` (gitignored). `.env.example` documents them.
- **No biometric storage**: audio and webcam frames are processed in memory only;
  only derived metrics are stored (matches the LSEPI no-storage policy).
- **PostgreSQL support**: set `DATABASE_URL=postgresql://...`; `psycopg2-binary` is
  in `requirements.txt`.

## Remaining, in priority order

### 1. Transport security [todo]
- **HTTPS/TLS** must terminate in front of the app (reverse proxy, or a platform
  like Render/Fly/Railway). Tokens and passwords must never travel over plain HTTP.
  The app already sends HSTS when `ENVIRONMENT=production`.

### 2. Content-Security-Policy [todo]
- Add a CSP response header to reduce XSS impact. Must be tested in the browser
  because the app uses inline `style` attributes, `blob:` audio URLs (TTS), webcam
  `srcObject`, and MediaPipe WASM (needs `'wasm-unsafe-eval'`). Start report-only,
  then enforce. Rough starting point:
  `default-src 'self'; img-src 'self' data:; media-src 'self' blob:; script-src
  'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self'`.

### 3. Token handling [todo]
- Move the JWT from `localStorage` to an **httpOnly, Secure, SameSite cookie** to
  remove XSS token theft. This requires **CSRF protection** (e.g. double-submit
  token) once auth is cookie-based.
- Add **token revocation / refresh tokens** so a compromised token can be
  invalidated before expiry (currently mitigated only by the short expiry).

### 4. Database for real scale [todo]
- Run on **PostgreSQL** (supported already) rather than SQLite for concurrency.
- Adopt **Alembic** migrations. The SQLite `ensure_columns` shim in `app/db.py`
  only runs on SQLite, so schema changes on Postgres need real migrations.
- **Backups** and **encryption at rest** (CVs are personal data).

### 5. Abuse and cost control [todo]
- Rate-limit the expensive endpoints too: `/api/speech/say` (CPU synthesis),
  `/api/speech/transcribe`, and the LLM-backed routes, to prevent cost/DoS abuse.
- Enforce **request size limits** and tighten CV upload validation (already limited
  to 2 MB and PDF/DOCX/TXT).

### 6. Accounts and compliance [todo]
- **Email verification** on signup, **password reset** flow, and a breached-password
  check (e.g. HaveIBeenPwned k-anonymity API).
- **Account lockout / CAPTCHA** after repeated failures (rate limiting is layer one).
- **GDPR**: data export (in addition to the existing account deletion), a privacy
  policy, and consent records. Ties into the report's LSEPI/ethics chapter.

### 7. Operations [todo]
- **Structured logging + monitoring/alerting**, never logging secrets or PII.
- **Dependency and secret scanning** in CI (Dependabot, `pip-audit`, `npm audit`).
- A pre-deploy **security review** (the repo's `/security-review`).

## Suggested next three (highest value first)
1. **HTTPS** at the deployment layer (blocking for any real launch).
2. **Content-Security-Policy** (report-only first), then enforce.
3. **httpOnly cookie tokens + CSRF**.

For the KURF evaluation study on a controlled setup, the current state is
appropriate: the fundamentals are sound and the default-secret hole is closed. The
items above are for a public, real-world deployment.
