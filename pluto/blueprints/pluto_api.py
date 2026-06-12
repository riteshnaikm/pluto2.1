"""
API, evaluation, handbook, analytics, and PDF-download routes.

Most view functions remain on the ``app`` module; feedback list/check/submit live in
``pluto.routes.feedback_views``. URLs are attached here after ``app`` finishes loading
to avoid circular imports.
"""

from flask import Blueprint

from pluto.routes import feedback_views as fv
from pluto.routes import gcs_transcript_views as gtx
from pluto.routes import voxpro_views as vx


def register_pluto_api_blueprint() -> None:
    import app as m

    app = m.app
    bp = Blueprint("pluto_api", __name__)

    # (url_rule, endpoint, view_func, methods)
    registrations = [
        ("/api/feedback/all", fv.get_all_feedback, ("GET",)),
        (
            "/api/feedback/check/<feedback_type>/<int:item_id>",
            fv.check_feedback_exists,
            ("GET",),
        ),
        ("/api/feedback/handbook", fv.submit_handbook_feedback, ("POST",)),
        ("/api/ask", m.ask_question, ("POST",)),
        ("/api/update_index", m.update_index_api, ("POST",)),
        ("/evaluate", m.evaluate_resume, ("POST",)),
        ("/evaluate-stream", m.evaluate_resume_stream, ("POST",)),
        (
            "/get_interview_questions/<evaluation_id>",
            m.get_interview_questions,
            ("GET",),
        ),
        ("/api/feedback", fv.submit_feedback, ("POST",)),
        (
            "/api/evaluation/<evaluation_id>",
            m.get_evaluation_details,
            ("GET",),
        ),
        (
            "/api/generate_questions/<evaluation_id>",
            m.generate_questions_api,
            ("POST",),
        ),
        (
            "/api/generate-recruiter-handbook",
            m.generate_recruiter_handbook,
            ("POST",),
        ),
        (
            "/api/generate-recruiter-handbook-stream",
            m.generate_recruiter_handbook_stream,
            ("POST",),
        ),
        (
            "/api/generate-handbook-summary",
            m.generate_handbook_summary,
            ("POST",),
        ),
        ("/api/jd-quality-score", m.jd_quality_score, ("POST",)),
        ("/api/get-job-ids", m.get_job_ids, ("GET",)),
        ("/api/get-job-data/<job_id>", m.get_job_data, ("GET",)),
        ("/api/client-call-records", gtx.client_call_records_list, ("GET",)),
        ("/api/client-call-records/detail", gtx.client_call_records_detail, ("GET",)),
        ("/api/get-handbooks", m.get_handbooks, ("GET",)),
        ("/api/analytics/overview", m.get_analytics_overview, ("GET",)),
        ("/api/analytics/export-csv", m.export_analytics_csv, ("GET",)),
        ("/api/analytics/timeline", m.get_analytics_timeline, ("GET",)),
        (
            "/api/analytics/team-performance",
            m.get_team_performance,
            ("GET",),
        ),
        (
            "/api/analytics/match-score-distribution",
            m.get_match_score_distribution,
            ("GET",),
        ),
        ("/api/analytics/user-activity", m.get_user_activity, ("GET",)),
        ("/api/analytics/recent-activity", m.get_recent_activity, ("GET",)),
        ("/api/analytics/top-jobs", m.get_top_jobs, ("GET",)),
        (
            "/api/handbook/<int:handbook_id>",
            m.get_single_handbook,
            ("GET",),
        ),
        ("/api/handbooks-only", m.get_handbooks_only, ("GET",)),
        ("/api/evaluations-only", m.get_evaluations_only, ("GET",)),
        ("/api/job-centric-history", m.get_job_centric_history, ("GET",)),
        (
            "/api/handbooks-by-job/<job_id>",
            m.get_handbooks_by_job,
            ("GET",),
        ),
        (
            "/api/download-evaluation-pdf",
            m.download_evaluation_pdf,
            ("POST",),
        ),
        (
            "/api/evaluation-full/<int:eval_id>",
            m.get_evaluation_full,
            ("GET",),
        ),
        (
            "/api/evaluations-by-job/<job_id>",
            m.get_evaluations_by_job,
            ("GET",),
        ),
        (
            "/api/download-handbook-pdf",
            m.download_handbook_pdf,
            ("POST",),
        ),
        ("/evaluate-batch", m.evaluate_batch, ("POST",)),
        ("/api/voxpro/calls/fetch", vx.voxpro_calls_fetch, ("POST",)),
        ("/api/voxpro/calls/analyze", vx.voxpro_calls_analyze, ("POST",)),
        ("/api/voxpro/calls", vx.voxpro_calls_list, ("GET",)),
    ]

    for rule, view, methods in registrations:
        bp.add_url_rule(rule, view.__name__, view, methods=list(methods))

    app.register_blueprint(bp)
