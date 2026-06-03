# PLUTO documentation

All project documentation lives under `docs/`. Application code stays at the repo root (`app.py`, `pluto/`, `templates/`, `static/`).

## Start here

| Document | Audience |
|----------|----------|
| [product/PRODUCT_CONTEXT.md](product/PRODUCT_CONTEXT.md) | **Primary handoff** — product map, architecture, routes, landmines |
| [product/PRODUCT_DETAILS.md](product/PRODUCT_DETAILS.md) | Feature-level product reference |
| [.env.example](../.env.example) | Environment variables (secrets never in git) |

## Directory map

```
docs/
├── README.md                 ← this file
├── product/                  Product & handoff
├── architecture/             HLD / LLD
├── integrations/             External APIs (VoxPro, etc.)
├── design/                   Brand / UI audits
├── deployment/               Deploy, git push, server access notes
├── guides/                   How-tos (models, uploads, env)
├── changelog/                Sprint / release notes
├── archive/                  Older evaluations, roadmaps, backlog
└── prompts/                  JD / resume prompt experiments (not runtime)
```

## Quick links

| Topic | Path |
|-------|------|
| VoxPro call logs & recordings | [integrations/VOXPRO_API.md](integrations/VOXPRO_API.md) |
| Brand colours | [design/BRAND_COLOR_AUDIT.md](design/BRAND_COLOR_AUDIT.md) |
| Deploy | [deployment/DEPLOYMENT.md](deployment/DEPLOYMENT.md) |
| Git push | [deployment/GIT_PUSH_INSTRUCTIONS.md](deployment/GIT_PUSH_INSTRUCTIONS.md) |
| Model provider switching | [guides/MODEL_SWITCHING_GUIDE.md](guides/MODEL_SWITCHING_GUIDE.md) |
| Env setup | [guides/ENV_AND_MODELS.md](guides/ENV_AND_MODELS.md) |
| Upload behaviour | [guides/DOCUMENT_UPLOADS.md](guides/DOCUMENT_UPLOADS.md) |
| High-level design | [architecture/HLD.md](architecture/HLD.md) |
| Low-level design | [architecture/LLD.md](architecture/LLD.md) |
| Backlog ideas | [archive/BACKLOG.md](archive/BACKLOG.md) |
| v2 roadmap (historical) | [archive/PLUTO_V2_ROADMAP.md](archive/PLUTO_V2_ROADMAP.md) |

## Runtime folders (not documentation)

| Path | Purpose |
|------|---------|
| `HR_docs/` | HR policy PDFs for Info Buddy RAG |
| `uploads/` | Recruiter-uploaded resumes |
| `pluto/` | Python package (blueprints, routes, helpers) |
| `deploy_scripts/` | Server install / nginx scripts |
| `scripts/` | Maintenance utilities |
