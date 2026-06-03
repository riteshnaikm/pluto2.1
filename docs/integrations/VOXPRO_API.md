# VoxPro API — Access & Recording Guide

**Audience:** Engineers and AI assistants working in this repository.

**Purpose:** Document how to retrieve call logs from the PeopleLogic **VoxPro** telephony system and how to download the associated **WAV** call recordings. This is the source of truth for any Pluto integration that analyzes recruiter–candidate phone conversations.

**Status:** API behavior and recording URLs were confirmed against live data (HTTP 200 on sample `.wav`). **Pluto app integration is not implemented yet** — no `pluto/voxpro/` module or routes in production. This file is the contract for future work.

---

## 1. System context

| Item | Detail |
|------|--------|
| Product | **VoxPro** — internal PBX/VoIP used by recruiters at PeopleLogic |
| Host | `office.peoplelogic.in` |
| Use in Pluto | Fetch all calls for a candidate phone number → download recordings → transcribe → merge → AI call analysis (see product discussions; implementation lives under `pluto/voxpro/` when added) |
| Network | Pluto (or any client) must run on a network that can reach `http://office.peoplelogic.in` (VPN/LAN). No HTTPS in current deployment. |

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
| `dur` | Duration in **seconds** as string; **`""` (empty) if NOT CONNECTED** |
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
| `status` is `"NOT CONNECTED"` | `dur` is usually `""`; recording may exist but often skip for transcription |
| `rec_fname` or `rec_location` empty | Do not build URL |
| HTTP non-200 on `.wav` | Log and skip that call; do not fail entire batch |
| Very large date ranges | `log_pull` may return many rows — chunk by month or cap lookback (e.g. 90 days) |

---

## 4. Recommended workflow for Pluto (multi-call merge)

For a single candidate phone number:

1. **Normalize phone** — digits only; use **10-digit** form for the API (e.g. `9599015158`).
2. **log_pull** with `from`, `to`, and `phone` (omit `status` if the UI needs missed calls too).
3. **Sort** results by `datetime` ascending.
4. **Dedupe** in database on `slno`.
5. **Download** `.wav` for each `CONNECTED` call with valid `rec_fname` / `rec_location`.
6. **Transcribe** each file; **merge** transcripts with headers (datetime, `email_id`, `callmethod`, `dur`).
7. **Analyze** merged text with the LLM; optionally link to `evaluations` / `recruiter_handbooks` via `oorwin_job_id`.

Multiple recordings for the same `phone` are expected (callbacks, different agents, incoming vs outgoing). Treat them as one timeline, not separate candidates.

---

## 5. Live data observations

- `dur` is an **empty string** (not `"0"`) when `status` is `"NOT CONNECTED"`.
- INCOMING not connected may have `dest_type: "Time_condition"` (routing rule before agent).
- INCOMING connected calls may show `dur: "0"` or a positive value; may include `did`.
- The same `phone` can appear with **multiple** `email_id` values across calls.
- Authentication is **not** documented on these endpoints — access is effectively **internal network trust**. Do not expose VoxPro URLs on the public internet without a gateway.

---

## 6. Environment variables (Pluto integration)

When implemented in code, prefer configuration over hardcoding:

```env
VOXPRO_LOG_PULL_URL=http://office.peoplelogic.in/Voxpro/api/log_pull
VOXPRO_OFFICE_BASE=http://office.peoplelogic.in
VOXPRO_LOOKBACK_DAYS=90
```

---

## 7. Related repository files

| Path | Role |
|------|------|
| `docs/integrations/VOXPRO_API.md` | This document — API contract |
| `docs/product/PRODUCT_CONTEXT.md` | Overall Pluto product map |
| `pluto/voxpro/` | (When added) Python client, ingest, analysis |
| `app.py` / `pluto/blueprints/pluto_api.py` | (When added) HTTP routes for fetch/analyze |

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
