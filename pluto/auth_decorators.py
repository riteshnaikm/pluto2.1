"""Flask auth decorators."""

from functools import wraps

from flask import jsonify, redirect, request, session, url_for

from pluto.users_db import get_user_info


def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "user" not in session:
            if request.path.startswith("/api/"):
                return jsonify({"success": False, "error": "Authentication required"}), 401
            return redirect(url_for("auth.login"))
        return f(*args, **kwargs)

    return decorated_function


def role_required(*allowed_roles):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if "user" not in session:
                if request.path.startswith("/api/"):
                    return jsonify({"success": False, "error": "Authentication required"}), 401
                return redirect(url_for("auth.login"))
            user_email = session["user"].get("email")
            user_info = get_user_info(user_email)
            if not user_info or user_info["role"] not in allowed_roles:
                return jsonify({"error": "Access denied. Insufficient permissions."}), 403
            return f(*args, **kwargs)

        return decorated_function

    return decorator
