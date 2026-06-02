"""Optional background maintenance (upload cleanup)."""

import logging
import os
import threading
import time

from pluto.upload_cleanup import cleanup_upload_folder


def start_upload_cleanup_scheduler(app) -> None:
    """
    Run upload cleanup on an interval when UPLOAD_CLEANUP_INTERVAL_HOURS > 0.
    Default: disabled (0). Set e.g. 24 for daily cleanup.
    """
    try:
        hours = float(os.getenv("UPLOAD_CLEANUP_INTERVAL_HOURS", "0") or "0")
    except ValueError:
        hours = 0.0
    if hours <= 0:
        return

    upload_folder = app.config.get("UPLOAD_FOLDER")
    if not upload_folder:
        return

    try:
        max_age_days = int(os.getenv("UPLOAD_MAX_AGE_DAYS", "7"))
    except ValueError:
        max_age_days = 7

    interval_sec = max(3600.0, hours * 3600.0)

    def _loop():
        while True:
            time.sleep(interval_sec)
            try:
                removed, _bytes = cleanup_upload_folder(
                    upload_folder, max_age_days=max_age_days
                )
                if removed:
                    logging.info(
                        "Scheduled upload cleanup removed %s file(s) from %s",
                        removed,
                        upload_folder,
                    )
            except Exception as exc:
                logging.warning("Scheduled upload cleanup failed: %s", exc)

    thread = threading.Thread(target=_loop, name="pluto-upload-cleanup", daemon=True)
    thread.start()
    logging.info(
        "Upload cleanup scheduler started (every %.1f h, max age %s days)",
        hours,
        max_age_days,
    )
