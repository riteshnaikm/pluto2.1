# PLUTO — High-Level Design (HLD)

> **Status:** Overview document. For accurate routes, schema, and landmines use **[../product/PRODUCT_CONTEXT.md](../product/PRODUCT_CONTEXT.md)**.  
> **Last reviewed:** May 2026

## 1. System overview

**PLUTO** (HR Assistant Suite) is an internal PeopleLogic web app for:

- **Info Buddy** — RAG chat over HR policy PDFs (`HR_docs/`)
- **Recruiter Co-Pilot** — Recruiter Handbook + MatchMaker (resume vs JD)
- **Job History** — Past handbooks and evaluations (job-centric)
- **Analytics Dashboard** — Usage KPIs and CSV export
- **Admin** — Roles and teams

Auth: Google OAuth. Data: SQLite (`combined_db.db`). Server: **Hypercorn** + Flask ASGI (`run.py`).

## 2. Architecture

### 2.1 Layers

| Layer | Technology |
|-------|------------|
| Presentation | Jinja2 templates, Bootstrap 5, vanilla JS (`static/js/`) |
| Application | Flask (`app.py`) + `pluto/` blueprints |
| AI / retrieval | Gemini / Groq / OpenAI (unified generator), Pinecone + BM25 |
| Data | SQLite, file uploads in `uploads/` |

### 2.2 Component diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser (Bootstrap 5)                    │
│  Hub │ Info Buddy │ Co-Pilot │ History │ Dashboard │ Admin   │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTP(S)
┌────────────────────────────▼────────────────────────────────┐
│              Hypercorn → WsgiToAsgi(Flask app)               │
│  OAuth │ CSRF (partial) │ Rate limits │ Page + API routes    │
└─────┬──────────────────────┬────────────────────────────────┘
      │                      │
┌─────▼──────┐    ┌──────────▼──────────────────────────────┐
│ SQLite     │    │ LLM + RAG                                    │
│ evaluations│    │  • MatchMaker / Handbook / Info Buddy        │
│ handbooks  │    │  • Pinecone + BM25 + embeddings              │
│ qa_history │    │  • ReportLab PDFs                            │
└────────────┘    └──────────┬──────────────────────────────────┘
                             │
              ┌──────────────┼──────────────┐
              │ Oorwin ATS   │ VoxPro (API  │
              │ (job JD)     │  documented; │
              │              │  not in app) │
              └──────────────┴──────────────┘
```

### 2.3 Key components

| Component | Responsibility |
|-----------|----------------|
| MatchMaker | Resume vs JD; stream (`/evaluate-stream`) or batch (`/evaluate-batch`) |
| Recruiter Handbook | JD → markdown handbook; SSE stream primary |
| Info Buddy | `/api/ask` hybrid retrieval + LLM answer |
| History | `/history` + `/api/job-centric-history` |
| Analytics | Dashboard charts + export |
| VoxPro (planned) | Call logs + recordings — see [../integrations/VOXPRO_API.md](../integrations/VOXPRO_API.md) |

## 3. Data flows (summary)

### Resume evaluation (single)

Upload → text extract (PDF/DOC/OCR) → parallel LLM (match, stability, career) → save `evaluations` → UI + optional PDF.

### Resume evaluation (batch)

Multiple files → compare → one `batch_group_id` → one row per resume (`evaluation_mode=batch`).

### Handbook

JD (+ optional Oorwin ID) → stream or sync LLM → `recruiter_handbooks` → render + PDF.

### History

Job-centric grouping by `oorwin_job_id`; per-job evaluation list via API modal.

## 4. External integrations

| System | Use |
|--------|-----|
| Google OAuth | Login |
| Gemini / Groq / OpenAI | LLM |
| Pinecone | HR policy vectors |
| Oorwin | Job ID → JD |
| VoxPro | Telephony logs/recordings (integration spec only) |

## 5. Security (summary)

- Session-based auth; team-scoped data via `get_accessible_user_emails()`
- Secrets in `.env` only; `.gitignore` excludes DB and uploads
- CSRF and rate limiting on selected endpoints — see PRODUCT_CONTEXT §12 for gaps

## 6. Further reading

- [../product/PRODUCT_CONTEXT.md](../product/PRODUCT_CONTEXT.md) — routes, schema, flows
- [LLD.md](LLD.md) — table sketches (partial; may lag schema)
- [../design/BRAND_COLOR_AUDIT.md](../design/BRAND_COLOR_AUDIT.md) — UI palette
