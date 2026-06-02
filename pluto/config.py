import os
import sys


def is_production() -> bool:
    return os.getenv("FLASK_ENV", "").lower() in ("production", "prod") or os.getenv(
        "PLUTO_PRODUCTION", ""
    ).lower() in ("1", "true", "yes", "on")


def strict_eval_json() -> bool:
    """When true, failed resume-eval JSON parse raises instead of placeholder defaults."""
    return os.getenv("STRICT_EVAL_JSON", "true").lower() in (
        "1",
        "true",
        "yes",
        "on",
    )


def resolve_secret_key() -> str:
    key = os.getenv("FLASK_SECRET_KEY", os.getenv("SECRET_KEY", "")).strip().strip('"')
    if not key or key == "your-secret-key-change-in-production-12345":
        if is_production():
            print(
                "FATAL: Set FLASK_SECRET_KEY (or SECRET_KEY) in the environment before running in production.",
                file=sys.stderr,
            )
            sys.exit(1)
        import secrets

        key = secrets.token_hex(32)
        print(
            "WARNING: FLASK_SECRET_KEY not set — using an ephemeral dev-only key. "
            "Set FLASK_SECRET_KEY in .env for stable sessions.",
            file=sys.stderr,
        )
    return key


def apply_flask_config(app) -> None:
    if not is_production():
        # Local dev: reload templates and avoid long-lived static caching in the browser.
        app.config["TEMPLATES_AUTO_RELOAD"] = True
        app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 0
        app.jinja_env.auto_reload = True
    else:
        # Long-cache versioned static assets in production.
        app.config["SEND_FILE_MAX_AGE_DEFAULT"] = int(
            os.getenv("STATIC_CACHE_MAX_AGE", str(365 * 24 * 3600))
        )

    max_mb = int(os.getenv("MAX_UPLOAD_MB", "10"))
    app.config["MAX_CONTENT_LENGTH"] = max_mb * 1024 * 1024
    app.config["SESSION_COOKIE_HTTPONLY"] = True
    app.config["SESSION_COOKIE_SAMESITE"] = os.getenv("SESSION_COOKIE_SAMESITE", "Lax")
    app.config["SESSION_COOKIE_SECURE"] = os.getenv(
        "SESSION_COOKIE_SECURE", "true" if is_production() else "false"
    ).lower() in ("1", "true", "yes", "on")
    app.config["PERMANENT_SESSION_LIFETIME"] = int(
        os.getenv("SESSION_LIFETIME_SECONDS", str(8 * 3600))
    )


def allowed_email_domains():
    """
    Comma-separated ALLOWED_EMAIL_DOMAINS (e.g. peoplelogic.in,example.com).
    Use * or leave empty to allow any domain.
    """
    raw = os.getenv("ALLOWED_EMAIL_DOMAINS", "peoplelogic.in").strip()
    if not raw or raw.lower() in ("*", "any", "all", "none"):
        return None
    return [d.strip().lower() for d in raw.split(",") if d.strip()]


def email_domain_allowed(email: str) -> bool:
    allowed = allowed_email_domains()
    if allowed is None:
        return True
    if not email or "@" not in email:
        return False
    return email.split("@")[-1].lower() in allowed
