"""Remove stale files from the uploads directory."""

import logging
import os
import sqlite3
import time
from typing import List, Set, Tuple

from pluto.users_db import DATABASE_NAME

logger = logging.getLogger(__name__)


def referenced_upload_filenames(db_path: str = DATABASE_NAME) -> Set[str]:
    """Basenames still referenced by evaluations (stored filename column)."""
    names: Set[str] = set()
    if not os.path.isfile(db_path):
        return names
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT DISTINCT filename FROM evaluations WHERE filename IS NOT NULL AND filename != ''"
        )
        for (filename,) in cursor.fetchall():
            if filename:
                names.add(os.path.basename(filename))
    finally:
        conn.close()
    return names


def cleanup_upload_folder(
    upload_folder: str,
    *,
    max_age_days: int = 7,
    db_path: str = DATABASE_NAME,
    dry_run: bool = False,
) -> Tuple[List[str], List[str]]:
    """
    Delete files in upload_folder that are older than max_age_days and not in DB.

    Returns (deleted_or_would_delete, skipped_in_use).
    """
    if not os.path.isdir(upload_folder):
        return [], []

    referenced = referenced_upload_filenames(db_path)
    cutoff = time.time() - (max_age_days * 86400)
    removed: List[str] = []
    skipped: List[str] = []

    for name in os.listdir(upload_folder):
        path = os.path.join(upload_folder, name)
        if not os.path.isfile(path):
            continue
        if name in referenced:
            skipped.append(name)
            continue
        try:
            mtime = os.path.getmtime(path)
        except OSError:
            continue
        if mtime > cutoff:
            continue
        if dry_run:
            removed.append(name)
            continue
        try:
            os.remove(path)
            removed.append(name)
            logger.info("Removed stale upload: %s", name)
        except OSError as exc:
            logger.warning("Could not remove %s: %s", path, exc)

    return removed, skipped
