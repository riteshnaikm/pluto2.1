# PLUTO — HR Assistant Suite

**Product Context Document** (handoff doc for AI assistants / new engineers)

> **Last reviewed:** May 2026. Read this once before touching any code. It explains *what the product is*, *what's
> inside the repo*, *how it's wired together*, and *where the known landmines are*.

---

## 1. What is this product?

**PLUTO** (also called *HR Assistant Suite* internally, and *Recruiter Co-Pilot*
in some screens) is an internal AI tooling suite built by **PeopleLogic** for its
own recruiters and HR team. It is **not** a customer-facing SaaS — it is a single-
tenant internal app deployed on PeopleLogic's server, accessed by employees via
Google sign-in.

The mascot is a friendly blue robot named **PLUTO** (`plbot.png`). Brand voice:
helpful, conversational, slightly playful ("Hello there, PeopleLogic team!").

### The three tools, in plain English

| Tool | What it does | Who uses it |
|---|---|---|
| **Info Buddy** | Chat with PeopleLogic's HR policy PDFs (RAG over `HR_docs/`). Ask things like "what's the WFH policy?" or "how does PREP work?" and get a cited answer. | Every employee |
| **Recruiter Co-Pilot → Recruiter Handbook** | Paste a Job Description (or pull one from Oorwin by Job ID) → generate a comprehensive recruiter handbook in markdown (interview strategy, boolean search samples, key tech areas, etc.) → download as PDF. | Recruiters |
| **Recruiter Co-Pilot → MatchMaker** | Upload a resume + JD → get a "JD Match %", missing keywords, profile summary, candidate fit analysis, job stability score, career progression analysis, and tailored interview questions. Save feedback. Download report as PDF. | Recruiters |

Two supporting screens:
- **History** — past evaluations & handbooks (filterable by team/user/job).
- **Analytics Dashboard** — usage metrics, team/user/date filters, CSV export.
- **Admin Panel** — user role + team management (Admin only).

---

## 2. Tech stack at a glance

| Layer | Tech |
|---|---|
| Web framework | **Flask** (`app.py` ~8,200 lines; routes split across `pluto/blueprints/`) |
| ASGI server | **Hypercorn** (Flask wrapped in `asgiref.wsgi.WsgiToAsgi`) — used so `async def` Flask routes work |
| Auth | **Google OAuth** via `Authlib` — session-based (Flask `session`) |
| Database | **SQLite** — single file `combined_db.db` at repo root |
| Templating | **Jinja2** + **Bootstrap 5.3** (loaded from jsDelivr CDN) + Bootstrap Icons |
| Frontend JS | Vanilla JS, **Marked.js** for markdown, **DOMPurify** for sanitization, **Chart.js** on dashboard |
| LLM providers | **Gemini** (default), **Groq**, **OpenAI**, **NVIDIA NIM / Nemotron** (fallback). All abstracted behind `async_gemini_generate()` → `generate_content_unified()` despite the name. |
| Embeddings | `sentence-transformers/all-MiniLM-L6-v2` (384-dim) via `langchain-huggingface` |
| Vector DB | **Pinecone** serverless (`hr-knowledge-base` index, AWS `us-east-1`, cosine) |
| Keyword retrieval | **BM25** (`rank_bm25`) built at startup over `HR_docs/` |
| RAG orchestration | **LangChain** (`langchain-community`, `langchain-pinecone`, `langchain-groq`) |
| Document parsing | `pdfplumber`, `pymupdf`, `pytesseract` (OCR fallback), `python-docx`, optional LibreOffice for `.doc → .docx` |
| PDF output | **ReportLab** (custom flowables for evaluation and handbook PDFs) |
| Concurrency | `asyncio.gather` for fan-out LLM calls + `concurrent.futures.ThreadPoolExecutor` |
| Caching | In-process dict + `functools.lru_cache`; evaluation cache TTL 1800s, max 200 entries |
| Deployment | Hypercorn on `0.0.0.0:5000` (Linux prod) or `127.0.0.1:5000` (Windows dev). HTTPS is **off** (terminated upstream). |

---

## 3. Repo layout

