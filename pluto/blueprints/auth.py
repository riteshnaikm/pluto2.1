"""Authentication routes (Google OAuth)."""

import logging

from flask import Blueprint, jsonify, redirect, render_template, session, url_for

from pluto.config import email_domain_allowed
from pluto.users_db import create_or_update_user, get_user_info


def register_auth_routes(app, *, google):
    bp = Blueprint("auth", __name__)

    @bp.route("/login", endpoint="login")
    def login():
        if "user" in session:
            return redirect(url_for("pages.index"))
        return render_template("login.html")

    @bp.route("/login/google", endpoint="login_google")
    def login_google():
        redirect_uri = url_for("auth.authorize", _external=True)
        return google.authorize_redirect(redirect_uri)

    @bp.route("/login/google/authorized", endpoint="authorize")
    def authorize():
        try:
            token = google.authorize_access_token()
            user_info = token.get("userinfo")

            if user_info:
                email = user_info.get("email")
                if not email_domain_allowed(email):
                    logging.warning("OAuth rejected for disallowed domain: %s", email)
                    return (
                        render_template(
                            "login.html",
                            error="Sign-in is restricted to approved company email domains.",
                        ),
                        403,
                    )
                name = user_info.get("name", email.split("@")[0])
                create_or_update_user(email, name)
                db_user = get_user_info(email)
                session["user"] = {
                    "email": email,
                    "name": name,
                    "role": db_user["role"] if db_user else "Recruiter",
                    "team": db_user["team"] if db_user else None,
                }
                return redirect(url_for("pages.index"))
            return jsonify({"error": "Failed to get user info"}), 400
        except Exception as e:
            logging.error("OAuth error: %s", e)
            return jsonify({"error": f"Authentication failed: {str(e)}"}), 500

    @bp.route("/logout", endpoint="logout")
    def logout():
        session.pop("user", None)
        return redirect(url_for("auth.login"))

    app.register_blueprint(bp)

    # Backward-compatible endpoint aliases
    app.add_url_rule("/login", endpoint="login", view_func=app.view_functions["auth.login"])
    app.add_url_rule(
        "/login/google",
        endpoint="login_google",
        view_func=app.view_functions["auth.login_google"],
    )
    app.add_url_rule(
        "/login/google/authorized",
        endpoint="authorize",
        view_func=app.view_functions["auth.authorize"],
    )
    app.add_url_rule("/logout", endpoint="logout", view_func=app.view_functions["auth.logout"])
