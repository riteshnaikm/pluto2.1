# Sprint A + B + C — Implementation Changelog

## Sprint A — Security & data layer

- **`@login_required`** added to all previously open API/page routes (ask, batch eval, handbooks, evaluations, feedback, job data, PDF download, etc.).
- **`DEFAULT_ADMIN_EMAIL`** env var for admin seed (replaces hardcoded-only approach).
- **`pluto/config.py`**: `resolve_secret_key()` fails in production if unset; dev uses ephemeral key with warning.
- **Session cookies**: `HTTPONLY`, `SAMESITE`, `SECURE` (production), `MAX_CONTENT_LENGTH` (default 10 MB).
- **`pluto/db.py`**: SQLite WAL + 12 performance indexes on startup via `ensure_indexes()`.
- **`pluto/uploads.py`**: UUID-prefixed uploads (no `resume.pdf` collisions).
- **`pluto/errors.py`**: Generic 500 JSON in production; 413/429 handlers.
- **`templates/history.html`**: Removed `[VERIFIED FILE]` debug title.

## Sprint B — Performance & assets

- **`/evaluate-stream`**: Already runs stability/career tasks concurrently with main LLM (event-loop fix in `app.py`).
- **`resume-evaluator.js`**: JD quality score + handbook generation run in **parallel** (`Promise.all` pattern).
- **`static/js/dashboard.js`**: Chart/analytics fetches run in **parallel** via `Promise.all`.
- **Assets**: Hub/base use `peoplelogic-logo-300x77.png` and `plbot_right_faced.png`; lazy-loading on images.
- **Removed jQuery** from `base.html` (unused).

## Sprint C — CSRF, rate limits, structure

- **`flask-wtf` + `flask-limiter`** in `requirements.txt`.
- **`pluto/extensions.py`**: CSRF + per-user rate limits on hot routes (`/api/ask`, `/evaluate*`, handbook, batch).
- **`static/js/pluto-api.js`**: Shared `plutoFetch()` with `X-CSRFToken`.
- **`templates/base.html`**: CSRF meta tag, `pluto-api.js`, `head_extra` block.
- **Dashboard**: CSS → `static/css/dashboard.css`, JS → `static/js/dashboard.js`.
- **`pluto/blueprints/`**: Scaffold for future route split.

## Phase 2 — Performance, UX, and hardening (follow-up)

- **`pluto/security_headers.py`**: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, etc.
- **`pluto/job_history.py`**: Bulk SQL for `/api/job-centric-history` (removes per-job N+1 queries).
- **`pluto/messages.py`**: `safe_api_error()` for production-safe API errors.
- **`.env.example`** + **`.gitignore`** for secrets, venv, DB, uploads.
- **Resume extract**: PDF/DOCX extraction runs on `_IO_EXECUTOR` thread pool (sync + stream routes).
- **`/evaluate-batch`**: Up to 3 concurrent evaluations via `asyncio.gather` + semaphore.
- **Handbook UI**: Wired to **`/api/generate-recruiter-handbook-stream`** with incremental render + cancel button.
- **`static/css/copilot.css`**: Extracted from `index2.html` (~980 lines inline CSS removed).
- **CSRF**: `apiFetch` / `plutoFetch` across `resume-evaluator.js` and admin paths in `dashboard.js`.

### Phase 2b (latest)

- **MatchMaker early score**: `/evaluate-stream` streams LLM tokens; emits `match_preview` SSE when `"JD Match"` appears in partial JSON.
- **OAuth domain allowlist**: `ALLOWED_EMAIL_DOMAINS` (default `peoplelogic.in`; use `*` for any).
- **CSP**: optional `ENABLE_CSP` (on by default in production) via `pluto/security_headers.py`.
- **Handbook copy buttons**: event delegation on `.handbook-copy-btn` (no per-button `onclick`).

### Phase 3 (blueprints, cleanup, hygiene)

- **Blueprints**: `pluto/blueprints/auth.py`, `pages.py`, `admin.py` — login/OAuth, main pages, admin APIs moved off `app.py`.
- **`pluto/users_db.py`**, **`pluto/auth_decorators.py`** — shared user helpers and decorators.
- **Upload cleanup**: `pluto/upload_cleanup.py`, `scripts/cleanup_uploads.py`, Flask CLI `flask cleanup-uploads`.
- **Removed dead files**: `templates/index copy.html`, `mp43*.js/html` backups at repo root.

### Phase 3b — `pluto_api` blueprint

