# PLUTO documentation

All project documentation lives under `docs/`. Application code stays at the repo root (`app.py`, `pluto/`, `templates/`, `static/`).

**Last doc review:** May 2026 (aligned with repo reorganisation, batch eval, brand tokens, Hypercorn deploy).

## Documentation maintenance (team rule)

Enforced in all Cursor chats via `.cursor/rules/documentation-maintenance.mdc` (`alwaysApply: true`).

When code, APIs, or behaviour change:

1. **Update all affected docs** in `docs/` (not only `PRODUCT_CONTEXT.md`). Typical mapping:
   - API / integrations → `docs/integrations/`
   - Deploy / git → `docs/deployment/`
   - Env / models → `docs/guides/`
   - UI / brand → `docs/design/`
   - Architecture overview → `docs/architecture/` (if behaviour shifts)
   - Product flows / routes / schema → `docs/product/PRODUCT_CONTEXT.md`
2. **Ask the user before large doc edits** if scope is unclear (new feature vs tweak, or which doc is authoritative).
3. **Do not edit `docs/archive/`** unless archiving something intentionally historical.
4. After VoxPro or similar integration work, update `docs/integrations/VOXPRO_API.md` and cross-links in `PRODUCT_CONTEXT.md`.

| Doc type | Trust level |
|----------|-------------|
| [product/PRODUCT_CONTEXT.md](product/PRODUCT_CONTEXT.md) | **Highest** — routes, schema, landmines |
| [architecture/HLD.md](architecture/HLD.md), [LLD.md](architecture/LLD.md) | Overview; LLD may lag `app.py` |
| [archive/](archive/) | Historical — roadmap, old audits |

## Start here

| Document | Audience |
|----------|----------|
| [product/PRODUCT_CONTEXT.md](product/PRODUCT_CONTEXT.md) | **Primary handoff** — product map, architecture, routes, landmines |
| [product/PRODUCT_DETAILS.md](product/PRODUCT_DETAILS.md) | Feature-level product reference |
| [product/BACKLOG.md](product/BACKLOG.md) | **Product backlog** — ideas & priorities (not auto-implemented) |
| [product/RELEASES.md](product/RELEASES.md) | **Release history** — shipped / removed by date |
| [product/PRODUCT_OPS.md](product/PRODUCT_OPS.md) | PM playbook — sprints, backlog vs changelog |
| [.env.example](../.env.example) | Environment variables (secrets never in git) |

## Directory map

```
docs/
├── README.md                 ← this file
├── product/                  Product & handoff (BACKLOG, RELEASES, PRODUCT_OPS)
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
| Product backlog (active) | [product/BACKLOG.md](product/BACKLOG.md) |
| Release history | [product/RELEASES.md](product/RELEASES.md) |
| PM practices | [product/PRODUCT_OPS.md](product/PRODUCT_OPS.md) |
| Backlog (legacy) | [archive/BACKLOG.md](archive/BACKLOG.md) |
| v2 roadmap (historical) | [archive/PLUTO_V2_ROADMAP.md](archive/PLUTO_V2_ROADMAP.md) |

## Runtime folders (not documentation)

| Path | Purpose |
|------|---------|
| `HR_docs/` | HR policy PDFs for Info Buddy RAG |
| `uploads/` | Recruiter-uploaded resumes |
| `pluto/` | Python package (blueprints, routes, helpers) |
| `deploy_scripts/` | Server install / nginx scripts |
| `scripts/` | Maintenance utilities |
