"""VoxPro API routes."""

from __future__ import annotations

import logging

from flask import current_app, jsonify, request, session

from pluto.auth_decorators import login_required
from pluto.extensions import limiter
from pluto.messages import safe_api_error
from pluto.voxpro.client import (
    VoxProAccessError,
    VoxProHTTPError,
    dur_has_recording,
    normalize_phone,
)
from pluto.voxpro.config import VOXPRO_MIN_DUR_SECONDS
from pluto.voxpro.db import get_calls_for_phone, get_latest_analysis
from pluto.voxpro.ingest import fetch_and_ingest
from pluto.voxpro.pipeline import run_call_analysis

logger = logging.getLogger(__name__)


def _upload_root() -> str:
    return current_app.config.get("UPLOAD_FOLDER") or "uploads"


@login_required
def voxpro_calls_fetch():
    """POST /api/voxpro/calls/fetch — ingest logs and optionally download WAVs."""
    try:
        data = request.get_json(silent=True) or {}
        phone = data.get("phone") or request.args.get("phone")
        if not phone:
            return jsonify({"success": False, "error": "phone is required"}), 400

        download = data.get("download", True)
        if isinstance(download, str):
            download = download.lower() not in ("0", "false", "no")

        result = fetch_and_ingest(
            phone,
            upload_root=_upload_root(),
            from_dt=data.get("from"),
            to_dt=data.get("to"),
            lookback_days=data.get("lookback_days"),
            download=download,
        )
        return jsonify({"success": True, **result})
    except (VoxProAccessError, VoxProHTTPError) as exc:
        logger.warning("voxpro_calls_fetch: %s", exc)
        return jsonify({"success": False, "error": str(exc)}), 503
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except Exception as exc:
        logger.exception("voxpro_calls_fetch failed")
        return jsonify(
            {"success": False, "error": safe_api_error(exc, fallback="VoxPro fetch failed")}
        ), 500


@login_required
@limiter.limit("3 per minute")
def voxpro_calls_analyze():
    """POST /api/voxpro/calls/analyze — full pipeline."""
    try:
        data = request.get_json(silent=True) or {}
        phone = data.get("phone")
        if not phone:
            return jsonify({"success": False, "error": "phone is required"}), 400

        user_email = session.get("user", {}).get("email")
        result = run_call_analysis(
            phone,
            upload_root=_upload_root(),
            user_email=user_email,
            download=data.get("download", True),
            lookback_days=data.get("lookback_days"),
            oorwin_job_id=data.get("oorwin_job_id"),
            evaluation_id=data.get("evaluation_id"),
            handbook_id=data.get("handbook_id"),
        )
        status = 200 if result.get("success") else 422
        return jsonify(result), status
    except (VoxProAccessError, VoxProHTTPError) as exc:
        logger.warning("voxpro_calls_analyze: %s", exc)
        return jsonify({"success": False, "error": str(exc)}), 503
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except Exception as exc:
        logger.exception("voxpro_calls_analyze failed")
        return jsonify(
            {
                "success": False,
                "error": safe_api_error(exc, fallback="Call analysis failed"),
            }
        ), 500


@login_required
def voxpro_calls_list():
    """GET /api/voxpro/calls?phone= — cached calls + latest analysis."""
    try:
        phone = request.args.get("phone")
        if not phone:
            return jsonify({"success": False, "error": "phone query param required"}), 400
        phone_norm = normalize_phone(phone)
        calls = get_calls_for_phone(phone_norm)
        calls_filtered = [c for c in calls if dur_has_recording(c.get("dur"))]
        analysis = get_latest_analysis(phone_norm)
        return jsonify(
            {
                "success": True,
                "phone": phone_norm,
                "calls": calls_filtered,
                "min_dur_seconds": VOXPRO_MIN_DUR_SECONDS,
                "dur_filter_note": (
                    f"Showing calls with duration > {VOXPRO_MIN_DUR_SECONDS} seconds only"
                ),
                "latest_analysis": analysis,
            }
        )
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except Exception as exc:
        logger.exception("voxpro_calls_list failed")
        return jsonify(
            {"success": False, "error": safe_api_error(exc, fallback="Failed to load calls")}
        ), 500
