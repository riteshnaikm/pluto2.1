# PLUTO / HR Assistant Suite — Product Details Document

> **Purpose of this document:** Give any AI assistant (e.g. Claude) full context on what this product is, who it serves, how it works, and how the codebase is organized — without needing to explore the repo first.

---

## 1. Executive Summary

**PLUTO™** (branded internally as **HR Assistant Suite** / **PeopleLogic AI Tools Hub**) is an **internal enterprise HR & recruiting SaaS-style web application** built for **PeopleLogic**. It helps recruiters and HR staff with:

1. **Info Buddy** — AI Q&A over company HR policy PDFs (RAG chatbot)
2. **Recruiter Co-Pilot** — Two sub-products on one page:
   - **Recruiter Handbook** — AI-generated recruiter playbooks from job descriptions
   - **MatchMaker** — AI resume evaluation against job descriptions with match scores, stability analysis, interview questions, and PDF export
3. **Analytics Dashboard** — Usage metrics, team filters, charts, CSV export
4. **History & Feedback** — Past evaluations, handbooks, and user ratings
5. **Admin Panel** — User/role/team management (Google OAuth users)

The product is a **monolithic Flask (Python) backend** with **server-rendered HTML templates + vanilla JavaScript** on the frontend. AI is powered by **multiple LLM providers** (Gemini, Groq, OpenAI/NVIDIA NIM) with **Pinecone** vector search and **BM25** hybrid retrieval for policy documents.

---

## 2. Product Identity & Branding

| Item | Value |
|------|--------|
| Product name | HR Assistant Suite / PeopleLogic AI Tools Hub |
| Mascot / AI persona | **PLUTO** (robot mascot, `plbot.png`) |
| Company | PeopleLogic |
| Primary users | Recruiters, HR, team leads, admins |
| Auth | Google OAuth 2.0 (Authlib) |
| Default port | `5000` (HTTP) |
| Database | SQLite (`combined_db.db`) |
| Policy documents folder | `HR_docs/` (PDFs indexed into Pinecone) |
| Resume uploads folder | `uploads/` |

**UI design language:** PeopleLogic brand colors — blue `#0d6fae`, green `#7d8e2c`, yellow `#f6c206`, orange `#e26014`. Modern cards, gradients, dark mode via `data-theme` + `localStorage`. Landing page (`index.html`) uses Inter font and oklch color tokens; copilot page (`index2.html`) is the main recruiter workspace.

---

## 3. Target Users & Roles

| Role | Capabilities |
|------|----------------|
| **Recruiter** | Default role. Create handbooks, evaluate resumes, view own team history |
| **Anchors** | Team-scoped visibility (same team data filtering) |
| **Business Manager** | Team-scoped visibility |
| **Admin** | Full user management, admin panel, broader analytics access |

**Teams (hardcoded):** `ITS`, `OSS`, `PCS`, `ISV`, `Core`

**Access control model:**
- Users authenticate via Google; email stored in `users` table
- Data (evaluations, handbooks) filtered by `user_email` and **team membership**
- `get_accessible_user_emails()` / `get_accessible_users()` enforce team-based visibility
- Routes use `@login_required` and `@role_required('Admin')` decorators
- Some API routes return JSON 401 for unauthenticated API calls (avoids HTML redirect breaking `fetch`)

---

## 4. Core Modules (Product Features)

### 4.1 Home / Tools Hub (`/` → `templates/index.html`)

- Standalone landing page (does **not** extend `base.html`)
- Two large cards: **Info Buddy** and **Recruiter Co-Pilot**
- PLUTO mascot with typing animation
- Theme toggle (light/dark)
- User profile menu → Dashboard, Admin (if Admin), Logout

### 4.2 Info Buddy — HR Policy Assistant (`/hr-assistant` → `templates/index1.html`)

**What it does:** Answers questions about company HR policies using **Retrieval-Augmented Generation (RAG)** over PDFs in `HR_docs/`.

**Two modes:**
| Mode | Behavior |
|------|----------|
| **Offline (default)** | Hybrid search: Pinecone vector similarity + BM25 keyword search → LLM answers **only from retrieved policy chunks** |
| **Online ("Go Online" toggle)** | General LLM knowledge; not restricted to HR docs |

**Features:**
- Streaming responses (SSE-style chunked text)
- Acronym expansion (`ACRONYM_MAP` — e.g. WFH → work from home policy)
- Special query handlers (e.g. holiday calendars, predefined tables)
- Star rating + text feedback stored in `qa_history` / `qa_feedback`
- Provider override via `INFO_BUDDY_MODEL_PROVIDER`, `INFO_BUDDY_GROQ_MODEL`