```
pluto2-main/
├── README.md                    # Quick start → points to docs/
├── app.py                       # Monolith. Most routes and LLM logic.
├── run.py                       # Hypercorn entrypoint
├── run_production.py            # Alt prod entrypoint
├── verify_before_deploy.py      # Pre-deploy sanity checks
├── requirements.txt
├── .env / .env.example          # Secrets (never commit .env)
├── combined_db.db               # SQLite — NEVER commit
│
├── docs/                        # All documentation (see docs/README.md)
│   ├── product/                 # PRODUCT_CONTEXT.md, PRODUCT_DETAILS.md
│   ├── architecture/            # HLD.md, LLD.md
│   ├── integrations/            # VOXPRO_API.md
│   ├── design/                  # BRAND_COLOR_AUDIT.md
│   ├── deployment/              # DEPLOYMENT.md, GIT_PUSH_INSTRUCTIONS.md
│   ├── guides/                  # ENV_AND_MODELS.md, MODEL_SWITCHING_GUIDE.md, …
│   ├── changelog/               # SPRINT_ABC_CHANGELOG.md
│   ├── archive/                 # Roadmap, evaluations, backlog, old scripts
│   └── prompts/                 # JD / resume prompt experiments (reference only)
│
├── pluto/                       # Blueprints, routes, helpers
├── templates/                   # Jinja2 UI (extends base.html)
├── static/
│   ├── css/                     # brand-tokens, bootstrap-overrides, copilot, history, batch-comparison, …
│   ├── js/                      # resume-evaluator.js, handbook-stream.js, eval-stream.js, history.js, …
│   └── images/                  # plbot.png, plbot_right_faced.png, peoplelogic-logo-300x77.png, peoplelogic.png (PDF)
├── HR_docs/                     # RAG policy PDFs
├── uploads/                     # Uploaded resumes
├── scripts/                     # Maintenance utilities
└── deploy_scripts/              # Production setup
```

**Removed in repo cleanup (2026):** `base2.html`, `index2.html.backup`, root stray `index2.html`,
duplicate logos, `API_KEYS_SETUP.txt`, `SERVER DETAILS.txt`, `JD_Modified_prompt/` (→ `docs/prompts/`).

---

## 4. Runtime architecture

```
            ┌────────────────────────────────────────────┐
            │  Browser (Bootstrap 5 SPA-ish pages)       │
            │  - index.html (landing)                    │
            │  - index1.html (Info Buddy chat)           │
            │  - index2.html (Handbook + MatchMaker)     │
            │  - dashboard / history / admin             │
            └─────────────────┬──────────────────────────┘
                              │ HTTPS (terminated upstream) / HTTP locally
                              ▼
            ┌────────────────────────────────────────────┐
            │  Hypercorn (ASGI)                          │
            │    └─ WsgiToAsgi(Flask app)                │
            │       ├─ Google OAuth (Authlib)            │
            │       ├─ login_required / role_required    │
            │       └─ 54 routes (auth/api/pages)        │
            └─────┬──────────────────────────┬───────────┘
                  │                          │
        ┌─────────▼────────┐       ┌─────────▼─────────────────┐
        │ SQLite           │       │ AI / Retrieval layer      │
        │ combined_db.db   │       │                           │
        │  8 tables, no    │       │ async_gemini_generate(…)  │
        │  indexes, opened │       │   → unified provider switch│
        │  per-request via │       │     ├─ Gemini             │
        │  sqlite3.connect │       │     ├─ Groq               │
        └──────────────────┘       │     ├─ OpenAI             │
                                   │     └─ NVIDIA NIM         │
                                   │                           │
                                   │ RAG (Info Buddy):         │
                                   │   Pinecone (vector)       │
                                   │   + BM25 (keyword)        │
                                   │   = hybrid retrieval      │
                                   │                           │
                                   │ Embeddings: MiniLM-L6 (HF)│
                                   └───────────────────────────┘
                                                  │
                                   ┌──────────────▼───────────┐
                                   │ Oorwin ATS API           │
                                   │ (job_id → JD lookup)     │
                                   └──────────────────────────┘
```

---

## 5. Data model — `combined_db.db`

All tables live in one SQLite file. No indexes are defined. No migration framework
— schema evolution is done inline in `init_db()` using `PRAGMA table_info` +
`ALTER TABLE ... ADD COLUMN` branches.

