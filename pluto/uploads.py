import os
import re
import uuid

from werkzeug.utils import secure_filename

# Stored uploads: "{uuid32hex}_{original_safe_name}"
_STORED_UPLOAD_PREFIX = re.compile(r"^[a-f0-9]{32}_(.+)$", re.IGNORECASE)


def display_upload_filename(stored_name: str | None) -> str:
    """Human-readable resume name (strip UUID prefix from stored upload filename)."""
    if not stored_name:
        return "Resume"
    name = str(stored_name).strip()
    match = _STORED_UPLOAD_PREFIX.match(name)
    if match:
        return match.group(1) or name
    return name


def candidate_display_name(stored_name: str | None) -> str:
    """
    Best-effort candidate label from a stored upload filename.
    Strips UUID prefix, extension, and splits CamelCase / underscores into a readable name.
    """
    if not stored_name:
        return "Candidate"
    raw = display_upload_filename(stored_name)
    base = os.path.splitext(raw)[0].strip()
    if not base:
        return "Candidate"

    words: list[str] = []
    for segment in re.split(r"[_\-\s]+", base):
        segment = segment.strip()
        if not segment or segment.isdigit():
            continue
        # KrishnaKumar -> Krishna Kumar
        spaced = re.sub(r"([a-z])([A-Z])", r"\1 \2", segment)
        for token in spaced.split():
            token = token.strip(".")
            if len(token) < 2:
                continue
            if re.fullmatch(r"[a-f0-9]{6,}", token, re.IGNORECASE):
                continue
            words.append(token.title())

    if not words:
        return "Candidate"
    # Typical resume filenames: FirstnameLastname_Company — keep up to 3 tokens for display name
    if len(words) > 3:
        return " ".join(words[:3])
    return " ".join(words)


def store_uploaded_file(file, upload_folder: str, allowed_extensions: set):
    """Save upload with a UUID prefix to avoid collisions."""
    if not file or not file.filename:
        raise ValueError("No file provided")
    ext = file.filename.rsplit(".", 1)[-1].lower()
    if ext not in allowed_extensions:
        raise ValueError("Invalid file type")
    safe_base = secure_filename(file.filename) or f"upload.{ext}"
    stored_name = f"{uuid.uuid4().hex}_{safe_base}"
    file_path = os.path.join(upload_folder, stored_name)
    file.save(file_path)
    return file_path, stored_name