**Key API:** `POST /api/ask` — body: `{ question, online_mode }`

### 4.3 Recruiter Co-Pilot (`/resume-evaluator` → `templates/index2.html`)

Single page with **two sections** toggled via URL `?section=handbook` or `?section=matchmaker`:

#### A. Recruiter Handbook (`section=handbook`)

**What it does:** Takes a **Job Title**, **Job Description**, optional **Additional Context**, and optional **Oorwin Job ID** → generates a structured **Recruiter Playbook & Handbook** in Markdown.

**Handbook sections (AI-generated structure):**
- Title + Mini TOC
- Introduction
- Job Summary (4–5 sentences)
- Primary Sourcing Parameters (markdown table)
- Screening Framework (categorized questions)
- Target Talent Pools
- Red flags, sales pitch, closing checklist, etc.

**Features:**
- JD quality score widget (`POST /api/jd-quality-score`) — scores JD before/at generation
- Duplicate detection: if `oorwin_job_id` already has a handbook, returns existing one
- Markdown rendered in UI (marked.js + DOMPurify)
- PDF download (`POST /api/download-handbook-pdf`)
- AI summary generation (`POST /api/generate-handbook-summary`)
- Handbook feedback (1–5 stars + comments) → `handbook_feedback` table
- Auto-fill MatchMaker form from handbook data

**Key APIs:**
- `POST /api/generate-recruiter-handbook`
- `POST /api/generate-handbook-summary`
- `POST /api/jd-quality-score`
- `GET /api/get-job-ids`, `GET /api/get-job-data/<job_id>`
- `GET /api/handbook/<id>`, `GET /api/handbooks-only`

#### B. MatchMaker — Resume Evaluator (`section=matchmaker`)

**What it does:** Upload resume (PDF/DOC/DOCX) + job title/description → AI evaluation with structured output.

**Evaluation outputs:**
| Output | Description |
|--------|-------------|
| **Match %** | Overall JD match score |
| **Match factors** | Skills, experience, education, industry, certification breakdowns |
| **Profile summary** | Narrative recruiter summary |
| **Missing keywords** | Skills/terms not evidenced in resume |
| **Candidate fit analysis** | Dimension table, risks, recommendation, recruiter narrative |
| **Over/under qualification** | Mismatch analysis |
| **Job stability** | Tenure, job count, risk level, stability score |
| **Career progression** | Progression score, path, red flags |
| **Interview questions** | Quick checks, soft skills, technical (default templates + optional LLM generation) |
| **Contact info** | Extracted email, phone, LinkedIn from resume |

**Processing modes:**
- **Standard:** `POST /evaluate` — async; runs main LLM + stability + career in parallel (`asyncio.gather`) unless `FAST_EVAL_MODE=true`
- **Streaming UX:** `POST /evaluate-stream` — progress steps for UI
- **Batch:** `POST /evaluate-batch` — multiple resumes

**Performance options (env):**
- `FAST_EVAL_MODE` — skips extra LLM calls for stability/career (heuristic estimates)
- `EVALUATION_CACHE_ENABLED` — caches evaluations by content hash (TTL configurable)

**Key APIs:**
- `POST /evaluate`, `POST /evaluate-stream`, `POST /evaluate-batch`
- `GET /api/evaluation/<id>`, `GET /api/evaluation-full/<id>`
- `POST /api/generate_questions/<evaluation_id>`
- `POST /api/download-evaluation-pdf`
- `POST /api/feedback` (evaluation feedback)

### 4.4 History (`/history` → `templates/history.html`)

- Lists past **resume evaluations** and **recruiter handbooks**
- Filtered by accessible users/teams
- Job-centric view APIs: `/api/job-centric-history`, `/api/evaluations-by-job/<job_id>`, `/api/handbooks-by-job/<job_id>`
- Modal detail views for full evaluation/handbook content

### 4.5 Feedback History (`/feedback_history`)

- Aggregated user feedback on evaluations and handbooks
- APIs: `/api/feedback/all`, `/api/feedback/check/<type>/<id>`, `/api/feedback/handbook`

### 4.6 Analytics Dashboard (`/dashboard` → `templates/dashboard.html`)