```sql
users (
  id INTEGER PK, email TEXT UNIQUE, name TEXT,
  role TEXT NOT NULL DEFAULT 'Recruiter',  -- Admin | Business Manager | Anchors | Recruiter
  team TEXT,                                -- ITS | OSS | PCS | ISV | Core
  manager_email TEXT FK→users(email),
  created_at, updated_at
)

evaluations (
  id INTEGER PK, resume_path, filename,
  job_title, job_description,
  match_percentage REAL,
  match_factors TEXT (JSON),               -- skills/experience/education/industry/cert sub-scores
  profile_summary TEXT,
  missing_keywords TEXT (JSON list),
  job_stability TEXT (JSON),               -- score, risk_level, avg_tenure, job_count, explanation
  career_progression TEXT (JSON),          -- progression_score, observations, career_path, red_flags
  technical_questions TEXT (JSON),
  nontechnical_questions TEXT (JSON),
  behavioral_questions TEXT (JSON),
  oorwin_job_id TEXT,                      -- links to ATS job
  candidate_fit_analysis TEXT (JSON),      -- dimensions table, risks, recommendation, narrative
  over_under_qualification TEXT,
  time_taken REAL,                         -- end-to-end latency in seconds
  user_email TEXT,                         -- who ran the evaluation
  evaluation_mode TEXT DEFAULT 'single', -- single | batch
  batch_group_id TEXT,                     -- shared UUID for one multi-resume comparison run
  timestamp DATETIME
)

interview_questions ( id, evaluation_id FK, technical/nontechnical/behavioral, timestamp )

recruiter_handbooks (
  id INTEGER PK, oorwin_job_id, job_title, job_description,
  additional_context, markdown_content,
  time_taken REAL, user_email, timestamp
)

qa_history       ( id, question, retrieved_docs (JSON), final_answer, feedback, timestamp )
qa_feedback      ( id, question_id FK→qa_history, rating 1-5, feedback, timestamp UNIQUE(question_id) )
feedback         ( id, evaluation_id FK, rating, comments, timestamp UNIQUE(evaluation_id) )
handbook_feedback( id, handbook_id FK→recruiter_handbooks, rating 1-5 CHECK, comments, timestamp )

voxpro_calls ( slno PK, phone_normalized, datetime, email_id, src, dst, dur, callmethod,
  rec_fname, rec_location, status, recording_url, local_path, download_status, raw_json, ingested_at )

call_transcripts ( id, slno FK, phone_normalized, transcript_text, engine, created_at )

candidate_call_analyses ( id, phone_normalized, oorwin_job_id, evaluation_id, handbook_id,
  call_count, merged_transcript, merged_wav_path, stt_method, analysis_json, analysis_markdown,
  time_taken, user_email, created_at, updated_at )
```

**Field conventions**: anything ending in `_questions`, `match_factors`, `job_stability`,
`career_progression`, `candidate_fit_analysis`, `missing_keywords`, `retrieved_docs` is
**JSON stored as TEXT**. Always `json.loads()` on read, `json.dumps()` on write.

---

## 6. API surface (54 routes)

### Auth / page routes
```
GET  /login                              login page
GET  /login/google                       initiate OAuth
GET  /login/google/authorized            OAuth callback
GET  /logout
GET  /                                   landing (tool hub)
GET  /admin                              Admin-only user/role/team UI
GET  /hr-assistant                       Info Buddy page
GET  /resume-evaluator                   Recruiter Co-Pilot (?section=handbook|matchmaker)
GET  /evaluation/<int:eval_id>           single evaluation viewer
GET  /history                            history table
GET  /call-analysis                      VoxPro call analysis (beta test page)
GET  /feedback_history                   feedback log
GET  /dashboard                          analytics
```

### Admin API
```
GET    /api/admin/users
POST   /api/admin/users                   create/update
DELETE /api/admin/users/<email>
GET    /api/admin/teams                   ['ITS','OSS','PCS','ISV','Core']
GET    /api/admin/roles                   ['Admin','Business Manager','Anchors','Recruiter']
GET    /api/admin/accessible-users        scoped by current user's team
```

