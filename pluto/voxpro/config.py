"""VoxPro and call-analysis environment configuration."""

import os
import sys
from pathlib import Path

VOXPRO_OFFICE_BASE = os.getenv(
    "VOXPRO_OFFICE_BASE", "http://office.peoplelogic.in"
).rstrip("/")
VOXPRO_LOG_PULL_URL = os.getenv(
    "VOXPRO_LOG_PULL_URL",
    f"{VOXPRO_OFFICE_BASE}/Voxpro/api/log_pull",
)
VOXPRO_LOOKBACK_DAYS = int(os.getenv("VOXPRO_LOOKBACK_DAYS", "365"))
# Only download / transcribe / show calls longer than this (seconds). VoxPro API has no dur filter.
VOXPRO_MIN_DUR_SECONDS = int(os.getenv("VOXPRO_MIN_DUR_SECONDS", "5"))
# Cap total ``dur`` (log seconds) sent to Groq STT per run; 0 = no cap (merge still capped at CALL_MERGE_MAX_DURATION_SEC).
VOXPRO_STT_MAX_TOTAL_DUR_SECONDS = int(
    os.getenv("VOXPRO_STT_MAX_TOTAL_DUR_SECONDS", "0")
)

CALL_TRANSCRIPTION_PROVIDER = os.getenv(
    "CALL_TRANSCRIPTION_PROVIDER", "groq"
).strip().lower()
CALL_TRANSCRIPTION_GROQ_MODEL = os.getenv(
    "CALL_TRANSCRIPTION_GROQ_MODEL", "whisper-large-v3-turbo"
)
CALL_TRANSCRIPTION_GEMINI_MODEL = os.getenv(
    "CALL_TRANSCRIPTION_GEMINI_MODEL", "gemini-2.5-flash"
)

CALL_ANALYSIS_MODEL_PROVIDER = os.getenv(
    "CALL_ANALYSIS_MODEL_PROVIDER", "groq"
).strip().lower()
# Non-reasoning Groq model avoids empty output (finish_reason=length) on long transcripts.
CALL_ANALYSIS_GROQ_MODEL = os.getenv(
    "CALL_ANALYSIS_GROQ_MODEL", "llama-3.3-70b-versatile"
)
CALL_ANALYSIS_MAX_TRANSCRIPT_CHARS = int(
    os.getenv("CALL_ANALYSIS_MAX_TRANSCRIPT_CHARS", "12000")
)
CALL_ANALYSIS_MAX_COMPLETION_TOKENS = int(
    os.getenv("CALL_ANALYSIS_MAX_COMPLETION_TOKENS", "2048")
)
CALL_ANALYSIS_GEMINI_MODEL = os.getenv(
    "CALL_ANALYSIS_GEMINI_MODEL", os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
)

CALL_MERGE_MAX_BYTES = int(os.getenv("CALL_MERGE_MAX_BYTES", "24000000"))
CALL_MERGE_MAX_DURATION_SEC = int(os.getenv("CALL_MERGE_MAX_DURATION_SEC", "5400"))
CALL_MERGE_SILENCE_MS = int(os.getenv("CALL_MERGE_SILENCE_MS", "1500"))

CALLS_UPLOAD_SUBDIR = "calls"


def default_ffmpeg_binary() -> str | None:
    """WinGet install path on Windows; override with FFMPEG_BINARY in .env."""
    explicit = os.getenv("FFMPEG_BINARY", "").strip()
    if explicit:
        p = Path(explicit)
        return str(p) if p.exists() else explicit
    if sys.platform == "win32":
        local = os.environ.get("LOCALAPPDATA", "")
        if local:
            winget = Path(local) / "Microsoft" / "WinGet" / "Links" / "ffmpeg.exe"
            if winget.is_file():
                return str(winget)
    return None


FFMPEG_BINARY = default_ffmpeg_binary()