**Metrics shown:**
- Total evaluations, handbooks, unique jobs (Oorwin Job ID)
- Average match score, conversion rate (handbook → evaluation)
- Active jobs (7-day window), avg eval/handbook generation time
- Period-over-period trends when date range selected

**Charts / tables (via API):**
- Timeline, team performance, match score distribution, user activity, recent activity, top jobs

**Features:**
- Filters: team, user, date range, quick 7D/30D/90D
- Auto-refresh toggle (30s)
- CSV export: `GET /api/analytics/export-csv`

### 4.7 Admin Panel (`/admin` → `templates/admin.html`)

- Admin-only (`@role_required('Admin')`)
- CRUD users: email, name, role, team, manager
- APIs: `/api/admin/users`, `/api/admin/teams`, `/api/admin/roles`, `/api/admin/accessible-users`
- Default admin seeded: `ritesh.m@peoplelogic.in` (Admin, Core team)

### 4.8 Evaluation Detail Page (`/evaluation/<eval_id>`)

- Standalone view for a single evaluation (`templates/evaluation_view.html`)

---

## 5. User Journeys (Flows)

### Journey 1: New recruiter evaluates a candidate
1. Login with Google → Home
2. Click **Recruiter Co-Pilot** → MatchMaker section
3. Enter Job ID (optional, pulls saved JD from Oorwin integration data)
4. Paste job title + description, upload resume PDF
5. Click **Evaluate Resume** → streaming status steps → results panel
6. Review match score dial, fit tables, interview questions
7. Submit star feedback → stored in DB
8. Download PDF report

### Journey 2: Recruiter creates handbook then evaluates
1. Co-Pilot → **Handbook** section
2. Enter JD → Generate Handbook → review markdown playbook
3. Switch to MatchMaker (auto-fill from handbook) → upload resume → evaluate

### Journey 3: HR employee asks policy question
1. Home → **Info Buddy**
2. Type question (e.g. "What is the leave policy?")
3. Receive streamed answer from HR PDFs
4. Rate helpfulness

### Journey 4: Manager reviews team usage
1. Profile menu → **Dashboard**
2. Filter by team + date range
3. Review metrics and export CSV

---

## 6. Technical Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Browser (HTML/CSS/JS)                        │
│  Bootstrap 5, Bootstrap Icons, marked.js, DOMPurify, Chart.js   │
└───────────────────────────────┬─────────────────────────────────┘
                                │ HTTP (REST + SSE streams)
┌───────────────────────────────▼─────────────────────────────────┐
│              Flask App (app.py) — WsgiToAsgi wrapper             │
│              Served by Hypercorn (run.py) on port 5000           │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────────────────────┐ │
│  │ Auth/OAuth  │ │ Route handlers│ │ PDF gen (ReportLab)     │ │
│  │ Session     │ │ (54 routes)  │ │ File extract (pdfplumber)│ │
│  └─────────────┘ └──────────────┘ └──────────────────────────┘ │
└───────┬─────────────────┬──────────────────┬──────────────────┘
        │                 │                  │
        ▼                 ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌───────────────────────────┐
│ SQLite DB    │  │ Pinecone     │  │ External LLM APIs           │
│ combined_db  │  │ Vector Index │  │ Gemini, Groq, OpenAI/NIM  │
│ .db          │  │ hr-knowledge │  │                           │
│              │  │ -base        │  │                           │
└──────────────┘  └──────────────┘  └───────────────────────────┘
                        ▲
                        │ Embeddings: sentence-transformers/
                        │           all-MiniLM-L6-v2 (384-dim)
                  ┌─────┴─────┐
                  │ HR_docs/  │
                  │ PDF files │
                  └───────────┘
