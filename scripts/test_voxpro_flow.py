#!/usr/bin/env python3
"""Smoke test: VoxPro log_pull by phone → build recording URLs → download WAV."""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timedelta

import requests

DEFAULT_BASE = os.getenv("VOXPRO_OFFICE_BASE", "http://office.peoplelogic.in")
DEFAULT_LOG_URL = os.getenv(
    "VOXPRO_LOG_PULL_URL", f"{DEFAULT_BASE.rstrip('/')}/Voxpro/api/log_pull"
)


def normalize_phone(phone: str) -> str:
    digits = "".join(c for c in phone if c.isdigit())
    if len(digits) > 10 and digits.startswith("91"):
        digits = digits[-10:]
    return digits[-10:] if len(digits) >= 10 else digits


def dur_has_recording(dur) -> bool:
    """Non-empty numeric ``dur`` → call had duration → recording expected."""
    s = str(dur).strip() if dur is not None else ""
    if not s:
        return False
    try:
        return float(s) >= 0
    except ValueError:
        return False


def recording_url(base: str, rec_location: str, rec_fname: str) -> str | None:
    loc = (rec_location or "").strip().strip("/")
    fname = (rec_fname or "").strip()
    if not loc or not fname:
        return None
    return f"{base.rstrip('/')}/{loc}/{fname}.wav"


def log_pull(
    *,
    phone: str,
    from_dt: str,
    to_dt: str,
    status: str | None = None,
    log_url: str = DEFAULT_LOG_URL,
) -> list[dict]:
    payload = {"from": from_dt, "to": to_dt, "phone": phone}
    if status:
        payload["status"] = status
    resp = requests.request("GET", log_url, json=payload, timeout=60)
    resp.raise_for_status()
    data = resp.json()
    if not isinstance(data, list):
        raise ValueError(f"Expected JSON array, got {type(data).__name__}")
    return data


def fetch_recording(url: str) -> tuple[bool, int, str, int]:
    resp = requests.get(url, timeout=120)
    ok = resp.status_code == 200 and len(resp.content) >= 12 and resp.content[:4] == b"RIFF"
    ctype = resp.headers.get("Content-Type", "")
    return ok, len(resp.content), ctype, resp.status_code


def main() -> int:
    parser = argparse.ArgumentParser(description="Test VoxPro phone → logs → recordings")
    parser.add_argument("phone", nargs="?", default="9599015158", help="10-digit phone")
    parser.add_argument("--days", type=int, default=365, help="Lookback days")
    parser.add_argument("--download", type=int, default=2, help="Max WAVs to download (0=skip)")
    parser.add_argument("--status", default=None, help="CONNECTED or NOT CONNECTED")
    args = parser.parse_args()

    phone = normalize_phone(args.phone)
    to_dt = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    from_dt = (datetime.now() - timedelta(days=args.days)).strftime("%Y-%m-%d %H:%M:%S")

    print("=" * 60)
    print("STEP 1: log_pull with phone filter")
    print("=" * 60)
    print(f"URL:   {DEFAULT_LOG_URL}")
    print(f"Phone: {phone}")
    print(f"Range: {from_dt}  ->  {to_dt}")
    if args.status:
        print(f"Status filter: {args.status}")

    try:
        calls = log_pull(phone=phone, from_dt=from_dt, to_dt=to_dt, status=args.status)
    except requests.RequestException as exc:
        print(f"FAILED: {exc}")
        return 1

    print(f"HTTP OK — {len(calls)} entries for this number\n")

    print("=" * 60)
    print("STEP 2: Log entries + recording URLs")
    print("=" * 60)
    for i, c in enumerate(sorted(calls, key=lambda x: x.get("datetime", "")), 1):
        url = recording_url(DEFAULT_BASE, c.get("rec_location"), c.get("rec_fname"))
        dur = c.get("dur") or "-"
        print(
            f"{i:2}. {c.get('datetime')} | {c.get('status', ''):14} | "
            f"{c.get('callmethod', ''):8} | dur={dur:>4} | {c.get('email_id')}"
        )
        print(f"    slno={c.get('slno')}  rec_fname={c.get('rec_fname') or '(none)'}")
        if url:
            print(f"    recording: {url}")
        print()

    if args.download <= 0:
        return 0

    candidates = [
        c
        for c in calls
        if c.get("rec_fname")
        and c.get("rec_location")
        and dur_has_recording(c.get("dur"))
        and (args.status is None or c.get("status") == "CONNECTED")
    ]

    # Newest first — older logs may point to deleted files (HTTP 404)
    candidates = sorted(candidates, key=lambda x: x.get("datetime", ""), reverse=True)

    print("=" * 60)
    print(f"STEP 3: Download up to {args.download} valid recording(s)")
    print("=" * 60)

    ok = fail = 0
    tried = 0
    for c in candidates:
        if ok >= args.download:
            break
        url = recording_url(DEFAULT_BASE, c["rec_location"], c["rec_fname"])
        assert url
        tried += 1
        print(f"slno={c['slno']} {c['datetime']} ...")
        try:
            success, size, ctype, status = fetch_recording(url)
        except requests.RequestException as exc:
            print(f"  FAIL request error: {exc}")
            fail += 1
            continue
        if success:
            print(f"  OK  HTTP {status}  {size:,} bytes  Content-Type={ctype}")
            ok += 1
        else:
            print(f"  SKIP  HTTP {status}  (file missing or not WAV — log may outlive recording)")
            fail += 1

    print()
    print(f"Done: {len(calls)} log rows, tried {tried} URL(s), {ok} valid WAV(s)")
    return 0 if ok > 0 else 2


if __name__ == "__main__":
    sys.exit(main())
