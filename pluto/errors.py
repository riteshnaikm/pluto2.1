import logging

from flask import jsonify, request

from pluto.config import is_production


def register_error_handlers(app):
    @app.errorhandler(413)
    def request_entity_too_large(_error):
        return jsonify(
            {"success": False, "error": "File too large. Maximum upload size exceeded."}
        ), 413

    @app.errorhandler(429)
    def rate_limit_exceeded(_error):
        return jsonify(
            {"success": False, "error": "Too many requests. Please wait and try again."}
        ), 429

    @app.errorhandler(500)
    def internal_error(error):
        logging.exception("Unhandled error: %s", error)
        if request.path.startswith("/api/") or request.is_json:
            message = (
                "An internal server error occurred."
                if is_production()
                else str(getattr(error, "description", error))
            )
            return jsonify({"success": False, "error": message}), 500
        return "Internal Server Error", 500
