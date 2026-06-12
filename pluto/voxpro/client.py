"""VoxPro log_pull API client."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

import requests

from pluto.voxpro.config import VOXPRO_LOG_PULL_URL, VOXPRO_MIN_DUR_SECONDS

logger = logging.getLogger(__name__)


class VoxProAccessError(ConnectionError):
    """VoxPro host reachable but API blocked (VPN / IP allowlist)."""


class VoxProHTTPError(ConnectionError):
    """VoxPro HTTP failure with a recruiter-safe message."""


def _raise_for_voxpro_response(resp: requests.Response) -> None:
    if resp.ok:
        return
    body_l = (resp.text or "").lower()
    if resp.status_code in (403, 404) and "access denied" in body_l:
        raise VoxProAccessError(
            "VoxPro returned Access Denied. Connect to the PeopleLogic office network "
            "or VPN (office.peoplelogic.in is not available from the public internet), "
            "then run call analysis again."
        )
    raise VoxProHTTPError(
        f"VoxPro log_pull failed (HTTP {resp.status_code}). "
        f"Check VOXPRO_LOG_PULL_URL and network access."
    )


def normalize_phone(phone: str) -> str:
    digits = "".join(c for c in (phone or "") if c.isdigit())
    if len(digits) > 10 and digits.startswith("91"):
        digits = digits[-10:]
    if len(digits) < 10:
        raise ValueError("Phone number must be at least 10 digits")
    return digits[-10:]


def parse_dur_seconds(dur) -> float | None:
    """VoxPro ``dur`` is duration in seconds as a string (e.g. ``"161"``). Empty = no talk time."""
    s = str(dur).strip() if dur is not None else ""
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def dur_meets_minimum(
    dur, min_seconds: int | None = None, *, strict: bool = True
) -> bool:
    """
    True when call had connected talk time **longer than** ``min_seconds`` (default 5).

    Empty ``dur`` → False (no recording). Zero-second connects → False.
    """
    threshold = VOXPRO_MIN_DUR_SECONDS if min_seconds is None else min_seconds
    seconds = parse_dur_seconds(dur)
    if seconds is None:
        return False
    if strict:
        return seconds > threshold
    return seconds >= threshold


def dur_has_recording(dur) -> bool:
    """Alias: qualifies for download / STT (same as ``dur_meets_minimum``)."""
    return dur_meets_minimum(dur)


def filter_calls_for_analysis(calls: list[dict]) -> list[dict]:
    """Downloaded calls that pass the minimum ``dur`` threshold."""
    return [c for c in calls if dur_has_recording(c.get("dur"))]


def estimate_audio_seconds(calls: list[dict]) -> float:
    """Sum of VoxPro ``dur`` fields (seconds) for budgeting Groq STT."""
    total = 0.0
    for c in calls:
        sec = parse_dur_seconds(c.get("dur"))
        if sec is not None:
            total += sec
    return total


def select_calls_within_dur_budget(
    calls: list[dict], max_seconds: int, *, newest_first: bool = True
) -> tuple[list[dict], float]:
    """
    Subset of calls whose combined ``dur`` does not exceed ``max_seconds``.
    Default: newest calls first (most relevant for recruiters).
    """
    if max_seconds <= 0:
        return list(calls), estimate_audio_seconds(calls)

    ordered = sorted(
        calls,
        key=lambda c: c.get("datetime") or "",
        reverse=newest_first,
    )
    selected: list[dict] = []
    total = 0.0
    for c in ordered:
        sec = parse_dur_seconds(c.get("dur")) or 0.0
        if total + sec > max_seconds:
            if not selected:
                selected.append(c)
            break
        selected.append(c)
        total += sec

    selected = sorted(selected, key=lambda c: c.get("datetime") or "")
    return selected, total


def recording_url(base: str, rec_location: str, rec_fname: str) -> str | None:
    loc = (rec_location or "").strip().strip("/")
    fname = (rec_fname or "").strip()
    if not loc or not fname:
        return None
    return f"{base.rstrip('/')}/{loc}/{fname}.wav"


def default_date_range(lookback_days: int | None = None) -> tuple[str, str]:
    days = lookback_days if lookback_days is not None else 365
    to_dt = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    from_dt = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d %H:%M:%S")
    return from_dt, to_dt


def log_pull(
    *,
    phone: str,
    from_dt: str | None = None,
    to_dt: str | None = None,
    status: str | None = None,
    lookback_days: int | None = None,
    log_url: str = VOXPRO_LOG_PULL_URL,
) -> list[dict]:
    phone_norm = normalize_phone(phone)
    if not from_dt or not to_dt:
        from_dt, to_dt = default_date_range(lookback_days)

    payload: dict = {"from": from_dt, "to": to_dt, "phone": phone_norm}
    if status:
        payload["status"] = status

    logger.info("VoxPro log_pull phone=%s from=%s to=%s", phone_norm, from_dt, to_dt)
    try:
        resp = requests.request("GET", log_url, json=payload, timeout=60)
    except requests.RequestException as exc:
        raise VoxProAccessError(
            "Could not reach VoxPro (network error). Confirm VPN/office network "
            f"and that {log_url.split('/')[2]} is reachable."
        ) from exc
    _raise_for_voxpro_response(resp)
    data = resp.json()
    if not isinstance(data, list):
        raise ValueError(f"VoxPro log_pull expected list, got {type(data).__name__}")
    return data
