"""Register all PLUTO blueprints on the Flask app."""

from pluto.blueprints.admin import register_admin_routes
from pluto.blueprints.auth import register_auth_routes
from pluto.blueprints.pages import register_page_routes


def register_blueprints(app, *, google):
    register_auth_routes(app, google=google)
    register_page_routes(app)
    register_admin_routes(app)
