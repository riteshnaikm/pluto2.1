"""Orchestrate VoxPro fetch → merge → STT → LLM analysis."""

from __future__ import annotations

import json
import logging
import sqlite3
import time
import uuid
from pathlib import Path

from pluto.db import connect_db
from pluto.voxpro.analyze import analyze_transcript
from pluto.voxpro.audio_merge import merge_wav_files
from pluto.voxpro.client import (
    estimate_audio_seconds,
    filter_calls_for_analysis,
    normalize_phone,
    select_calls_within_dur_budget,
)
from pluto.voxpro.config import (
    VOXPRO_LOOKBACK_DAYS,
    VOXPRO_MIN_DUR_SECONDS,
    VOXPRO_STT_MAX_TOTAL_DUR_SECONDS,
)
from pluto.voxpro.db import (
    get_downloaded_calls_for_phone,
    get_transcripts_for_slnos,
    save_call_analysis,
    save_call_transcript,
)
from pluto.voxpro.ingest import fetch_and_ingest
from pluto.voxpro.transcribe import transcribe_calls

logger = logging.getLogger(__name__)


def _load_job_context(
    cursor: sqlite3.Cursor,
    *,
    evaluation_id: int | None,
    handbook_id: int | None,
    oorwin_job_id: str | None,
) -> dict:
    ctx = {
        "job_description": None,
        "resume_summary": None,
        "handbook_excerpt": None,
    }
    if evaluation_id:
        cursor.execute(
            """
            SELECT job_description, profile_summary, job_title, match_percentage
            FROM evaluations WHERE id = ?
            """,
            (evaluation_id,),
        )
        row = cursor.fetchone()
        if row:
            ctx["job_description"] = row[0]
            ctx["resume_summary"] = (
                f"Job: {row[2]} | Match: {row[3]}%\n{row[1] or ''}"
            )
    if handbook_id:
        cursor.execute(
            "SELECT job_description, markdown_content FROM recruiter_handbooks WHERE id = ?",
            (handbook_id,),
        )
        row = cursor.fetchone()
        if row:
            if not ctx["job_description"]:
                ctx["job_description"] = row[0]
            content = row[1] or ""
            ctx["handbook_excerpt"] = content[:6000]
    if oorwin_job_id and not ctx["job_description"]:
        cursor.execute(
            """
            SELECT job_description, markdown_content FROM recruiter_handbooks
            WHERE oorwin_job_id = ? ORDER BY id DESC LIMIT 1
            """,
            (oorwin_job_id,),
        )
        row = cursor.fetchone()
        if row:
            ctx["job_description"] = row[0]
            ctx["handbook_excerpt"] = (row[1] or "")[:6000]
    return ctx


