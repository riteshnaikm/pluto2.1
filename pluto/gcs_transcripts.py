"""List and fetch client-call transcripts from GCS (PeopleLogic Recorder extension)."""

from __future__ import annotations

import json
import logging
import os
import re
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)

_FILENAME_TS_RE = re.compile(r"(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})$")
_LIST_CAP = 2000


def gcs_bucket_name() -> str:
    return os.getenv("GCS_BUCKET", "peoplelogic-pl-recordings").strip()


def gcs_prefix() -> str:
    return os.getenv("GCS_PREFIX", "pl-recorder").strip().strip("/")


def gcs_configured() -> bool:
    if not gcs_bucket_name():
        return False
    creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "").strip()
    if creds_path:
        return os.path.isfile(creds_path)
    try:
        from google.auth import default

        default()
        return True
    except Exception:
        return False


def sanitize_folder_id(value: str) -> str:
    return re.sub(r"[^\w]+", "_", (value or "").strip())


def parse_recorded_at_from_basename(basename: str) -> datetime | None:
    match = _FILENAME_TS_RE.search(basename or "")
    if not match:
        return None
    try:
        return datetime.strptime(
            f"{match.group(1)}_{match.group(2)}", "%Y-%m-%d_%H-%M-%S"
        ).replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def validate_transcript_path(object_path: str) -> bool:
    path = (object_path or "").strip().lstrip("/")
    if not path or ".." in path or path.startswith("/"):
        return False
    prefix = gcs_prefix()
    if not path.startswith(f"{prefix}/"):
        return False
    if "/transcripts/" not in path:
        return False
    if not path.endswith(".json"):
        return False
    return True


def _meta_get(metadata: dict[str, Any] | None, *keys: str) -> str:
    if not metadata:
        return ""
    lowered = {str(k).lower(): v for k, v in metadata.items()}
    for key in keys:
        for candidate in (key, key.replace("_", "-"), key.replace("-", "_")):
            value = lowered.get(candidate.lower())
            if value:
                return str(value).strip()
    return ""


def _folder_id_from_path(object_path: str) -> str:
    prefix = gcs_prefix()
    parts = object_path.split("/")
    if len(parts) >= 4 and parts[0] == prefix:
        return parts[1]
    return ""


def _basename_from_path(object_path: str) -> str:
    name = object_path.rsplit("/", 1)[-1]
    return name[:-5] if name.endswith(".json") else name


def get_storage_client():
    if not gcs_configured():
        raise RuntimeError("GCS is not configured (set GCS_BUCKET and GOOGLE_APPLICATION_CREDENTIALS)")
    from google.cloud import storage

    return storage.Client()


def _recorded_at_sort_key(record: dict[str, Any]) -> datetime:
    recorded = record.get("recorded_at")
    if isinstance(recorded, datetime):
        return recorded if recorded.tzinfo else recorded.replace(tzinfo=timezone.utc)
    if isinstance(recorded, str) and recorded:
        try:
            parsed = datetime.fromisoformat(recorded.replace("Z", "+00:00"))
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    return datetime.min.replace(tzinfo=timezone.utc)


def _blob_to_lightweight_record(blob) -> dict[str, Any] | None:
    object_path = blob.name
    if "/transcripts/" not in object_path or not object_path.endswith(".json"):
        return None

    metadata = blob.metadata or {}
    artifact_type = _meta_get(metadata, "artifact-type", "artifact_type")
    if artifact_type and artifact_type.lower() not in ("transcript", ""):
        return None

    basename = _basename_from_path(object_path)
    folder_id = _folder_id_from_path(object_path)
    recorded_at = parse_recorded_at_from_basename(basename)
    if recorded_at is None and blob.time_created:
        recorded_at = blob.time_created

    recorded_iso = recorded_at.isoformat() if recorded_at else None

    return {
        "object_path": object_path,
        "folder_id": folder_id,
        "basename": basename,
        "recorded_at": recorded_iso,
        "client": _meta_get(metadata, "client"),
        "contact": _meta_get(metadata, "contact"),
        "job_title": _meta_get(metadata, "job-title", "job_title"),
        "context_type": _meta_get(metadata, "context-type", "context_type"),
        "oorwin_job_id": _meta_get(metadata, "oorwin-job-id", "oorwin_job_id", "job-id", "job_id"),
        "duration_seconds": None,
        "transcript_preview": "",
    }


def _matches_filters(
    record: dict[str, Any],
    *,
    client_filter: str | None,
    job_id_filter: str | None,
) -> bool:
    if client_filter:
        needle = client_filter.strip().lower()
        haystacks = [
            record.get("client") or "",
            record.get("folder_id") or "",
        ]
        if not any(needle in h.lower() for h in haystacks if h):
            return False

    if job_id_filter:
        sanitized = sanitize_folder_id(job_id_filter).lower()
        candidates = [
            sanitize_folder_id(record.get("folder_id") or "").lower(),
            sanitize_folder_id(record.get("oorwin_job_id") or "").lower(),
        ]
        if not any(sanitized and (sanitized == c or sanitized in c or c in sanitized) for c in candidates if c):
            return False

    return True


