"""Legacy page routes moved from app.py."""

from flask import Blueprint

from pluto.routes import history_views as hv


def register_legacy_pages_blueprint():
    import app as m

    bp = Blueprint("pages_legacy", __name__)

    bp.add_url_rule(
        "/evaluation/<int:eval_id>", "view_evaluation", hv.view_evaluation
    )
    bp.add_url_rule("/history", "history", hv.history)
    bp.add_url_rule("/feedback_history", "feedback_history", hv.feedback_history)

    m.app.register_blueprint(bp)

    # Backward-compatible endpoint aliases
    m.app.add_url_rule(
        "/evaluation/<int:eval_id>",
        endpoint="view_evaluation",
        view_func=hv.view_evaluation,
    )
    m.app.add_url_rule("/history", endpoint="history", view_func=hv.history)
    m.app.add_url_rule(
        "/feedback_history",
        endpoint="feedback_history",
        view_func=hv.feedback_history,
    )