### Core feature APIs
```
POST /api/ask                             Info Buddy Q&A (RAG)
POST /api/update_index                    rebuild Pinecone/BM25 index

POST /evaluate                            MatchMaker (sync)
POST /evaluate-stream                     MatchMaker (Server-Sent Events progress)
POST /evaluate-batch                      Multi-resume evaluation
GET  /get_interview_questions/<eval_id>
GET  /api/evaluation/<eval_id>
GET  /api/evaluation-full/<int:eval_id>
POST /api/generate_questions/<eval_id>

POST /api/generate-recruiter-handbook
POST /api/generate-recruiter-handbook-stream   handbook SSE (primary UI path)
POST /api/generate-handbook-summary       short summary of a handbook
POST /api/jd-quality-score                rates JD quality (gives suggestions)

GET  /api/get-job-ids                     autocomplete from Oorwin
GET  /api/get-job-data/<job_id>           pull JD by Oorwin ID
GET  /api/client-call-records             GCS transcript index (PeopleLogic Recorder)
GET  /api/client-call-records/detail      full transcript JSON by `path`
GET  /api/get-handbooks
GET  /api/handbook/<int:handbook_id>
GET  /api/handbooks-only
GET  /api/evaluations-only
GET  /api/job-centric-history
GET  /api/handbooks-by-job/<job_id>
GET  /api/evaluations-by-job/<job_id>

POST /api/download-evaluation-pdf         ReportLab
POST /api/download-handbook-pdf           ReportLab (async)

POST /api/voxpro/calls/fetch              VoxPro log ingest + optional WAV download
POST /api/voxpro/calls/analyze             Full call pipeline (STT + LLM analysis)
GET  /api/voxpro/calls?phone=              Cached calls + latest analysis
```

### Feedback APIs
```
POST /api/feedback                        evaluation feedback
POST /api/feedback/handbook               handbook feedback
GET  /api/feedback/all
GET  /api/feedback/check/<feedback_type>/<int:item_id>
```

### Analytics APIs (all dashboard)
```
GET /api/analytics/overview                       KPIs + previous-period trend
GET /api/analytics/timeline                       activity over time
GET /api/analytics/team-performance
GET /api/analytics/match-score-distribution
GET /api/analytics/user-activity
GET /api/analytics/recent-activity
GET /api/analytics/top-jobs
GET /api/analytics/export-csv
```

All `/api/*` routes guarded by `@login_required` return JSON `401 { error: "Authentication required" }`
(not an HTML redirect) so the frontend can JSON-parse safely.

---

## 7. Auth & access control model

- **Authentication**: Google OAuth (workspace email). On success, user is upserted
  into `users` with default role `Recruiter`. Session stores `{email, name, role, team}`.
- **Authorization**:
  - `@login_required` — must be signed in
  - `@role_required('Admin')` — Admin-only
  - **Team-based data scoping**: `get_accessible_user_emails(current_user)` returns
    the list of emails whose data the current user is allowed to see. Same-team
    members see each other's evaluations/handbooks. Users with no team assigned see
    everyone (backward-compat). This list is interpolated into every analytics/history
    query as `WHERE user_email IN (?,?,?, ...)`.
- **Default admin**: `ritesh.m@peoplelogic.in` is hard-seeded into `users` at first boot.

---

## 8. AI / LLM configuration model

PLUTO supports per-feature provider/model overrides via env vars. The unified
entrypoint is **`async_gemini_generate()`** (badly named — it dispatches to
whatever provider is configured).

```
Global default:     MODEL_PROVIDER = gemini | openai | groq
Per-feature:        INFO_BUDDY_MODEL_PROVIDER, HANDBOOK_MODEL_PROVIDER, EVALUATION_MODEL_PROVIDER
Per-feature model:  EVALUATION_GROQ_MODEL, HANDBOOK_GROQ_MODEL, ...
Per-feature knobs:  EVALUATION_GROQ_REASONING_EFFORT (low|medium|high), …MAX_COMPLETION_TOKENS, …NVIDIA_REASONING_BUDGET
Cache:              EVALUATION_CACHE_ENABLED (default true), TTL 1800s, max 200 entries
Speed mode:         FAST_EVAL_MODE=true → skip parallel stability/career LLM calls, use heuristics
Fallback:           Groq/OpenAI failure → calls FALLBACK_OPENAI_MODEL on OPENAI_BASE_URL
                    (NVIDIA NIM + Nemotron by default)
```

