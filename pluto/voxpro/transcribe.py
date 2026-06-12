"""Speech-to-text for VoxPro recordings (Groq Whisper primary)."""

from __future__ import annotations

import logging
import os
from collections.abc import Callable
from pathlib import Path

from pluto.voxpro.config import (
    CALL_TRANSCRIPTION_GEMINI_MODEL,
    CALL_TRANSCRIPTION_GROQ_MODEL,
    CALL_TRANSCRIPTION_PROVIDER,
)

logger = logging.getLogger(__name__)


def format_call_header(index: int, call: dict, transcript: str) -> str:
    return (
        f"## Call {index} — {call.get('datetime', '')} — "
        f"{call.get('email_id', '')} — {call.get('callmethod', '')} — "
        f"{call.get('dur', '')}s\n\n{transcript.strip()}\n"
    )


def merge_transcript_sections(sections: list[str]) -> str:
    return "\n".join(s for s in sections if s and s.strip()).strip()


def transcribe_groq(wav_path: Path) -> str:
    from groq import Groq

    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is not set")

    client = Groq(api_key=api_key)
    with wav_path.open("rb") as f:
        result = client.audio.transcriptions.create(
            file=(wav_path.name, f.read()),
            model=CALL_TRANSCRIPTION_GROQ_MODEL,
            language="en",
            response_format="text",
        )
    if isinstance(result, str):
        return result.strip()
    text = getattr(result, "text", None)
    if text:
        return str(text).strip()
    return str(result).strip()


def transcribe_gemini(wav_path: Path) -> str:
    import google.generativeai as genai

    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY or GOOGLE_API_KEY is not set")

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(CALL_TRANSCRIPTION_GEMINI_MODEL)
    uploaded = genai.upload_file(str(wav_path))
    response = model.generate_content(
        [
            "Transcribe this phone call between a recruiter and a candidate. "
            "Output only the transcript text, in English. Preserve meaning if mixed languages.",
            uploaded,
        ]
    )
    return (response.text or "").strip()


def transcribe_file(wav_path: Path) -> tuple[str, str]:
    """Returns (text, engine_name)."""
    provider = CALL_TRANSCRIPTION_PROVIDER
    errors = []

    if provider in ("groq", "auto"):
        try:
            return transcribe_groq(wav_path), "groq"
        except Exception as exc:
            logger.warning("Groq STT failed: %s", exc)
            errors.append(f"groq:{exc}")

    if provider in ("gemini", "auto"):
        try:
            return transcribe_gemini(wav_path), "gemini"
        except Exception as exc:
            logger.warning("Gemini STT failed: %s", exc)
            errors.append(f"gemini:{exc}")

    raise RuntimeError("Transcription failed: " + "; ".join(errors))


def transcribe_calls(
    calls: list[dict],
    *,
    merged_wav: Path | None = None,
    cached_transcripts: dict[str, str] | None = None,
    save_transcript: Callable[..., None] | None = None,
) -> tuple[str, str]:
    """
    Primary: transcribe merged_wav if provided and merge succeeds.
    Fallback: per-call transcription with headers.
    Uses ``cached_transcripts`` (slno → text) to avoid re-sending audio to Groq.
    Returns (merged_transcript, stt_method).
    """
    cached = cached_transcripts or {}
    ordered = sorted(calls, key=lambda c: c.get("datetime") or "")

    def _all_cached() -> bool:
        need = [c for c in ordered if c.get("local_path")]
        return bool(need) and all(
            str(c.get("slno")) in cached for c in need
        )

    if _all_cached():
        sections = [
            format_call_header(i, c, cached[str(c["slno"])])
            for i, c in enumerate(ordered, start=1)
            if c.get("slno") is not None
        ]
        if sections:
            return merge_transcript_sections(sections), "cached"

    if merged_wav and merged_wav.exists():
        try:
            text, engine = transcribe_file(merged_wav)
            if text:
                return text, f"merged_{engine}"
        except Exception as exc:
            logger.warning("Merged STT failed, falling back to per-call: %s", exc)

    sections = []
    engine_used = "per_call"
    for i, call in enumerate(ordered, start=1):
        slno = str(call.get("slno") or "").strip()
        path = call.get("local_path")
        if not path:
            continue
        if slno and slno in cached:
            sections.append(format_call_header(i, call, cached[slno]))
            continue
        wav = Path(path)
        if not wav.exists():
            continue
        try:
            text, eng = transcribe_file(wav)
            engine_used = f"per_call_{eng}"
            sections.append(format_call_header(i, call, text))
            if slno and save_transcript:
                save_transcript(slno=slno, phone=call.get("phone_normalized"), text=text, engine=eng)
        except Exception as exc:
            logger.warning("Per-call STT failed slno=%s: %s", slno, exc)
            sections.append(
                format_call_header(
                    i, call, f"[Transcription unavailable: {exc}]"
                )
            )

    if not sections:
        raise RuntimeError("No transcripts produced")

    return merge_transcript_sections(sections), engine_used
