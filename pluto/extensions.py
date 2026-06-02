from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_wtf.csrf import CSRFProtect

csrf = CSRFProtect()


def _limiter_key():
    from flask import session

    user = session.get("user") or {}
    email = user.get("email")
    if email:
        return email
    return get_remote_address()


limiter = Limiter(key_func=_limiter_key, default_limits=["300 per hour"])


def init_app_extensions(app):
    csrf.init_app(app)
    limiter.init_app(app)