def list_transcript_records(
    limit: int = 50,
    client_filter: str | None = None,
    job_id_filter: str | None = None,
) -> list[dict[str, Any]]:
    """List lightweight transcript records (metadata only; no JSON download)."""
    client = get_storage_client()
    bucket = client.bucket(gcs_bucket_name())
    prefix = f"{gcs_prefix()}/"

    records: list[dict[str, Any]] = []
    scanned = 0
    for blob in bucket.list_blobs(prefix=prefix):
        scanned += 1
        if scanned > _LIST_CAP:
            break
        record = _blob_to_lightweight_record(blob)
        if not record:
            continue
        if not _matches_filters(record, client_filter=client_filter, job_id_filter=job_id_filter):
            continue
        records.append(record)

    records.sort(key=_recorded_at_sort_key, reverse=True)
    if limit > 0:
        records = records[:limit]

    for record in records:
        record["label"] = format_dropdown_label(record)

    return records


def get_transcript_by_path(object_path: str) -> dict[str, Any]:
    if not validate_transcript_path(object_path):
        raise ValueError("Invalid transcript object path")

    client = get_storage_client()
    bucket = client.bucket(gcs_bucket_name())
    blob = bucket.blob(object_path)
    if not blob.exists():
        raise FileNotFoundError(object_path)

    raw = blob.download_as_text(encoding="utf-8")
    document = json.loads(raw)
    if not isinstance(document, dict):
        raise ValueError("Transcript JSON must be an object")

    document["object_path"] = object_path
    return document


def format_dropdown_label(record: dict[str, Any]) -> str:
    primary = (
        record.get("oorwin_job_id")
        or record.get("client")
        or record.get("folder_id")
        or "Call"
    )

    date_part = ""
    recorded = record.get("recorded_at")
    if recorded:
        try:
            if isinstance(recorded, str):
                dt = datetime.fromisoformat(recorded.replace("Z", "+00:00"))
            elif isinstance(recorded, datetime):
                dt = recorded
            else:
                dt = None
            if dt:
                date_part = dt.strftime("%d %b %Y %H:%M")
        except (ValueError, TypeError):
            date_part = str(recorded)[:16]

    parts = [primary]
    if date_part:
        parts.append(date_part)
    if record.get("context_type"):
        parts.append(record["context_type"])
    tail = record.get("contact") or record.get("job_title")
    if tail:
        parts.append(tail)
    return " · ".join(parts)


def format_transcript_for_prompt(document: dict[str, Any]) -> str:
    """Build a prompt block from a full transcript document."""
    transcript = (document.get("transcript") or "").strip()
    ctx = document.get("recordingContext") or {}
    meta = document.get("metadata") or {}

    lines = [
        "## CLIENT CALL TRANSCRIPT (PeopleLogic Recorder)",
        f"**Recording:** {document.get('recordingFilename') or document.get('basename', 'unknown')}",
    ]
    if document.get("recordedAt"):
        lines.append(f"**Recorded at:** {document['recordedAt']}")
    if document.get("durationSeconds"):
        lines.append(f"**Duration (seconds):** {document['durationSeconds']}")

    context_type = ctx.get("type") or meta.get("context-type") or meta.get("context_type")
    if context_type:
        lines.append(f"**Context type:** {context_type}")

    if context_type == "oorwin" or ctx.get("oorwinJobId") or ctx.get("jobCode"):
        for label, key in (
            ("Oorwin job", ctx.get("jobCode") or ctx.get("oorwinJobId")),
            ("Job title", ctx.get("jobTitle")),
            ("Client", ctx.get("client")),
            ("Client manager", ctx.get("clientManager")),
            ("Status", ctx.get("status")),
        ):
            if key:
                lines.append(f"- **{label}:** {key}")
    else:
        for label, key in (
            ("Client", ctx.get("clientName") or meta.get("client")),
            ("Contact", ctx.get("contactName") or meta.get("contact")),
            ("Role title", ctx.get("roleTitle") or meta.get("job-title")),
        ):
            if key:
                lines.append(f"- **{label}:** {key}")

    notes = ctx.get("notes") or meta.get("notes")
    if notes:
        lines.append(f"- **Notes:** {notes}")

    lines.extend(
        [
            "",
            "Use this transcript as a primary source for client requirements, role nuances, "
            "sourcing mandate, and screening priorities when they are not fully captured in the JD.",
            "",
            "### Transcript text",
            transcript or "(empty transcript)",
        ]
    )
    return "\n".join(lines)
