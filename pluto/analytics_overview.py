"""Consolidated SQL helpers for dashboard overview metrics."""


def fetch_overview_core_metrics(
    cursor,
    eval_where_clause: str,
    eval_params: list,
    handbook_where_clause: str,
    handbook_params: list,
):
    """
    Single round-trip for the four headline counts + average match score.
    Returns dict with total_evaluations, total_handbooks, unique_jobs_evals,
    unique_jobs_handbooks, avg_match_score.
    """
    eval_job_extra = (
        " AND oorwin_job_id IS NOT NULL AND oorwin_job_id != ''"
        if eval_where_clause
        else " WHERE oorwin_job_id IS NOT NULL AND oorwin_job_id != ''"
    )
    hb_job_extra = (
        " AND oorwin_job_id IS NOT NULL AND oorwin_job_id != ''"
        if handbook_where_clause
        else " WHERE oorwin_job_id IS NOT NULL AND oorwin_job_id != ''"
    )
    eval_score_extra = (
        " AND match_percentage IS NOT NULL"
        if eval_where_clause
        else " WHERE match_percentage IS NOT NULL"
    )

    query_params = (
        list(eval_params)
        + list(handbook_params)
        + list(eval_params)
        + list(handbook_params)
        + list(eval_params)
    )
    cursor.execute(
        f"""
        SELECT
            (SELECT COUNT(*) FROM evaluations{eval_where_clause}) AS total_evaluations,
            (SELECT COUNT(*) FROM recruiter_handbooks{handbook_where_clause}) AS total_handbooks,
            (SELECT COUNT(DISTINCT oorwin_job_id) FROM evaluations{eval_where_clause}{eval_job_extra}) AS unique_jobs_evals,
            (SELECT COUNT(DISTINCT oorwin_job_id) FROM recruiter_handbooks{handbook_where_clause}{hb_job_extra}) AS unique_jobs_handbooks,
            (SELECT AVG(match_percentage) FROM evaluations{eval_where_clause}{eval_score_extra}) AS avg_match_score
        """,
        query_params,
    )
    row = cursor.fetchone()
    return {
        "total_evaluations": row[0] or 0,
        "total_handbooks": row[1] or 0,
        "unique_jobs_evals": row[2] or 0,
        "unique_jobs_handbooks": row[3] or 0,
        "avg_match_score": round(row[4] or 0, 1),
    }
