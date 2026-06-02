"""HTML page routes."""

from flask import Blueprint, render_template

from pluto.auth_decorators import login_required


def register_page_routes(app):
    bp = Blueprint("pages", __name__)

    @bp.route("/", endpoint="index")
    @login_required
    def index():
        return render_template("index.html")

    @bp.route("/hr-assistant", endpoint="hr_assistant")
    @login_required
    def hr_assistant():
        return render_template("index1.html")

    @bp.route("/resume-evaluator", endpoint="resume_evaluator")
    @login_required
    def resume_evaluator():
        return render_template("index2.html")

    @bp.route("/dashboard", endpoint="dashboard")
    @login_required
    def dashboard():
        return render_template("dashboard.html")

    app.register_blueprint(bp)

    # Backward-compatible endpoint aliases (avoid template churn)
    app.add_url_rule("/", endpoint="index", view_func=app.view_functions["pages.index"])
    app.add_url_rule(
        "/hr-assistant",
        endpoint="hr_assistant",
        view_func=app.view_functions["pages.hr_assistant"],
    )
    app.add_url_rule(
        "/resume-evaluator",
        endpoint="resume_evaluator",
        view_func=app.view_functions["pages.resume_evaluator"],
    )
    app.add_url_rule(
        "/dashboard",
        endpoint="dashboard",
        view_func=app.view_functions["pages.dashboard"],
    )