JSON parsing of LLM output is defensive: strips ```json fences, brace-balances,
falls back to canned defaults (`get_default_resume_evaluation`,
`get_default_career_analysis`) if parsing fails so the user always gets *something*.

---

## 9. Key user flows in detail

### MatchMaker (resume evaluation)
1. User uploads resume (pdf/doc/docx) + JD on `/resume-evaluator?section=matchmaker`.
2. POST `/evaluate-stream` (or `/evaluate` for sync).
3. Server: `secure_filename` → save to `uploads/` → extract text (pdfplumber → pymupdf
   → pytesseract OCR fallback for image PDFs; LibreOffice for `.doc`).
4. **Three LLM calls run concurrently** via `asyncio.gather`:
   - Core JD-match analysis (`input_prompt_template`) — produces JSON with JD Match %,
     missing keywords, profile summary, match factors, over/under-qualification,
     candidate fit analysis.
   - Job stability analysis (parses tenure, calculates score, identifies job-hopping).
   - Career progression analysis (promotions, lateral moves, red flags).
5. Interview questions are picked from defaults (`get_default_interview_questions`)
   + `QUICK_CHECKS` constant — fast path, no extra LLM call.
6. Result is persisted to `evaluations` + `interview_questions` and returned as JSON
   with `time_taken` recorded.
7. Frontend renders score dial, factor bars, missing-keyword chips, stability/risk
   panel, candidate-fit tables, interview tabs, and a feedback widget. PDF download
   regenerates via `/api/download-evaluation-pdf` (ReportLab).

### Recruiter Handbook
1. User pastes JD or fetches via `GET /api/get-job-data/<oorwin_job_id>` (shared intake form: `partials/handbook_intake_form.html`).
2. Optional **Client call Records** dropdown — `GET /api/client-call-records` lists PeopleLogic Recorder transcripts from GCS; selected `path` is sent as `selected_transcript_path` on generate and injected into the LLM prompt.
3. Optional JD-quality score via `/api/jd-quality-score` (tiered: strong/ok/risk
   with suggestions).
4. POST `/api/generate-recruiter-handbook-stream` (SSE; `handbook-stream.js`) — or non-stream `/api/generate-recruiter-handbook`.
5. Saved to `recruiter_handbooks`. Frontend renders via `pluto-handbook-result.js` + Marked.js + DOMPurify.
6. PDF download via `/api/download-handbook-pdf` (async ReportLab).

### MatchMaker batch (multi-resume)
1. User uploads 2+ resumes on Co-Pilot → POST `/evaluate-batch`.
2. Server compares candidates, returns ranked markdown + `evaluation_id` per file.
3. Each resume saved with `evaluation_mode='batch'` and shared `batch_group_id`.
4. UI: `batch-comparison.css` + `renderBatchComparison()` in `resume-evaluator.js`.

### Job History
1. GET `/history` — job-centric view (`history.html`, `history.js`).
2. GET `/api/job-centric-history` — grouped by Oorwin job; batch vs single icons in UI.
3. GET `/api/evaluations-by-job/<job_id>` — modal list per job.

### VoxPro call analysis (beta)
1. Open **Call Analysis** at `/call-analysis` (hub + Co-Pilot sidebar; same auth as other pages).
2. Enter candidate phone → POST `/api/voxpro/calls/analyze` — fetch logs, download WAVs (`dur` numeric), merge audio (or per-call STT fallback), transcribe, LLM report.
3. Results on-page via `static/js/call-analysis-page.js`; persisted in `candidate_call_analyses`. MatchMaker links here (inline VoxPro UI removed until merge into eval/history).

### Info Buddy
1. POST `/api/ask` with the user's question.
2. Server expands acronyms (`ACRONYM_MAP`: wfh→work from home policy, pto→paid
   time off, etc.).
3. **Hybrid retrieval**: BM25 top-N + Pinecone semantic top-N → merge + dedupe.
4. ChatGroq (or configured provider) answers with retrieved chunks as context.
5. Q&A logged to `qa_history`; user can rate via `qa_feedback`.

---

## 10. UI conventions

- **Brand system:** `static/css/brand-tokens.css` + `bootstrap-overrides.css` (see `docs/design/BRAND_COLOR_AUDIT.md`). Match-score colours: ≥70 olive, 40–69 yellow, &lt;40 orange.
- **Colors** (CSS variables in both legacy hex and modern OKLCH):
  - `--primary-blue / --c-blue`   = `#0d6fae` / `oklch(55% 0.18 250)`
  - `--primary-green / --c-green` = `#7d8e2c` / `oklch(70% 0.18 140)`
  - `--primary-yellow / --c-yellow` = `#f6c206` / `oklch(80% 0.18 85)`
  - `--primary-orange / --c-orange` = `#e26014` / `oklch(65% 0.22 35)`
