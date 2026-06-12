# Release history — PLUTO

**Purpose:** A **dated record** of what went live and what was removed or deprecated. Use this for product reviews, demos, and “what changed since …?”

**Format:** Inspired by [Keep a Changelog](https://keepachangelog.com/). Categories:

- **Added** — new capability
- **Changed** — behaviour change (non-breaking)
- **Fixed** — bug fixes
- **Removed** — capability taken out
- **Deprecated** — still works but planned removal

**Not the same as:**

- **Backlog** ([BACKLOG.md](BACKLOG.md)) — future ideas
- **PRODUCT_CONTEXT.md** — current system truth for developers
- **docs/changelog/SPRINT_ABC_CHANGELOG.md** — engineering sprint notes (implementation detail)

When something ships, add a dated section here **in the same work** (or ask the agent: “log this in RELEASES”).

---

## [Unreleased]

### Added

- **Client call Records** on handbook intake — dropdown loads PeopleLogic Recorder transcripts from GCS (`pl-recorder/{folderId}/transcripts/*.json`); optional link feeds the handbook LLM prompt. APIs: `GET /api/client-call-records`, `GET /api/client-call-records/detail`. Module: `pluto/gcs_transcripts.py`.

### Changed

- **Recruiter Handbook intake:** Removed section 6 (Sign-off & SPOC) from the intake form; AM contact fields no longer required. Generated handbook prompt no longer includes sign-off / SPOC probes.

---

## 2026-05-20 — Call Analysis (beta) & VoxPro pipeline

### Added

- **VoxPro integration** (`pluto/voxpro/`): log pull, recording download, merge/transcribe (Groq Whisper), LLM call analysis, SQLite tables (`voxpro_calls`, `call_transcripts`, `candidate_call_analyses`).
- **APIs:** `POST /api/voxpro/calls/fetch`, `POST /api/voxpro/calls/analyze`, `GET /api/voxpro/calls?phone=`.
- **Call Analysis page** at `/call-analysis` — phone intake, progress steps, results on same page (timeline, markdown report, full transcript). Hub + Co-Pilot sidebar entry.
- **Docs:** `docs/integrations/VOXPRO_API.md`; env vars in `.env.example` / `ENV_AND_MODELS.md`.

### Changed

- MatchMaker: VoxPro inline UI replaced with link to Call Analysis (beta).
- Job History: standalone VoxPro card removed; use Call Analysis module.
- Pipeline API returns `merged_transcript` for full transcript display.

### Removed

- *(none — features relocated, not deleted)*

---

## 2026-05 (earlier) — Docs reorganisation & Co-Pilot

### Added

- `docs/` layout (product, integrations, deployment, guides, design, architecture).
- Cursor rule: documentation maintenance (`.cursor/rules/documentation-maintenance.mdc`).
- Batch resume comparison, brand tokens, blueprint/route split (see `docs/changelog/SPRINT_ABC_CHANGELOG.md` for engineering detail).

### Changed

- Root `README.md` points to `docs/README.md`.

---

## How to log the next release

1. Pick a **date** (deploy date or merge date).
2. Copy the template below under a new `## YYYY-MM-DD — Short title` heading.
3. Move matching backlog IDs to **Done** in [BACKLOG.md](BACKLOG.md).

```markdown
## YYYY-MM-DD — Short title

### Added
- …

### Changed
- …

### Fixed
- …

### Removed
- …

### Deprecated
- …
```
