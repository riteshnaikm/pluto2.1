"""
Blueprint registration for incremental app.py refactor.

At app init (early):
  - auth, pages, admin (see pluto.blueprints.register)

At end of app.py (after view functions exist):
  - pluto_api — /evaluate*, /api/ask, handbook, analytics, feedback APIs, PDF downloads

View implementations for legacy pages `/history`, `/feedback_history`,
`/evaluation/<id>`, `/test-tabs`, and feedback REST handlers live under
``pluto.routes``; blueprints wire them here and in ``pages_legacy.py`` /
``pluto_api.py``.
"""

from pluto.blueprints.register import register_blueprints

__all__ = ["register_blueprints"]
