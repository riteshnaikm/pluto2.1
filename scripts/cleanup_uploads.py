#!/usr/bin/env python3
"""CLI: remove stale resume uploads not referenced in the database."""

import argparse
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from dotenv import load_dotenv

load_dotenv(os.path.join(ROOT, ".env"))

from pluto.upload_cleanup import cleanup_upload_folder  # noqa: E402


def main():
    parser = argparse.ArgumentParser(description="Clean stale PLUTO upload files")
    parser.add_argument(
        "--folder",
        default=os.getenv("UPLOAD_FOLDER", "uploads"),
        help="Upload directory (default: uploads)",
    )
    parser.add_argument(
        "--days",
        type=int,
        default=int(os.getenv("UPLOAD_CLEANUP_MAX_AGE_DAYS", "7")),
        help="Delete unreferenced files older than this many days",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="List files that would be deleted without removing them",
    )
    args = parser.parse_args()

    upload_folder = os.path.join(ROOT, args.folder) if not os.path.isabs(args.folder) else args.folder
    removed, skipped = cleanup_upload_folder(
        upload_folder, max_age_days=args.days, dry_run=args.dry_run
    )
    action = "Would remove" if args.dry_run else "Removed"
    print(f"{action} {len(removed)} file(s), skipped {len(skipped)} still referenced in DB.")
    for name in removed:
        print(f"  - {name}")


if __name__ == "__main__":
    main()