- **Dark mode**: `<html data-theme="dark|light">`, persisted to `localStorage.theme`.
  Set inline before page render to avoid flash.
- **Fonts**: Inter (Google Fonts) on the modern pages (`index.html`, `index2.html`);
  Segoe UI fallback elsewhere.
- **Iconography**: Bootstrap Icons (`bi-*`).
- **Mascot**: `plbot.png` / `plbot_right_faced.png` — used on landing, login, and as
  a floating sidebar element. Animated with `@keyframes pb-float`.
- **Speech-bubble** typewriter intro on `index.html`.

---

## 11. Glossary (important for an AI handover)

| Term | Meaning |
|---|---|
| **PLUTO** | The product / mascot. Capitalized when used as the assistant's name. |
| **PeopleLogic** | The company. Owns the app. |
| **Info Buddy** | RAG chatbot over HR policy PDFs. |
| **Recruiter Co-Pilot** | Umbrella name for Handbook + MatchMaker. Same page (`index2.html`). |
| **Recruiter Handbook** | LLM-generated markdown briefing for a job. |
| **MatchMaker** | Resume-vs-JD evaluator. |
| **Oorwin** | The external ATS PeopleLogic uses; we fetch JDs by `oorwin_job_id`. |
| **VoxPro** | Internal telephony — `pluto/voxpro/`, `docs/integrations/VOXPRO_API.md`. |
| **QUICK_CHECKS** | Hard-coded list of 10 standard recruiter screening questions. |
| **ACRONYM_MAP** | Expands HR acronyms (wfh, pto, posh, prep, etc.) before RAG retrieval. |
| **PREP** | Performance Review & Enhancement Program — an HR policy. |
| **POSH** | Policy On Prevention of Sexual Harassment — an HR policy. |
| **KRA** | Key Responsibility Area — an HR policy. |
| **Teams** | `ITS`, `OSS`, `PCS`, `ISV`, `Core` — used for data scoping. |
| **Roles** | `Admin`, `Business Manager`, `Anchors`, `Recruiter`. |
| **handbook** / **evaluation** | The two unit-of-work types stored in DB. |
| **batch_group_id** | Links multiple evaluations from one multi-resume run. |

---

## 12. Known tech debt & landmines (read before editing!)

These are factual observations from a code review — flag any change against them.

1. **`app.py` remains a large monolith** (~8k+ lines). Blueprints exist for pages/auth/API
   but most logic is still in `app.py`. Further split into `services/` is high leverage.
2. **`.gitignore` exists** — still verify `git status` before every commit; never commit `.env`, `combined_db.db`, or plaintext key files.
3. **Default insecure secret**: `SECRET_KEY = "your-secret-key-change-in-production-12345"`
   if env var is missing. Production must set `FLASK_SECRET_KEY`.
4. **CSRF + rate limiting partially in place** (`pluto/extensions.py`: CSRFProtect, Flask-Limiter on hot endpoints). Not all POST routes may be equally protected — verify when adding APIs. Security headers via `pluto/security_headers.py` when enabled.
5. **SQLite without WAL, without indexes, without a connection pool.** Every request
   does `sqlite3.connect(DATABASE_NAME)` (54 such calls). Will be a bottleneck at
   even moderate concurrency. Add `PRAGMA journal_mode=WAL`, `synchronous=NORMAL`,
   and indexes on `evaluations(user_email, timestamp, oorwin_job_id, match_percentage)`,
   `recruiter_handbooks(user_email, timestamp, oorwin_job_id)`, `users(team)`.
6. **No migration framework**. Schema evolves via inline `PRAGMA table_info` + `ALTER
   TABLE ... ADD COLUMN` in `init_db()`. Legacy `migrate_database.py` is archived under `docs/archive/`.
7. **130 broad `except Exception:` handlers** — swallows errors and hides bugs.
   Most should narrow the exception class and re-raise after logging.
8. **`print()` mixed with `logging`** (31 prints). Standardize on `logging`.
9. **Dynamic SQL via f-strings.** Parameters are bound, but `WHERE` clauses are
   concatenated by hand (see `/api/analytics/overview`). Easy to break and hard to
   read. Use a query builder or split into composable helpers.
10. **Inline CSS in templates is massive** — `index2.html` has ~1,100 lines of
    `<style>` before the markup. Migrate to `static/css/`.
