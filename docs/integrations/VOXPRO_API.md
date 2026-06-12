# VoxPro API — Access & Recording Guide

**Audience:** Engineers and AI assistants working in this repository.

**Purpose:** Document how to retrieve call logs from the PeopleLogic **VoxPro** telephony system and how to download the associated **WAV** call recordings. This is the source of truth for any Pluto integration that analyzes recruiter–candidate phone conversations.

**Status:** API behavior and recording URLs confirmed on live data. **Pluto integration implemented** in `pluto/voxpro/` with HTTP routes under `/api/voxpro/calls/*`. This file remains the external API contract; pipeline details below.

---

## 1. System context

| Item | Detail |
|------|--------|
| Product | **VoxPro** — internal PBX/VoIP used by recruiters at PeopleLogic |
| Host | `office.peoplelogic.in` |
| Use in Pluto | Fetch all calls for a candidate phone number → download recordings → transcribe → merge → AI call analysis (see product discussions; implementation lives under `pluto/voxpro/` when added) |
| Network | Pluto (or any client) must run on a network that can reach `http://office.peoplelogic.in` (VPN/LAN). No HTTPS in current deployment. |

### Troubleshooting: HTTP 404 with “Access Denied”

If `log_pull` returns **404** and the body is HTML `<b>Access Denied</b>` (Apache), the URL is correct but your **client IP is blocked**. This is not a Pluto bug.

| Check | Action |
|-------|--------|
| VPN / office LAN | Connect to PeopleLogic VPN or run Pluto on a server inside the office network |
| Smoke test | `python scripts/test_voxpro_flow.py 9599015158 --days 30` — expect HTTP 200 and a JSON array |
| Wrong symptom | True “not found” would differ; live failures observed are **Access Denied** on all path variants |

Pluto maps this to a clear API error (`503`) for the Call Analysis UI.

---

## 2. Call log API — `log_pull`

### Endpoint

| Property | Value |
|----------|--------|
| **URL** | `http://office.peoplelogic.in/Voxpro/api/log_pull` |
| **Method** | `GET` |
| **Header** | `Content-Type: application/json` |
| **Body** | JSON (sent with the GET request — non-standard; clients must not strip the body) |

Postman uses `disableBodyPruning: true` for this reason. In code, use an HTTP library that allows a JSON body on GET (e.g. Python `requests.request("GET", url, json=payload)`).

### Request body

```json
{
  "from": "2025-11-22 15:19:09",
  "to": "2026-01-20 15:19:10",
  "phone": "9599015158",
  "status": "CONNECTED"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `from` | string | **Yes** | Range start. Format: `YYYY-MM-DD HH:MM:SS` |
| `to` | string | **Yes** | Range end. Same format as `from` |
| `phone` | string | No | **10-digit** mobile number (no country code in samples). Filters calls where the number appears in **`src` or `dst`** |
| `status` | string | No | `"CONNECTED"` or `"NOT CONNECTED"`. Omit to return **all** statuses |

### Phone filter behavior (important)

When `phone` is set, VoxPro returns the candidate’s **full history** for that number:

- **OUTGOING** — agent extension in `src` (e.g. `"362"`), customer number in `dst`
- **INCOMING** — customer number in `src`, agent extension in `dst`

So one `phone` query returns both directions and all agents who called that number within the date range. Pluto should **not** pull the entire company log and filter locally — always pass `phone` for candidate-centric workflows.

### Example request (curl)

curl does not reliably send a body with GET. Prefer Python or Postman. Example with Python:

```python
import requests

