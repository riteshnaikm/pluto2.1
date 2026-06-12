"""Merge multiple call WAV files into one file for single-pass STT."""

from __future__ import annotations

import logging
from pathlib import Path

from pluto.voxpro.config import (
    CALL_MERGE_MAX_BYTES,
    CALL_MERGE_MAX_DURATION_SEC,
    CALL_MERGE_SILENCE_MS,
    FFMPEG_BINARY,
)

logger = logging.getLogger(__name__)


def _configure_pydub_ffmpeg() -> None:
    """Use FFMPEG_BINARY / WinGet path when PATH was not refreshed after install."""
    if not FFMPEG_BINARY:
        return
    from pydub import AudioSegment

    AudioSegment.converter = FFMPEG_BINARY
    ffprobe = str(Path(FFMPEG_BINARY).with_name("ffprobe.exe"))
    if Path(ffprobe).is_file():
        AudioSegment.ffprobe = ffprobe
    logger.debug("pydub ffmpeg: %s", FFMPEG_BINARY)


def _total_duration_ms(segments) -> int:
    return sum(len(s) for s in segments)


def should_skip_merge(segments, merged_path: Path | None = None) -> str | None:
    """Return reason string if merge should be skipped, else None."""
    if not segments:
        return "no_segments"
    total_ms = _total_duration_ms(segments)
    if total_ms > CALL_MERGE_MAX_DURATION_SEC * 1000:
        return "duration_cap"
    est_bytes = total_ms * 32  # rough 16kHz mono 16-bit
    if merged_path and merged_path.exists():
        if merged_path.stat().st_size > CALL_MERGE_MAX_BYTES:
            return "size_cap"
    elif est_bytes > CALL_MERGE_MAX_BYTES:
        return "size_cap"
    return None


def merge_wav_files(
    paths: list[Path],
    output_path: Path,
    *,
    silence_ms: int | None = None,
) -> tuple[Path | None, str | None]:
    """
    Concatenate WAVs (16 kHz mono) with silence between segments.
    Returns (output_path, skip_reason). skip_reason set if merge skipped.
    """
    if not paths:
        return None, "no_files"

    try:
        from pydub import AudioSegment
    except ImportError as exc:
        raise RuntimeError("pydub is required for audio merge; pip install pydub") from exc

    _configure_pydub_ffmpeg()

    gap_ms = silence_ms if silence_ms is not None else CALL_MERGE_SILENCE_MS
    silence = AudioSegment.silent(duration=gap_ms)
    combined = None
    segments = []

    for p in paths:
        if not p.exists():
            logger.warning("Missing WAV for merge: %s", p)
            continue
        seg = AudioSegment.from_wav(str(p))
        seg = seg.set_frame_rate(16000).set_channels(1)
        segments.append(seg)
        if combined is None:
            combined = seg
        else:
            combined = combined + silence + seg

    if combined is None:
        return None, "no_valid_files"

    skip = should_skip_merge(segments)
    if skip:
        return None, skip

    output_path.parent.mkdir(parents=True, exist_ok=True)
    combined.export(str(output_path), format="wav")

    if output_path.stat().st_size > CALL_MERGE_MAX_BYTES:
        output_path.unlink(missing_ok=True)
        return None, "size_cap"

    return output_path, None
