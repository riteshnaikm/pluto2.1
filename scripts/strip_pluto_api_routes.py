# One-off: strip @app.route lines now registered on pluto_api blueprint.
# Run from repo root: python scripts/strip_pluto_api_routes.py

import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
APP = ROOT / "app.py"

# URL path fragments as they appear inside @app.route('... or "...
PATH_MARKERS = [
    "/api/feedback/all",
    "/api/feedback/check/",
    "/api/feedback/handbook",
    "/api/ask",
    "/api/update_index",
    "/evaluate'",
    '/evaluate"',
    "/evaluate-stream",
    "/get_interview_questions/",
    "/api/feedback'",
    '/api/feedback"',
    "/api/evaluation/",
    "/api/generate_questions/",
    "/api/generate-recruiter-handbook'",
    '/api/generate-recruiter-handbook"',
    "/api/generate-recruiter-handbook-stream",
    "/api/generate-handbook-summary",
    "/api/jd-quality-score",
    "/api/get-job-ids",
    "/api/get-job-data/",
    "/api/get-handbooks",
    "/api/analytics/overview",
    "/api/analytics/export-csv",
    "/api/analytics/timeline",
    "/api/analytics/team-performance",
    "/api/analytics/match-score-distribution",
    "/api/analytics/user-activity",
    "/api/analytics/recent-activity",
    "/api/analytics/top-jobs",
    "/api/handbook/<int:handbook_id>",
    "/api/handbooks-only",
    "/api/evaluations-only",
    "/api/job-centric-history",
    "/api/handbooks-by-job/",
    "/api/download-evaluation-pdf",
    "/api/evaluation-full/",
    "/api/evaluations-by-job/",
    "/api/download-handbook-pdf",
    "/evaluate-batch",
]

lines = APP.read_text(encoding="utf-8").splitlines(keepends=True)
out = []
for line in lines:
    s = line.lstrip()
    if s.startswith("@app.route(") and any(m in line for m in PATH_MARKERS):
        continue
    out.append(line)

APP.write_text("".join(out), encoding="utf-8")
print("Stripped", len(lines) - len(out), "lines from app.py")