url = "http://office.peoplelogic.in/Voxpro/api/log_pull"
payload = {
    "from": "2025-11-01 00:00:00",
    "to": "2026-05-20 23:59:59",
    "phone": "9599015158",
}
resp = requests.request("GET", url, json=payload, timeout=60)
resp.raise_for_status()
calls = resp.json()  # list of dicts
```

### Response

- **HTTP status:** `200 OK`
- **Body:** JSON **array** of call objects (may be empty `[]`)

#### Sample record

```json
{
  "slno": "2741533",
  "datetime": "2026-01-08 15:46:46",
  "email_id": "suriya.e@peoplelogic.in",
  "src": "362",
  "dst": "9599015158",
  "dest_type": "",
  "did": "",
  "dur": "161",
  "callmethod": "OUTGOING",
  "rec_fname": "2026-01-08_15:46:46_362_9599015158",
  "rec_location": "MUSIC/2026/01/08",
  "status": "CONNECTED",
  "dtmf": "",
  "MRD_NUM": ""
}
```

#### Field reference

| Field | Description |
|-------|-------------|
| `slno` | Unique call ID — use for deduplication in Pluto DB |
| `datetime` | Call timestamp `YYYY-MM-DD HH:MM:SS` |
| `email_id` | Agent email (maps to Pluto `users.email`) |
| `src` | Source: extension (outgoing) or customer number (incoming) |
| `dst` | Destination: customer number (outgoing) or extension (incoming) |
| `dest_type` | e.g. `"Extension"`, `"Time_condition"`, or `""` |
| `did` | DID for incoming routing; often empty on outgoing |
| `dur` | Duration in **seconds** as string (e.g. `"161"`, `"0"`). **`""` (empty) = no connected talk time → treat as no recording for Pluto** (see §2.1) |
| `callmethod` | `"OUTGOING"` or `"INCOMING"` |
| `rec_fname` | Recording base name **without** `.wav` extension |
| `rec_location` | Folder path under the office host (e.g. `MUSIC/2026/01/08`) |
| `status` | `"CONNECTED"` or `"NOT CONNECTED"` |
| `dtmf` | DTMF digits if any; usually empty |
| `MRD_NUM` | Internal reference; usually empty |

#### `rec_fname` naming pattern

```
{datetime}_{extension}_{phone}   # typical OUTGOING (includes agent extension)
{datetime}_{phone}               # some INCOMING (customer number only, no extension in name)
```

Examples:

- Outgoing: `2026-01-08_15:46:46_362_9599015158`
- Incoming: `2026-01-08_15:46:33_9599015158`

URL construction is the same in all cases (see §3).

### 2.1 `dur` — fetch vs analyze

**VoxPro API:** `log_pull` returns **all** call rows for the phone in the date range. There is **no server-side filter** on `dur`. Pluto filters locally after the response.

**Pluto rule (default `VOXPRO_MIN_DUR_SECONDS=5`):**

| `dur` | Pluto behaviour |
|-------|-----------------|
| `""` (empty) | Skip — no connected talk time |
| `"0"` … `"5"` | Stored in DB for audit; **not** downloaded, transcribed, or shown in Call Analysis UI |
| `">5"` (e.g. `"8"`, `"161"`) | Download WAV, merge/STT, LLM analysis, show in UI |

```python
# pluto/voxpro/client.py — duration strictly greater than 5 seconds
dur_meets_minimum(dur)  # alias: dur_has_recording(dur)
```

**Caveats (still verify with HTTP):**

1. **Retention** — Old rows can have `dur` set but the `.wav` file returns **404** (file deleted, log kept). Always handle failed downloads.
2. **Rare edge case** — Some `NOT CONNECTED` rows have `dur=""` but a WAV file still exists on disk. Pluto skips those for candidate analysis.
3. **Tune threshold** — Set `VOXPRO_MIN_DUR_SECONDS` in `.env` if product wants a different cutoff.

Call Analysis UI copy: *“Showing calls with duration > 5 seconds only.”*

---

## 3. Call recordings — download URL

Recordings are **not** returned in the `log_pull` JSON. They are separate **WAV** files on the same host.

### URL format (confirmed)

```
http://office.peoplelogic.in/{rec_location}/{rec_fname}.wav
```

| Part | Source |
|------|--------|
| Base | `http://office.peoplelogic.in` |
| Path | `rec_location` from log row (no leading slash) |
| File | `rec_fname` + `.wav` |

### Construction (pseudo-code)

```text
base = "http://office.peoplelogic.in"
url  = base + "/" + rec_location.strip("/") + "/" + rec_fname + ".wav"
```

### Worked example

From the sample record above:

```text
rec_location = MUSIC/2026/01/08
rec_fname    = 2026-01-08_15:46:46_362_9599015158

→ http://office.peoplelogic.in/MUSIC/2026/01/08/2026-01-08_15:46:46_362_9599015158.wav
```

Confirmed: `GET` that URL returns **200 OK** with WAV audio binary.

### Example download (Python)