- **`pluto/blueprints/pluto_api.py`**: Registers **36** routes moved off `@app.route` decorators: `/evaluate*`, `/get_interview_questions/...`, `/api/ask`, `/api/update_index`, all `/api/generate-*` handbook paths, JD quality, job-id APIs, `/api/handbooks*` / evaluations / job-centric history, `/api/analytics/*`, evaluation PDF/handbook PDF downloads.
- **`register_pluto_api_blueprint()`** is called at **end** of `app.py` so most heavy view bodies remain in `app.py` without circular imports; **`pluto.routes.feedback_views`** holds feedback-only endpoints. `@limiter` / `@login_required` / `@role_required` stay on the respective view functions.

### Phase 3c — legacy page routes onto blueprint

- Added **`pluto/blueprints/pages_legacy.py`** to register `/history`, `/feedback_history`, `/evaluation/<id>`, `/test-tabs`.
- Removed their direct `@app.route` decorators from `app.py`.
- Added compatibility aliases so existing `url_for('history')`, `url_for('feedback_history')`, `url_for('view_evaluation')`, etc. still work.

### Phase 3d — `pluto/routes` (history pages + feedback API)

- **`pluto/routes/history_views.py`**: `test_tabs`, `view_evaluation`, `history`, `feedback_history`.
- **`pluto/routes/feedback_views.py`**: `/api/feedback/all`, `/api/feedback/check/...`, `/api/feedback/handbook`, `/api/feedback` (submit).
- Wired from **`pages_legacy`** and **`pluto_api`**; uses `DATABASE_NAME` from `pluto.users_db` (same default as former `combined_db.db` literals).

### Phase 4 — Finish partial / started work

- **`/evaluate-stream`**: `async def` route; overlapping LLM tasks via `asyncio.create_task` / `asyncio.to_thread` (no per-request `asyncio.run` loop).
- **Eval SSE**: `match_preview`, `eval_field_preview` (profile summary snippet), strict JSON parse (`STRICT_EVAL_JSON`, default on).
- **Handbook SSE**: `section` events from streamed markdown; loader advances from real `###` headers (fake 1.6s timer removed).
- **`static/js/handbook-stream.js`**, **`static/js/eval-stream.js`**: extracted stream clients (resume-evaluator delegates).
- **Handbook DOM**: `requestIdleCallback` for `enhanceHandbookFormatting` / workspace build.
- **PyMuPDF-first** PDF text extraction with pdfplumber fallback.
- **`pluto/analytics_overview.py`**: consolidated headline metrics query (fewer round-trips).
- **Dashboard**: `destroyAllCharts()` on refresh; dark-mode card/table styles; fixed `dashboard.js` / `dashboard.css` stray `<script>` / `<style>` wrappers.
- **Home hub**: `index.html` extends `base.html` + `static/css/hub.css` (personalized greeting, History shortcut).
- **`DATABASE_NAME`**: all `app.py` DB connects use constant (no `combined_db.db` literals).
- **Scheduled upload cleanup**: `UPLOAD_CLEANUP_INTERVAL_HOURS` + `pluto/scheduled_tasks.py`.
- **LLM warm-up**: `warm_llm_providers()` from `run.py` after `setup_llm_chain()`.
- **Removed** `/test-tabs` route and `test_tabs` view.

### Phase 5 — Recruitment intake handbook

- **Merged form**: AM Recruitment Intake Checklist + handbook fields in `templates/partials/handbook_intake_form.html`.
- **`pluto/handbook_intake.py`**: schema, validation, prompt formatting, expanded 14-section playbook prompt.
- **`intake_json`** column on `recruiter_handbooks`; `/api/get-job-data` returns saved intake for autofill.
- **`static/js/handbook-intake-form.js`**: collect / validate / populate intake payload.

### Still open (not started — discuss next)

- Full `app.py` → service layer / remaining blueprints.
- PostgreSQL migration.
- Candidate pipeline, JD library, compare view, integrations.
- Full ES module split of `resume-evaluator.js` (helpers extracted; main file still large).
- Phase 4 eval latency profiling sprint (env caps, p50/p95).

## After deploy

```bash
pip install -r requirements.txt
```

Set in `.env`:

```env
FLASK_SECRET_KEY=<long-random-string>
FLASK_ENV=production
SESSION_COOKIE_SECURE=true
DEFAULT_ADMIN_EMAIL=your-admin@company.com
```

Restart the app so `init_db()` applies indexes and WAL mode.

## Follow-ups (not in this sprint)

- Full `app.py` → Flask Blueprints + service modules.
- PostgreSQL when concurrent load grows.
- Product features (pipeline, JD library, etc.) — see Phase 4 “Still open” above.