```

**Startup sequence (`run.py`):**
1. `initialize_pinecone()` — ensure index exists
2. `build_bm25_index(hr_docs_path)` — build in-memory BM25 from PDF chunks
3. `setup_llm_chain()` — LangChain QA chain for Info Buddy
4. Hypercorn serves `asgi_app` (Flask wrapped via `asgiref.wsgi.WsgiToAsgi`)

**Important architectural note:** Almost all backend logic lives in a **single file `app.py` (~8,500 lines, ~400KB)**. This is the primary maintainability concern.

---

## 7. Technology Stack

### Backend
| Technology | Use |
|------------|-----|
| Python 3 | Runtime |
| Flask | Web framework, routing, sessions, templates |
| Hypercorn | ASGI server (with `lifespan=off` for Flask compatibility) |
| SQLite | Primary datastore |
| Authlib | Google OAuth |
| LangChain | Chains, text splitters, vector store wrappers |
| Pinecone | Vector database for HR doc search |
| rank_bm25 | Keyword search over policy chunks |
| sentence-transformers | Local embeddings (all-MiniLM-L6-v2) |
| pdfplumber, PyMuPDF, pytesseract | PDF/text extraction |
| python-docx | Word document parsing |
| ReportLab | PDF report generation |
| pandas, numpy, scikit-learn, nltk | Data/text processing |
| asyncio, aiohttp, ThreadPoolExecutor | Async LLM calls |

### Frontend
| Technology | Use |
|------------|-----|
| Jinja2 templates | Server-rendered HTML |
| Bootstrap 5.3 | Layout, components |
| Bootstrap Icons | Iconography |
| Vanilla JavaScript | All interactivity (no React/Vue) |
| marked.js | Markdown rendering |
| DOMPurify | HTML sanitization |
| Chart.js (dashboard) | Analytics charts |
| Google Fonts (Inter) | Typography on key pages |

### AI / LLM Providers (configurable per feature)
| Provider | Env key | Typical use |
|----------|---------|-------------|
| Google Gemini | `GEMINI_API_KEY` | Default for evaluations, handbooks |
| Groq | `GROQ_API_KEY` | Fast inference, handbook, Info Buddy |
| OpenAI / compatible | `OPENAI_API_KEY`, `OPENAI_BASE_URL` | GPT models or NVIDIA NIM fallback |

**Per-feature provider overrides:**
- `MODEL_PROVIDER` — global default
- `EVALUATION_MODEL_PROVIDER`, `EVALUATION_GROQ_MODEL`, etc.
- `HANDBOOK_MODEL_PROVIDER`, `HANDBOOK_GROQ_MODEL`
- `INFO_BUDDY_MODEL_PROVIDER`, `INFO_BUDDY_GROQ_MODEL`

Unified abstraction: `generate_content_unified()` routes to correct provider with fallback logic (e.g. Groq rate limit → NVIDIA Nemotron via `FALLBACK_OPENAI_MODEL`).

---

## 8. Database Schema (SQLite: `combined_db.db`)

### `users`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| email | TEXT UNIQUE | Google email |
| name | TEXT | |
| role | TEXT | Admin, Recruiter, etc. |
| team | TEXT | ITS, OSS, PCS, ISV, Core |
| manager_email | TEXT FK | |
| created_at, updated_at | DATETIME | |

### `evaluations`
Stores each resume evaluation.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| resume_path, filename | TEXT | |
| job_title, job_description | TEXT | |
| match_percentage | REAL | |
| match_factors, profile_summary, missing_keywords | TEXT (JSON) | |
| job_stability, career_progression | TEXT (JSON) | |
| technical/nontechnical/behavioral_questions | TEXT (JSON) | |
| oorwin_job_id | TEXT | ATS job reference |
| candidate_fit_analysis, over_under_qualification | TEXT (JSON) | |
| time_taken | REAL | Seconds |
| user_email | TEXT | Who ran it |
| timestamp | DATETIME | |

### `recruiter_handbooks`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| oorwin_job_id, job_title, job_description | TEXT | |
| additional_context | TEXT | |
| markdown_content | TEXT | Full handbook |
| time_taken, user_email | | |
| timestamp | DATETIME | |

### `interview_questions`
Linked to evaluation_id (legacy/separate storage).

### `feedback` / `handbook_feedback` / `qa_feedback`
User ratings (1–5) and comments. UNIQUE per evaluation/handbook/question.

### `qa_history`
Info Buddy Q&A log: question, retrieved_docs, final_answer.

**Schema migrations:** Done inline in `init_db()` via `PRAGMA table_info` + `ALTER TABLE` (no Alembic).

---

## 9. API Reference (Key Endpoints)

### Authentication
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/login` | No | Login page |
| GET | `/login/google` | No | OAuth redirect |
| GET | `/login/google/authorized` | No | OAuth callback |
| GET | `/logout` | No | Clear session |

### Pages (HTML)
| Path | Template | Description |
|------|----------|-------------|
| `/` | index.html | Home hub |
| `/hr-assistant` | index1.html | Info Buddy |
| `/resume-evaluator` | index2.html | Co-Pilot (handbook + matchmaker) |
| `/history` | history.html | History |
| `/feedback_history` | feedback_history.html | Feedback log |
| `/dashboard` | dashboard.html | Analytics |
| `/admin` | admin.html | User admin |