```python
import requests

def voxpro_recording_url(rec_location: str, rec_fname: str) -> str:
    base = "http://office.peoplelogic.in"
    loc = rec_location.strip("/")
    return f"{base}/{loc}/{rec_fname}.wav"

url = voxpro_recording_url("MUSIC/2026/01/08", "2026-01-08_15:46:46_362_9599015158")
r = requests.get(url, timeout=120)
r.raise_for_status()
with open("call_2741533.wav", "wb") as f:
    f.write(r.content)
```

### When a recording may be missing or useless

| Condition | Guidance |
|-----------|----------|
| `dur` is `""` | **Skip** — no recording to analyze (primary gate) |
| `dur` is numeric but HTTP **404** | Log row only; file purged — skip |
| `rec_fname` or `rec_location` empty | Do not build URL |
| HTTP non-200 on `.wav` | Log and skip that call; do not fail entire batch |
| Very large date ranges | `log_pull` may return many rows — chunk by month or cap lookback (e.g. 90 days) |

---

## 4. Pluto pipeline (implemented)

For a single candidate phone number, `pluto.voxpro.pipeline.run_call_analysis()`:

1. **Normalize phone** — 10-digit form for `log_pull`.
2. **log_pull** + upsert `voxpro_calls` (dedupe on `slno`).
3. **Download** WAVs where `dur > VOXPRO_MIN_DUR_SECONDS` (default 5) → `uploads/calls/{slno}.wav`.
4. **Merge audio** (primary) — pydub + **ffmpeg** → `merged_{phone}_{batch}.wav`; skip if over size/duration caps.
5. **Speech-to-text** — Groq Whisper primary; Gemini fallback; per-call STT if merge/STT fails.
6. **LLM analysis** — `generate_content_unified()` → JSON + markdown in `candidate_call_analyses`.

### HTTP routes (login required)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/voxpro/calls/fetch` | Ingest logs; optional download only |
| POST | `/api/voxpro/calls/analyze` | Full pipeline (rate limit 3/min) |
| GET | `/api/voxpro/calls?phone=` | Cached calls + latest analysis |

### System dependencies

- Python: `pydub` (see `requirements.txt`)
- OS: **ffmpeg** on PATH (`sudo apt install ffmpeg` on Linux)

### Smoke test

```bash
python scripts/test_voxpro_flow.py 9599015158 --download 2
```

---

## 5. Live data observations

- `dur` is an **empty string** (not `"0"`) when `status` is `"NOT CONNECTED"`.
- INCOMING not connected may have `dest_type: "Time_condition"` (routing rule before agent).
- INCOMING connected calls may show `dur: "0"` or a positive value; may include `did`.
- The same `phone` can appear with **multiple** `email_id` values across calls.
- Authentication is **not** documented on these endpoints — access is effectively **internal network trust**. Do not expose VoxPro URLs on the public internet without a gateway.

---

## 6. Environment variables (Pluto)

See `.env.example` and [../guides/ENV_AND_MODELS.md](../guides/ENV_AND_MODELS.md).

---

## 7. Related repository files

| Path | Role |
|------|------|
| `docs/integrations/VOXPRO_API.md` | This document |
| `pluto/voxpro/` | Client, ingest, merge, transcribe, analyze, pipeline |
| `pluto/routes/voxpro_views.py` | Flask handlers |
| `pluto/blueprints/pluto_api.py` | Route registration |
| `templates/call_analysis.html` | Dedicated beta page (`/call-analysis`) |
| `static/js/call-analysis-page.js` | Call Analysis page UI |
| `static/js/voxpro-calls.js` | Legacy inline UI (unused; kept for reference) |
| `scripts/test_voxpro_flow.py` | Log pull + download smoke test |

If this document and the code disagree, **verify against VoxPro live behavior** and update this file.

---

## 8. Quick reference card

```text
LOGS:
  GET http://office.peoplelogic.in/Voxpro/api/log_pull
  Body: { "from": "...", "to": "...", "phone": "10digits", "status": optional }

RECORDING:
  http://office.peoplelogic.in/{rec_location}/{rec_fname}.wav

DEDUPE KEY: slno
MERGE KEY:  phone (10-digit) + optional job/candidate link in Pluto
```

---

*Last updated from confirmed integration findings (log_pull + WAV URL 200 OK).*
