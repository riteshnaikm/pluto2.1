"""HTTP security headers for production deployments."""

import os

from pluto.config import is_production


def apply_security_headers(app):
  @app.after_request
  def _add_security_headers(response):
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
    response.headers.setdefault("X-Permitted-Cross-Domain-Policies", "none")

    enable_csp = os.getenv("ENABLE_CSP", "true" if is_production() else "false").lower() in (
      "1", "true", "yes", "on",
    )
    if enable_csp and "Content-Security-Policy" not in response.headers:
      # Allow CDNs used by templates; tighten further per deployment if needed.
      response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
        "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net; "
        "img-src 'self' data: https:; "
        "connect-src 'self'; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "form-action 'self'"
      )
    return response
