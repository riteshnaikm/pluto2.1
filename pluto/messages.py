"""Safe user-facing API error messages."""

from pluto.config import is_production


def safe_api_error(exc: Exception, *, fallback: str = "An error occurred. Please try again.") -> str:
  if is_production():
    return fallback
  return str(exc) or fallback