def run_call_analysis(
    phone: str,
    *,
    upload_root: str,
    user_email: str | None = None,
    download: bool = True,
    lookback_days: int | None = None,
    oorwin_job_id: str | None = None,
    evaluation_id: int | None = None,
    handbook_id: int | None = None,
) -> dict:
    """Full pipeline. Returns API-shaped result dict."""
    t0 = time.time()
    phone_norm = normalize_phone(phone)
    lookback = lookback_days if lookback_days is not None else VOXPRO_LOOKBACK_DAYS

    ingest_summary = fetch_and_ingest(
        phone_norm,
        upload_root=upload_root,
        lookback_days=lookback,
        download=download,
    )

    calls = get_downloaded_calls_for_phone(phone_norm)
    eligible = filter_calls_for_analysis(calls)
    if not eligible:
        return {
            "success": False,
            "error": (
                f"No recordings with duration > {VOXPRO_MIN_DUR_SECONDS}s for this number "
                "(check VoxPro logs, VPN, and min duration filter)."
            ),
            "ingest": ingest_summary,
        }

    stt_calls, _ = select_calls_within_dur_budget(
        eligible, VOXPRO_STT_MAX_TOTAL_DUR_SECONDS
    )
    stt_estimated_sec = estimate_audio_seconds(stt_calls)
    if len(stt_calls) < len(eligible):
        logger.info(
            "STT budget: using %s of %s calls (~%.0fs of ~%.0fs dur)",
            len(stt_calls),
            len(eligible),
            stt_estimated_sec,
            estimate_audio_seconds(eligible),
        )

    paths = []
    for c in sorted(stt_calls, key=lambda x: x.get("datetime") or ""):
        p = Path(c["local_path"])
        if p.exists():
            paths.append(p)

    batch_id = uuid.uuid4().hex[:12]
    merged_path = Path(upload_root) / "calls" / f"merged_{phone_norm}_{batch_id}.wav"
    merged_wav, skip_reason = merge_wav_files(paths, merged_path)
    if skip_reason:
        logger.info("Audio merge skipped: %s", skip_reason)
        merged_wav = None

    conn = connect_db()
    cur = conn.cursor()
    slnos = [str(c["slno"]) for c in stt_calls if c.get("slno")]
    cached = get_transcripts_for_slnos(cur, slnos)

    def _persist_transcript(*, slno: str, phone: str | None, text: str, engine: str) -> None:
        save_call_transcript(
            cur, slno=slno, phone=phone or phone_norm, text=text, engine=engine
        )

    transcript, stt_method = transcribe_calls(
        stt_calls,
        merged_wav=merged_wav,
        cached_transcripts=cached,
        save_transcript=_persist_transcript,
    )
    conn.commit()

    ctx = _load_job_context(
        cur,
        evaluation_id=evaluation_id,
        handbook_id=handbook_id,
        oorwin_job_id=oorwin_job_id,
    )
    metadata = {
        "phone": phone_norm,
        "call_count": len(stt_calls),
        "calls_eligible": len(eligible),
        "stt_estimated_audio_seconds": round(stt_estimated_sec, 1),
        "recruiters": list({c.get("email_id") for c in stt_calls if c.get("email_id")}),
        "date_range": {
            "first": stt_calls[0].get("datetime") if stt_calls else None,
            "last": stt_calls[-1].get("datetime") if stt_calls else None,
        },
    }

    analysis_json, analysis_md, analysis_time = analyze_transcript(
        transcript,
        job_description=ctx.get("job_description"),
        resume_summary=ctx.get("resume_summary"),
        handbook_excerpt=ctx.get("handbook_excerpt"),
        metadata=metadata,
    )

    analysis_id = save_call_analysis(
        cur,
        phone=phone_norm,
        merged_transcript=transcript,
        analysis_json=analysis_json,
        analysis_markdown=analysis_md,
        call_count=len(stt_calls),
        stt_method=stt_method,
        merged_wav_path=str(merged_wav) if merged_wav else None,
        user_email=user_email,
        oorwin_job_id=oorwin_job_id,
        evaluation_id=evaluation_id,
        handbook_id=handbook_id,
        date_from=metadata["date_range"].get("first"),
        date_to=metadata["date_range"].get("last"),
        time_taken=time.time() - t0,
    )
    conn.commit()
    conn.close()

    return {
        "success": True,
        "analysis_id": analysis_id,
        "phone": phone_norm,
        "call_count": len(stt_calls),
        "calls_eligible": len(eligible),
        "stt_estimated_audio_seconds": round(stt_estimated_sec, 1),
        "stt_budget_applied": VOXPRO_STT_MAX_TOTAL_DUR_SECONDS > 0,
        "min_dur_seconds": VOXPRO_MIN_DUR_SECONDS,
        "dur_filter_note": ingest_summary.get("dur_filter_note"),
        "total_logs_fetched": ingest_summary.get("total_logs_fetched"),
        "excluded_below_min_dur": ingest_summary.get("excluded_below_min_dur"),
        "stt_method": stt_method,
        "merged_wav_path": str(merged_wav) if merged_wav else None,
        "merge_skipped": skip_reason,
        "time_taken": round(time.time() - t0, 2),
        "analysis_time": round(analysis_time, 2),
        "ingest": ingest_summary,
        "analysis": analysis_json,
        "analysis_markdown": analysis_md,
        "transcript_preview": transcript[:1500] + ("…" if len(transcript) > 1500 else ""),
        "merged_transcript": transcript,
    }