### Core APIs
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/ask` | Info Buddy Q&A (stream) |
| POST | `/api/generate-recruiter-handbook` | Generate handbook |
| POST | `/api/jd-quality-score` | Score JD quality |
| POST | `/evaluate` | Resume evaluation |
| POST | `/evaluate-stream` | Streaming evaluation |
| POST | `/evaluate-batch` | Batch evaluation |
| GET | `/api/evaluation/<id>` | Evaluation details |
| POST | `/api/generate_questions/<id>` | Regenerate interview Qs |
| POST | `/api/download-evaluation-pdf` | PDF export |
| POST | `/api/download-handbook-pdf` | Handbook PDF |
| GET | `/api/analytics/overview` | Dashboard metrics |
| GET | `/api/analytics/export-csv` | CSV export |
| POST | `/api/feedback` | Evaluation feedback |
| POST | `/api/feedback/handbook` | Handbook feedback |
| GET/POST/DELETE | `/api/admin/users` | User management |

---

## 10. AI / Prompting Strategy

### Resume evaluation (`input_prompt_template` in app.py)
- Acts as **senior recruiter with 30+ years experience**
- **Not** an ATS keyword scanner — requires evidence-based reasoning
- Distinguishes matched vs missing vs equivalent skills
- Returns structured JSON: JD Match %, MissingKeywords, Profile Summary, Match Factors, Candidate Fit Analysis, Over/UnderQualification, Reasoning

### Recruiter handbook (`handbook_prompt`)
- Long, prescriptive prompt defining exact section order and markdown table formats
- Mimics example playbooks (Fractal, Jubilant Ingrevia style)
- Enforces GitHub-flavored markdown tables for sourcing parameters

### Info Buddy RAG
1. Expand acronyms
2. Hybrid retrieve (vector k=15 + BM25 top 10)
3. Deduplicate; prioritize table chunks for tabular queries
4. LLM answers with retrieved context only (offline mode)

---

## 11. Configuration (Environment Variables)

Key variables in `.env` (see `.env.example`, `docs/guides/ENV_AND_MODELS.md`, `docs/guides/MODEL_SWITCHING_GUIDE.md`):

```bash
# Required
GROQ_API_KEY=
PINECONE_API_KEY=
GEMINI_API_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
FLASK_SECRET_KEY=

# Model selection
MODEL_PROVIDER=gemini          # gemini | openai | groq
GEMINI_MODEL=gemini-2.5-flash
GROQ_MODEL=openai/gpt-oss-120b
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
OPENAI_BASE_URL=               # For NVIDIA NIM etc.
FALLBACK_OPENAI_MODEL=nvidia/nemotron-3-nano-30b-a3b

# Per-feature overrides
EVALUATION_MODEL_PROVIDER=
HANDBOOK_MODEL_PROVIDER=groq
INFO_BUDDY_MODEL_PROVIDER=

# Performance
FAST_EVAL_MODE=false
EVALUATION_CACHE_ENABLED=true
EVALUATION_CACHE_TTL_SECONDS=1800
GROQ_MAX_COMPLETION_TOKENS=2048
```

---

## 12. Repository Structure

```
pluto2-main/
├── app.py                    # Monolithic backend (~8500 lines) — ALL routes & logic
├── run.py                    # Dev/production server entry (Hypercorn)
├── run_production.py         # Production variant
├── combined_db.db            # SQLite database
├── requirements.txt          # Python dependencies
├── .env                      # Secrets (DO NOT COMMIT)
│
├── templates/                # Jinja2 HTML
│   ├── base.html             # Layout: navbar, sidebar, theme, profile
│   ├── index.html            # Home hub (standalone)
│   ├── index1.html           # Info Buddy
│   ├── index2.html           # Recruiter Co-Pilot (~1500 lines)
│   ├── dashboard.html        # Analytics (~1700 lines)
│   ├── history.html
│   ├── login.html
│   └── admin.html
│
├── static/
│   ├── css/                  # style.css, pluto-handbook-*.css
│   ├── js/
│   │   ├── resume-evaluator.js   # Main copilot logic (~3400 lines)
│   │   ├── pluto-handbook-result.js
│   │   └── pluto-handbook-ui.js
│   └── *.png                 # Logos, PLUTO mascot
│
├── HR_docs/                  # HR policy PDFs (indexed to Pinecone)
├── uploads/                  # Uploaded resumes
├── docs/
│   ├── HLD.md                # High-level design
│   └── LLD.md                # Low-level design
│
├── deploy_scripts/           # Deployment helpers
├── migrate_database.py       # DB migration script
└── verify_before_deploy.py   # Pre-deploy checks
```

---

## 13. Deployment

- **Local (Windows):** `python run.py` → `http://127.0.0.1:5000`
- **Production (Linux):** binds `0.0.0.0:5000`
- Server: **Hypercorn** (async ASGI wrapper over sync Flask)
- Docs: `docs/deployment/DEPLOYMENT.md`, `deploy_scripts/`
- HTTPS: Currently disabled (HTTP only per `run.py` comments)

