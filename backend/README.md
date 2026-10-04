# CyberShield local backend

## Run

From `backend/`, run `npm install`, then `npm start`. The default address is `http://127.0.0.1:3000`. On this Windows git-bash setup, use `node.exe` for direct Node commands; npm scripts resolve Node normally. `npm run dev` enables Node's watcher. `npm test` runs the real HTTP integration tests and a spawned runtime test on ephemeral ports, never port 3000.

Node 24.13+ is required; the implementation was exercised on Node 26.7.0. It uses Node's built-in SQLite, not a native npm addon. Depending on Node version, SQLite can emit an experimental warning.

Copy `.env.example` to `.env` only if you need overrides. `server.cjs` loads that file through Node's native `process.loadEnvFile`; inherited environment variables win. Available settings: `PORT` (3000), `HOST` (127.0.0.1), `NODE_ENV` (development), `DB_PATH` (absolute `backend/data/cybershield.sqlite` by default), and `APP_ORIGIN` (optional exact browser origin, no trailing slash). Relative custom DB_PATH values are relative to the process working directory. A custom database directory must also stay outside `public/`.

## API contract

All API bodies and responses are JSON. First call `GET /api/session`. Keep the returned `csrfToken` in memory and include it as `x-csrf-token` on every POST/PATCH request. The browser sends the session cookie automatically on same-origin requests. Register/login rotate both the cookie and CSRF token: replace your in-memory CSRF token with the response value. No localStorage authentication token is needed. Calls should be same-origin; this server deliberately does not enable cross-origin credentialed CORS.

`user` is `{id,name,email,company,createdAt}` (numeric id, ISO UTC createdAt). An inquiry row is `{id,name,email,service,message,status,createdAt}`. Status starts as `new`.

| Method and path | Request body | Success response |
| --- | --- | --- |
| GET `/api/health` | None | 200 `{status:'ok',message:'CyberShield API is running.'}` |
| GET `/api/session` | None; issues an anonymous cookie if needed | 200 `{user:null\|user,csrfToken}` |
| POST `/api/auth/register` | `{name,email,password,company?}` + CSRF | 201 `{user,csrfToken}`; creates account and logs in |
| POST `/api/auth/login` | `{email,password}` + CSRF | 200 `{user,csrfToken}` |
| POST `/api/auth/logout` | No fields required; CSRF required | 200 `{message:'Logged out.'}`; revokes session and clears cookie |
| PATCH `/api/profile` | `{name,company}` + authenticated cookie + CSRF | 200 `{user}` |
| GET `/api/inquiries` | Authenticated cookie | 200 `{inquiries:[inquiry,...]}`; only current user's rows, newest first |
| POST `/api/contact` | `{name,email,service,message}` + CSRF; login optional | 201 `{message:'Your request has been saved.',inquiry:{id,status:'new',createdAt}}` |

Contact `service` must be `firewall`, `pentest`, `network`, or `custom`. An authenticated request attaches the current account ID, never an account ID from the body. Anonymous inquiries remain anonymous after registration; matching an email is not ownership proof. This endpoint **stores a request; it does not send email**.

Validation: JSON object required; name 2–100 characters; company 0–150 (optional on registration, omitted company becomes empty string); email 3–254 with basic email syntax, trimmed and lowercased; password 15–128 Unicode characters, never trimmed, no forced composition rules; message 10–5000; service enum above. Company null/non-string is rejected. SQL is parameterized. JSON bodies are limited to 16 KiB. Frontends must display user content as text, not unsanitized HTML.

Errors always use `{message:'English text'}`: 400 validation/malformed JSON, 401 invalid credentials/authentication required, 403 missing/invalid CSRF or disallowed origin, 409 duplicate email, 413 oversized body, 429 rate/concurrency limit, 404 unknown endpoint/page, 500 unexpected internal failure without stack/SQL details. Authentication is checked after CSRF for unsafe routes: missing both yields 403. Valid CSRF on an anonymous profile request yields 401. Logout of a valid anonymous session is permitted; replay after revocation fails CSRF.

## Structure and security

- `server.cjs` is the process/runtime wrapper. `app.cjs` exports `createApp(options)` without listening, enabling isolated tests. Test options are `dbPath`, `production`, `origin`, and `rateLimit:{apiMax,authMax,windowMs}`. Call `app.locals.close()` after closing the HTTP listener; it is idempotent.
- `database.cjs` creates durable users, sessions, and inquiries with foreign keys, WAL, and prepared statements. It seeds no fake data.
- `passwords.cjs` asynchronously derives salted scrypt hashes with N=131072, r=8, p=1 and 256 MiB maxmem. Each hash needs about 128 MiB; at most two authentication operations execute concurrently. Verification uses timing-safe comparison, and nonexistent accounts still perform hash work.
- `sessions.cjs` creates 32-byte opaque random session tokens. SQLite stores only their SHA-256 digests. Separate random CSRF tokens are bound to the server-side session. Sessions have a 24-hour absolute lifetime and rotate on authentication. Cookies are HttpOnly, SameSite=Lax, Path=/ and Secure in production. Expired sessions are removed when a new session is issued.
- `rate-limit.cjs` permits 120 API requests/IP/minute and 10 auth requests/IP/minute by default; forwarded IP headers are not trusted. Rate maps are bounded and periodically pruned. These limits are local-process, not distributed controls.
- Helmet sets CSP with self-only scripts/styles, disables inline execution and framing, and adds security headers. HSTS and upgrade-insecure-requests are disabled in local development. API responses are no-store.
- Static content comes only from `../public`. `/dashboard.html` is server-protected, including encoded/case/trailing-dot variants on Windows. Backend, docs, dotfiles, frontend tests, and package manifests are not exposed.

## Not production-complete

No SMTP delivery, password reset, email verification, MFA, breach-password screening, account deletion, admin inquiry workflow, or deployment/TLS setup is included. Production cookies require HTTPS termination and an explicit APP_ORIGIN is recommended. Reverse-proxy/IP policies require deliberate deployment configuration; Express does not trust proxy headers by default. Protect database files and backups with filesystem permissions. Durable storage does not by itself provide backups, retention policy, or encrypted storage.

## Primary references

- Node crypto: https://nodejs.org/api/crypto.html
- Node SQLite: https://nodejs.org/api/sqlite.html
- Express security practices: https://expressjs.com/en/advanced/best-practice-security/
- OWASP password storage: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- OWASP session management: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- OWASP CSRF prevention: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
