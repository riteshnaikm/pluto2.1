"""Client call transcript records from GCS (PeopleLogic Recorder)."""

from __future__ import annotations

import logging

from flask import jsonify, request

from pluto.auth_decorators import login_required
from pluto.gcs_transcripts import (
    gcs_configured,
    get_transcript_by_path,
    list_transcript_records,
    validate_transcript_path,
)
from pluto.messages import safe_api_error

logger = logging.getLogger(__name__)


@login_required
def client_call_records_list():
    """GET /api/client-call-records — lightweight transcript index."""
    if not gcs_configured():
        return jsonify(
            {
                "configured": False,
                "records": [],
                "message": "Call records unavailable (GCS not configured)",
            }
        )

    try:
        limit = request.args.get("limit", 50, type=int)
        if limit < 1:
            limit = 50
        if limit > 200:
            limit = 200

        client_filter = (request.args.get("client") or "").strip() or None
        job_id_filter = (request.args.get("job_id") or "").strip() or None

        records = list_transcript_records(
            limit=limit,
            client_filter=client_filter,
            job_id_filter=job_id_filter,
        )
        message = None
        if not records:
            message = "No call transcripts found yet"

        return jsonify(
            {
                "configured": True,
                "records": records,
                "message": message,
            }
        )
    except Exception as exc:
        logger.exception("client_call_records_list failed")
        return jsonify(
            {
                "configured": True,
                "records": [],
                "message": safe_api_error(
                    exc, fallback="Unable to load call transcripts"
                ),
            }
        ), 500


@login_required
def client_call_records_detail():
    """GET /api/client-call-records/detail — full transcript JSON."""
    object_path = (request.args.get("path") or "").strip()
    if not object_path:
        return jsonify({"success": False, "error": "path is required"}), 400
    if not validate_transcript_path(object_path):
        return jsonify({"success": False, "error": "Invalid transcript path"}), 400
    if not gcs_configured():
        return jsonify(
            {"success": False, "error": "Call records unavailable (GCS not configured)"}
        ), 503

    try:
        document = get_transcript_by_path(object_path)
        return jsonify({"success": True, "transcript": document})
    except FileNotFoundError:
        return jsonify({"success": False, "error": "Transcript not found"}), 404
    except Exception as exc:
        logger.exception("client_call_records_detail failed for %s", object_path)
        return jsonify(
            {
                "success": False,
                "error": safe_api_error(exc, fallback="Unable to load transcript"),
            }
        ), 500