11. **`static/js/resume-evaluator.js` is 3,442 lines / 178 KB**, written in vanilla
    JS DOM mutations. Break into modules; consider Alpine.js or a small build step.
12. **Stale duplicates** — largely cleaned up (2026); avoid re-adding backup templates or duplicate multi‑MB logos in `static/`.
13. **CDN-served Bootstrap / Marked / DOMPurify / Chart.js** on every page —
    works but means the app is unusable offline and is subject to CDN availability.
14. **`uploads/` cleanup** — optional scheduler via `UPLOAD_CLEANUP_INTERVAL_HOURS` (`pluto/scheduled_tasks.py`) or `scripts/cleanup_uploads.py`.
15. **No CI / no tests**. Add at least smoke tests for the 4 critical endpoints
    (`/evaluate`, `/api/ask`, `/api/generate-recruiter-handbook`, `/api/analytics/overview`).
16. **`requirements.txt` has no version pins** (only `langchain`, `flask`, etc.).
    Reproducible builds will break. Pin everything via `pip freeze`.
17. **`google.generativeai` import is `genai = None`** at module load and lazily
    initialised — be careful when adding new Gemini call sites.
18. **`debug=True` is not set** (good), but `config.use_reloader = True` is on in
    `run.py` — disable in production.
19. **Authlib OAuth `authorize_callback='authorize'`** is non-standard usage; the
    standard authlib callback path `/login/google/authorized` is what's actually
    registered. Don't "fix" one without the other.
20. **PDF generation is synchronous in `/api/download-evaluation-pdf`** and async
    in `/api/download-handbook-pdf` — inconsistent. Both should be async/background.

---

## 13. How to run locally

```
python -m venv venv
venv\Scripts\activate           # Windows
pip install -r requirements.txt

# .env must contain:
#   GROQ_API_KEY=...
#   PINECONE_API_KEY=...
#   GEMINI_API_KEY=...
#   OPENAI_API_KEY=...
#   GOOGLE_CLIENT_ID=...
#   GOOGLE_CLIENT_SECRET=...
#   FLASK_SECRET_KEY=...
#   MODEL_PROVIDER=gemini        (or openai / groq)

python run.py
# → http://127.0.0.1:5000  (Windows local dev)
# → http://0.0.0.0:5000    (Linux prod via Hypercorn)
```

First run will: build Pinecone index from `HR_docs/`, build the BM25 index in
memory, initialize the LLM chain, and seed the admin user.

---

## 14. What "good" looks like for this product going forward

Short list, prioritized:
1. **Lock the repo down** — keep `.gitignore` current, rotate any keys ever committed in plaintext files,
   set a real `FLASK_SECRET_KEY`, enable Flask-Talisman + CSRF.
2. **Break up `app.py`** into Flask blueprints: `auth/`, `evaluator/`, `handbook/`,
   `assistant/`, `analytics/`, `admin/`, `pdf/`, with a `services/` layer for LLM,
   `db/` for SQL, and `models/` for serializers.
3. **Move SQLite to WAL + add indexes** today; plan migration to Postgres before
   concurrent users > ~20.
4. **Adopt Alembic** for migrations.
5. **Bundle frontend assets locally** (or move to Vite + a tiny SPA shell) and
   delete the duplicate templates.
6. **Add Flask-Limiter** on `/evaluate*`, `/api/ask`, `/api/generate-*-handbook`,
   `/login/google` — these are LLM-cost-exposed and brute-forceable.
7. **Background workers** (RQ/Celery) for `/evaluate-stream` and PDF generation
   so the ASGI worker isn't blocked.
8. **Centralize prompts** into `prompts/` as versioned templates; today they are
   ~30 huge multi-line strings scattered in `app.py`.
9. **Observability**: structured logging (JSON), request IDs, prompt/response
   logging with PII redaction, latency histograms per LLM provider.
10. **UI consistency pass** — `index.html` and `index2.html` use the modern OKLCH
    design system; `base.html`, `history.html`, `dashboard.html`, `admin.html`
    still use the legacy hex/Bootstrap look. Pick one and migrate.

---

**End of product context.** If you (Claude or any other agent) are reading this,
you now have enough to navigate the codebase, answer questions about it, or make
targeted changes safely. When in doubt: the source of truth is `app.py`; the data
of truth is `combined_db.db`; the brand of truth is "PLUTO, helpful internal
buddy for PeopleLogic recruiters."