**External services required at runtime:**
- Pinecone account + index `hr-knowledge-base` (384 dimensions, cosine)
- At least one LLM API key (Gemini/Groq/OpenAI)
- Google OAuth credentials
- Optional: LibreOffice for legacy `.doc` conversion

---

## 14. Integrations & External Systems

| System | Integration |
|--------|-------------|
| **Google OAuth** | User authentication |
| **Oorwin (ATS)** | Job ID field (`oorwin_job_id`) — APIs load job data by ID (`/api/get-job-ids`, `/api/get-job-data/<id>`) |
| **Pinecone** | Vector store for HR policies |
| **Gemini / Groq / OpenAI** | LLM inference |

---

## 15. Security Considerations (Current State)

| Area | Status |
|------|--------|
| Authentication | Google OAuth + Flask sessions |
| Authorization | Role + team-based filtering |
| CSRF | **Not implemented** on forms/APIs |
| Rate limiting | LLM provider rate limits only; no app-level limiter |
| File uploads | Extension whitelist (pdf, doc, docx); `secure_filename` |
| Secrets | `.env` file (must not be committed) |
| Error responses | Some analytics endpoints return full traceback in JSON (500) |
| Default secret | Fallback `SECRET_KEY` in code if env missing — **unsafe for production** |

---

## 16. Known Limitations & Technical Debt

1. **Monolithic `app.py`** — 54 routes, 112+ functions, hard to test and maintain
2. **SQLite** — not ideal for concurrent multi-user production; docs mention PostgreSQL migration
3. **No frontend framework** — large inline CSS/JS in templates; `resume-evaluator.js` is 3400+ lines
4. **Duplicate templates** — `index copy.html`, `index2.html.backup`, multiple `index*.html` variants
5. **Heavy assets in repo** — multiple 1.8MB PNG logos, screenshot artifacts (`mp43*.png/html`)
6. **Synchronous DB** — new `sqlite3.connect()` per request (54+ connection sites)
7. **Mixed async/sync** — some routes `async def` on Flask (works via ASGI but unconventional)
8. **Incomplete route protection** — some endpoints (e.g. `/api/ask`, `/feedback_history`) lack `@login_required`
9. **Documentation drift** — HLD mentions only Gemini; codebase supports 3+ providers

---

## 17. Glossary

| Term | Meaning |
|------|---------|
| **PLUTO** | AI mascot / brand for the assistant |
| **Info Buddy** | HR policy Q&A chatbot |
| **MatchMaker** | Resume vs JD evaluation module |
| **Recruiter Handbook** | AI-generated recruiter playbook from JD |
| **Oorwin Job ID** | External ATS job reference number |
| **RAG** | Retrieval-Augmented Generation |
| **BM25** | Keyword-based ranking for document search |
| **JD** | Job Description |
| **Co-Pilot** | Umbrella name for Handbook + MatchMaker on one page |

---

## 18. Quick Reference for AI Assistants

**If asked to add a feature:**
- Backend changes almost certainly go in `app.py`
- Frontend for copilot → `templates/index2.html` + `static/js/resume-evaluator.js`
- New pages should extend `templates/base.html` for consistent nav/sidebar
- DB changes → `init_db()` + inline ALTER pattern
- New LLM calls → use `generate_content_unified()` with appropriate provider override

**If asked about deployment:**
- See `run.py`, `docs/deployment/DEPLOYMENT.md`, `requirements.txt`
- Index HR PDFs: startup builds BM25 + Pinecone from `HR_docs/`

**If asked about models:**
- See `docs/guides/MODEL_SWITCHING_GUIDE.md`, `docs/archive/IMPLEMENTATION_NOTES.md`
- Each feature can use different provider via env vars

---

*Document version: 1.0 — Generated from codebase analysis of pluto2-main (May 2026)*
