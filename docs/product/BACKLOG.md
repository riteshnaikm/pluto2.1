# Product backlog — PLUTO

**Purpose:** Capture ideas and requests **before** implementation. Sharing something here (or in chat with “add to backlog”) does **not** mean we build it immediately.

**How to add items:** Tell the agent *“add to backlog: …”* or edit this file. The agent should append/update here and **not** start coding unless you say *“implement”*, *“pick this up”*, or *“this sprint”*.

**Related files:**

| File | Role |
|------|------|
| [BACKLOG.md](BACKLOG.md) (this file) | Ideas, priorities, status — **future** work |
| [RELEASES.md](RELEASES.md) | What **shipped** or **removed**, by date |
| [PRODUCT_CONTEXT.md](PRODUCT_CONTEXT.md) | How the product works **today** (routes, schema, landmines) |
| [PRODUCT_OPS.md](PRODUCT_OPS.md) | PM practices (sprints, changelog, when to use what) |

---

## Status legend

| Status | Meaning |
|--------|---------|
| **Idea** | Captured; not refined |
| **Ready** | Clear enough to estimate / schedule |
| **In sprint** | Committed for current sprint |
| **Done** | Shipped — move summary to [RELEASES.md](RELEASES.md) and mark Done here or remove |
| **Won't do** | Declined; keep one-line reason |

**Priority (optional):** P0 = urgent/blocking · P1 = next · P2 = soon · P3 = nice-to-have

---

## Current sprint

*No formal sprint active. When you start one, name it (e.g. `Sprint 2026-W21`) and list IDs below.*

| ID | Title | Owner | Target |
|----|-------|-------|--------|
| — | — | — | — |

---

## Backlog

### Call analysis & VoxPro

| ID | Item | Priority | Status | Notes |
|----|------|----------|--------|-------|
| CA-1 | Merge Call Analysis into MatchMaker results (after beta sign-off) | P1 | Idea | User confirmed `/call-analysis` works; placement TBD |
| CA-2 | Show call analysis on Job History (per job / per candidate) | P2 | Idea | May combine with CA-1 |
| CA-3 | Auto-run VoxPro when phone entered on MatchMaker | P3 | Idea | Deferred; explicit submit on beta page for now |
| CA-4 | Job History modal: call badge / link to latest analysis | P2 | Idea | |
| CA-5 | Combine call report + handbook + resume eval in one “candidate dossier” | P2 | Idea | Product design needed |
| CA-6 | Oorwin job picker on Call Analysis — live API dropdown + ad-hoc “fresh call” context | P2 | Idea | See notes below |

**CA-6 (draft):** Fetch job code + job title from **Oorwin API** (not only local Pluto history). Recruiter chooses **existing job** from dropdown *or* **“job not in Oorwin yet”** path with free-text fields (client, role, notes — TBD) so fresh client calls can still be found later. Store link on `candidate_call_analyses` / `voxpro_calls`. Reuse pattern in handbook/MatchMaker intake if desired.

### Resume evaluation & handbook

| ID | Item | Priority | Status | Notes |
|----|------|----------|--------|-------|
| RE-1 | Remove candidate email & mobile from resume processing (PII hygiene) | P1 | Idea | From legacy backlog |
| RE-2 | Download PDF for resume evaluation | P2 | Idea | Handbook PDF exists |
| RE-3 | One handbook per Job ID — show existing instead of duplicate | P1 | Idea | |
| RE-4 | Dashboard: avg time to generate handbook & evaluation | P3 | Idea | Verify if partially done |
| RE-5 | Generation time &lt; 20s (handbook + eval) | P2 | Idea | Performance goal |

### Platform & docs

| ID | Item | Priority | Status | Notes |
|----|------|----------|--------|-------|
| PL-1 | Continue route/blueprint split (`app.py` → `pluto/routes`) | P3 | Idea | See sprint changelog in `docs/changelog/` |

---

## Done (recent — details in RELEASES)

| ID | Shipped | Release ref |
|----|---------|-------------|
| CA-0 | VoxPro pipeline + `/call-analysis` beta page | [RELEASES.md](RELEASES.md) — 2026-05-20 |

---

## Changelog for this file

| Date | Change |
|------|--------|
| 2026-05-20 | Created active backlog; migrated ideas from `docs/archive/BACKLOG.md` |
