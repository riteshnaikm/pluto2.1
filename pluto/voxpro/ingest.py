"""Fetch VoxPro logs and download call recordings."""

from __future__ import annotations

import logging
import os
from pathlib import Path

import requests

from pluto.db import connect_db
from pluto.voxpro.client import (
    dur_has_recording,
    log_pull,
    normalize_phone,
    parse_dur_seconds,
    recording_url,
)
from pluto.voxpro.config import (
    CALLS_UPLOAD_SUBDIR,
    VOXPRO_LOOKBACK_DAYS,
    VOXPRO_MIN_DUR_SECONDS,
    VOXPRO_OFFICE_BASE,
)
from pluto.voxpro.db import init_voxpro_tables, update_call_download, upsert_call_row

logger = logging.getLogger(__name__)


def calls_upload_dir(upload_root: str) -> Path:
    path = Path(upload_root) / CALLS_UPLOAD_SUBDIR
    path.mkdir(parents=True, exist_ok=True)
    return path


def fetch_and_ingest(
    phone: str,
    *,
    upload_root: str,
    from_dt: str | None = None,
    to_dt: str | None = None,
    lookback_days: int | None = None,
    download: bool = True,
) -> dict:
    """
    Pull logs for phone, upsert DB rows, optionally download WAVs.
    Returns summary dict for API response.
    """
    phone_norm = normalize_phone(phone)
    lookback = lookback_days if lookback_days is not None else VOXPRO_LOOKBACK_DAYS
    rows = log_pull(
        phone=phone_norm,
        from_dt=from_dt,
        to_dt=to_dt,
        lookback_days=lookback,
    )
    rows_sorted = sorted(rows, key=lambda r: r.get("datetime") or "")
    rows_for_analysis = [r for r in rows_sorted if dur_has_recording(r.get("dur"))]
    rows_excluded = len(rows_sorted) - len(rows_for_analysis)

    conn = connect_db()
    cur = conn.cursor()
    init_voxpro_tables(cur)

    for row in rows_sorted:
        upsert_call_row(cur, phone_norm, row, base_url=VOXPRO_OFFICE_BASE)
    conn.commit()

    downloaded = skipped = failed = skipped_short = 0
    call_dir = calls_upload_dir(upload_root) if download else None

    for row in rows_sorted:
        slno = str(row.get("slno") or "").strip()
        if not slno:
            continue
        if not dur_has_recording(row.get("dur")):
            reason = (
                "skipped_short_dur"
                if parse_dur_seconds(row.get("dur")) is not None
                else "skipped_no_dur"
            )
            update_call_download(cur, slno, None, reason)
            skipped += 1
            if reason == "skipped_short_dur":
                skipped_short += 1
            continue
        url = recording_url(
            VOXPRO_OFFICE_BASE, row.get("rec_location"), row.get("rec_fname")
        )
        if not url:
            update_call_download(cur, slno, None, "skipped_no_path")
            skipped += 1
            continue
        if not download:
            continue
        local_path = call_dir / f"{slno}.wav"
        try:
            resp = requests.get(url, timeout=120)
            if resp.status_code != 200 or resp.content[:4] != b"RIFF":
                update_call_download(cur, slno, None, f"http_{resp.status_code}")
                failed += 1
                continue
            local_path.write_bytes(resp.content)
            update_call_download(cur, slno, str(local_path), "ok")
            downloaded += 1
        except requests.RequestException as exc:
            logger.warning("VoxPro download failed slno=%s: %s", slno, exc)
            update_call_download(cur, slno, None, "error")
            failed += 1

    conn.commit()
    conn.close()

    return {
        "phone": phone_norm,
        "total_logs_fetched": len(rows_sorted),
        "total_logs": len(rows_for_analysis),
        "excluded_below_min_dur": rows_excluded,
        "min_dur_seconds": VOXPRO_MIN_DUR_SECONDS,
        "dur_filter_note": (
            f"Showing calls with duration > {VOXPRO_MIN_DUR_SECONDS} seconds only"
        ),
        "downloaded": downloaded,
        "skipped": skipped,
        "skipped_short_dur": skipped_short,
        "failed": failed,
        "calls": [
            {
                "slno": r.get("slno"),
                "datetime": r.get("datetime"),
                "status": r.get("status"),
                "dur": r.get("dur"),
                "dur_seconds": parse_dur_seconds(r.get("dur")),
                "email_id": r.get("email_id"),
                "callmethod": r.get("callmethod"),
                "has_recording": True,
                "recording_url": recording_url(
                    VOXPRO_OFFICE_BASE, r.get("rec_location"), r.get("rec_fname")
                ),
            }
            for r in rows_for_analysis
        ],
    }
