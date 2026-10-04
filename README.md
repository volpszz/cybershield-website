# CyberShield — full-stack learning project

English UI with HTML/CSS/JavaScript, Node.js + Express and SQLite. The Portuguese handbook explains the actual code for someone who already programs but is learning web development.

**Local learning application, not a live security service.** Creating an account does not activate protection. Contact requests are saved locally, not emailed.

## Run

Requires **Node.js 24.13 or newer** (tested on 26.7.0). No separate database server is required. From the project root:

```bash
npm install
npm run setup
npm start
```

Open **http://127.0.0.1:3000/**. Keep the terminal open; Ctrl+C stops the server. `npm run dev` watches backend changes. For lockfile-based installations use `npm ci` and `npm --prefix backend ci`.

Do not open HTML with file://. If port 3000 is occupied, stop the correct other server or configure PORT.

## Features

- Responsive redesigned landing page, services and contact form.
- Actual registration, password verification, login/logout and rotated sessions.
- Confirmation/show-hide password controls; loading/error/empty states.
- Protected dashboard, editable name/company and readonly email.
- SQLite persistence and request history scoped to the authenticated owner.
- Keyboard/mobile navigation, focus styles and live status messages.
- Validation, SQL parameters, CSRF/origin checks, Helmet/CSP and request limits.

Anonymous contact requests are not retroactively linked based on email. Submit while signed in to see a request in your own history. There is no admin panel or fictional monitoring data.

## Structure

```text
public/                 Active frontend; only static-served directory
  *.html                Home, login, registration and dashboard
  css/style.css         Shared responsive styles
  js/api.js             Fetch, CSRF and shared UI helpers
  js/*.js               Page-specific modules
  img/                  Local photograph
  tests/                Frontend tests (not publicly served)
backend/
  server.cjs            Environment, listener and shutdown
  app.cjs               Middleware and routes
  database.cjs          SQLite schema and connection
  passwords.cjs         Async scrypt password hashing
  sessions.cjs          Session/cookie/CSRF lifecycle
  validation.cjs        Backend field rules
  rate-limit.cjs        Single-process IP limits
  data/                 Generated database; excluded from Git
  tests/                API/security/persistence tests
scripts/e2e.cjs         Browser checks with temporary database
docs/                  Handbook, editable source, results, screenshots
  original/             Preserved pre-full-stack learning code
```

Edit **public/** for the current frontend. The previous root HTML/CSS/JS is preserved under docs/original/.

## API contract

Errors return `{message}` JSON. `GET /api/session` supplies a cookie and csrfToken. Mutations require the current `x-csrf-token` header.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | API health |
| GET | `/api/session` | User or null; CSRF token |
| POST | `/api/auth/register` | `{name,email,password,company?}`; creates and signs in |
| POST | `/api/auth/login` | `{email,password}` |
| POST | `/api/auth/logout` | Revokes session |
| PATCH | `/api/profile` | Authenticated `{name,company}` update |
| GET | `/api/inquiries` | Current owner's requests |
| POST | `/api/contact` | `{name,email,service,message}` |

Service keys: firewall, pentest, network, custom. Passwords: 15–128 characters. Ownership and initial status come from the server, not client JSON. Hashes are never exposed by user responses.

## Configuration

Defaults work without .env. Optionally copy backend/.env.example to backend/.env. Existing exported values take precedence.

- PORT: defaults to 3000.
- HOST: defaults to 127.0.0.1 (local only).
- DB_PATH: default backend/data/cybershield.sqlite; prefer an absolute custom path.
- NODE_ENV: production enables Secure cookies and HTTPS-related headers.
- APP_ORIGIN: exact browser origin without trailing slash; explicitly configure for deployment.

Use one hostname consistently: localhost and 127.0.0.1 have different origins/cookies.

## Tests

```bash
npm test
npx playwright install chromium
npm run test:e2e
npm --prefix backend audit --omit=dev
```

Verified: **15 backend tests, 4 frontend tests, 30 browser checks**. Browser tests cover real registration/login/logout, profile persistence, contact/history, untrusted text, Enter, navigation and no horizontal overflow at 320/390/768 px. They use synthetic credentials and isolated temporary databases, not the application's real data. Reports and screenshots are in docs/.

`npm run format` formats the active frontend. Passing tests and dependency audits are not a complete security audit.

## Security and deployment boundaries

Salted asynchronous scrypt uses N=131072,r=8,p=1, not raw SHA-256 or reversible encryption. The database stores only digests of random session tokens. Sessions rotate at authentication and expire after 24 hours. Cookies use HttpOnly, SameSite=Lax and Secure in production. The API has bounded bodies, rate limits and bounded expensive hashing. Data/code/docs are outside the public directory.

Not implemented: email verification, password reset, MFA, SMTP delivery, support/admin workflow, distributed rate limits, production monitoring, tested deployment/backup/restore and privacy/retention policies. SQLite operations are synchronous and the rate limiter is process-local. Before publishing, review HTTPS, proxy/origin configuration, security and operation; changing HOST is not sufficient.

## Portuguese handbook

Open **docs/CyberShield-Guia-Completo.pdf**. Architecture, DOM, modules, forms, HTTP/Fetch, Express, validation, SQL, hashing, sessions, CSRF/XSS, dashboard, tests, debugging and exercises are explained using actual source excerpts.

PDF generation is separate from the website:

```bash
python -m venv .venv-docs
.venv-docs/Scripts/python.exe -m pip install -r docs/requirements.txt
.venv-docs/Scripts/python.exe docs/build_guide.py
```

On Unix, use .venv-docs/bin/python. Review the Markdown @code intervals after source changes. Python is not needed to run the site.

## Credits

The preserved photograph in public/img/data-center-unsplash.jpg is by Kevin Ache via Unsplash. CyberShield and its service presentation are fictional and educational.
