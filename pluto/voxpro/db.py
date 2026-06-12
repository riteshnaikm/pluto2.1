"""SQLite persistence for VoxPro calls and analyses."""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime

from pluto.db import connect_db


def init_voxpro_tables(cursor: sqlite3.Cursor) -> None:
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS voxpro_calls (
            slno TEXT PRIMARY KEY,
            phone_normalized TEXT NOT NULL,
            datetime TEXT,
            email_id TEXT,
            src TEXT,
            dst TEXT,
            dest_type TEXT,
            did TEXT,
            dur TEXT,
            callmethod TEXT,
            rec_fname TEXT,
            rec_location TEXT,
            status TEXT,
            dtmf TEXT,
            mrd_num TEXT,
            recording_url TEXT,
            local_path TEXT,
            download_status TEXT,
            raw_json TEXT,
            ingested_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS call_transcripts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            slno TEXT NOT NULL,
            phone_normalized TEXT NOT NULL,
            transcript_text TEXT,
            engine TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(slno),
            FOREIGN KEY (slno) REFERENCES voxpro_calls (slno)
        )
        """
    )
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS candidate_call_analyses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phone_normalized TEXT NOT NULL,
            oorwin_job_id TEXT,
            evaluation_id INTEGER,
            handbook_id INTEGER,
            call_count INTEGER DEFAULT 0,
            date_from TEXT,
            date_to TEXT,
            merged_transcript TEXT,
            merged_wav_path TEXT,
            stt_method TEXT,
            analysis_json TEXT,
            analysis_markdown TEXT,
            time_taken REAL,
            user_email TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_voxpro_calls_phone ON voxpro_calls(phone_normalized)"
    )
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_voxpro_calls_datetime ON voxpro_calls(datetime)"
    )
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_call_analyses_phone ON candidate_call_analyses(phone_normalized)"
    )


def upsert_call_row(cursor: sqlite3.Cursor, phone: str, row: dict, *, base_url: str) -> None:
    from pluto.voxpro.client import recording_url

    slno = str(row.get("slno") or "").strip()
    if not slno:
        return
    url = recording_url(base_url, row.get("rec_location"), row.get("rec_fname"))
    cursor.execute(
        """
        INSERT INTO voxpro_calls (
            slno, phone_normalized, datetime, email_id, src, dst, dest_type, did, dur,
            callmethod, rec_fname, rec_location, status, dtmf, mrd_num,
            recording_url, raw_json, ingested_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(slno) DO UPDATE SET
            phone_normalized=excluded.phone_normalized,
            datetime=excluded.datetime,
            email_id=excluded.email_id,
            src=excluded.src,
            dst=excluded.dst,
            dest_type=excluded.dest_type,
            did=excluded.did,
            dur=excluded.dur,
            callmethod=excluded.callmethod,
            rec_fname=excluded.rec_fname,
            rec_location=excluded.rec_location,
            status=excluded.status,
            dtmf=excluded.dtmf,
            mrd_num=excluded.mrd_num,
            recording_url=excluded.recording_url,
            raw_json=excluded.raw_json,
            ingested_at=excluded.ingested_at
        """,
        (
            slno,
            phone,
            row.get("datetime"),
            row.get("email_id"),
            row.get("src"),
            row.get("dst"),
            row.get("dest_type"),
            row.get("did"),
            row.get("dur"),
            row.get("callmethod"),
            row.get("rec_fname"),
            row.get("rec_location"),
            row.get("status"),
            row.get("dtmf"),
            row.get("MRD_NUM") or row.get("mrd_num"),
            url,
            json.dumps(row),
            datetime.utcnow().isoformat(),
        ),
    )


def update_call_download(
    cursor: sqlite3.Cursor, slno: str, local_path: str | None, status: str
) -> None:
    cursor.execute(
        """
        UPDATE voxpro_calls
        SET local_path = ?, download_status = ?
        WHERE slno = ?
        """,
        (local_path, status, slno),
    )


def save_call_transcript(
    cursor: sqlite3.Cursor, *, slno: str, phone: str, text: str, engine: str
) -> None:
    cursor.execute(
        """
        INSERT INTO call_transcripts (slno, phone_normalized, transcript_text, engine)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(slno) DO UPDATE SET
            transcript_text=excluded.transcript_text,
            engine=excluded.engine,
            created_at=CURRENT_TIMESTAMP
        """,
        (slno, phone, text, engine),
    )


def save_call_analysis(
    cursor: sqlite3.Cursor,
    *,
    phone: str,
    merged_transcript: str,
    analysis_json: dict,
    analysis_markdown: str,
    call_count: int,
    stt_method: str,
    merged_wav_path: str | None,
    user_email: str | None,
    oorwin_job_id: str | None = None,
    evaluation_id: int | None = None,
    handbook_id: int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    time_taken: float | None = None,
) -> int:
    cursor.execute(
        """
        INSERT INTO candidate_call_analyses (
            phone_normalized, oorwin_job_id, evaluation_id, handbook_id,
            call_count, date_from, date_to, merged_transcript, merged_wav_path,
            stt_method, analysis_json, analysis_markdown, time_taken, user_email,
            updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            phone,
            oorwin_job_id,
            evaluation_id,
            handbook_id,
            call_count,
            date_from,
            date_to,
            merged_transcript,
            merged_wav_path,
            stt_method,
            json.dumps(analysis_json),
            analysis_markdown,
            time_taken,
            user_email,
            datetime.utcnow().isoformat(),
        ),
    )
    return cursor.lastrowid


def get_calls_for_phone(phone: str) -> list[dict]:
    conn = connect_db()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute(
        """
        SELECT * FROM voxpro_calls
        WHERE phone_normalized = ?
        ORDER BY datetime ASC
        """,
        (phone,),
    )
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows


def get_latest_analysis(phone: str) -> dict | None:
    conn = connect_db()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute(
        """
        SELECT * FROM candidate_call_analyses
        WHERE phone_normalized = ?
        ORDER BY id DESC LIMIT 1
        """,
        (phone,),
    )
    row = cur.fetchone()
    conn.close()
    if not row:
        return None
    d = dict(row)
    if d.get("analysis_json"):
        try:
            d["analysis_json"] = json.loads(d["analysis_json"])
        except json.JSONDecodeError:
            pass
    return d


def get_downloaded_calls_for_phone(phone: str) -> list[dict]:
    from pluto.voxpro.client import dur_has_recording

    rows = get_calls_for_phone(phone)
    return [
        r
        for r in rows
        if r.get("download_status") == "ok"
        and r.get("local_path")
        and dur_has_recording(r.get("dur"))
    ]


def get_transcripts_for_slnos(
    cursor: sqlite3.Cursor, slnos: list[str]
) -> dict[str, str]:
    if not slnos:
        return {}
    placeholders = ",".join("?" * len(slnos))
    cursor.execute(
        f"""
        SELECT slno, transcript_text FROM call_transcripts
        WHERE slno IN ({placeholders}) AND transcript_text IS NOT NULL
        """,
        slnos,
    )
    return {
        str(row[0]): row[1]
        for row in cursor.fetchall()
        if row[1] and str(row[1]).strip()
    }
