"""History and related HTML page views."""

import json
import logging
import re
import sqlite3

from flask import render_template, session

from pluto.auth_decorators import login_required
from pluto.users_db import DATABASE_NAME, get_accessible_user_emails


@login_required
def view_evaluation(eval_id):
    """View a single evaluation in detail"""
    try:
        conn = sqlite3.connect(DATABASE_NAME)
        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT 
                e.id, e.filename, e.job_title, e.job_description,
                e.match_percentage, e.match_factors, e.profile_summary,
                e.missing_keywords, e.job_stability, e.career_progression,
                e.oorwin_job_id, e.timestamp
            FROM evaluations e
            WHERE e.id = ?
        """,
            (eval_id,),
        )

        row = cursor.fetchone()

        if not row:
            conn.close()
            return "Evaluation not found", 404

        cursor.execute(
            """
            SELECT technical_questions, nontechnical_questions, behavioral_questions
            FROM interview_questions
            WHERE evaluation_id = ?
        """,
            (eval_id,),
        )

        questions_row = cursor.fetchone()
        conn.close()

        evaluation = {
            "id": row[0],
            "filename": row[1],
            "job_title": row[2],
            "job_description": row[3],
            "match_percentage": row[4],
            "match_factors": json.loads(row[5]) if row[5] else {},
            "profile_summary": row[6],
            "missing_keywords": json.loads(row[7]) if row[7] else [],
            "job_stability": json.loads(row[8]) if row[8] else {},
            "career_progression": json.loads(row[9]) if row[9] else {},
            "oorwin_job_id": row[10],
            "timestamp": row[11],
        }

        def normalize_questions(questions_list):
            if not questions_list:
                return []
            normalized = []
            for q in questions_list:
                if isinstance(q, str):
                    normalized.append(q)
                elif isinstance(q, dict):
                    normalized.append(
                        q.get("question")
                        or q.get("text")
                        or q.get("content")
                        or q.get("value")
                        or str(q)
                    )
                else:
                    normalized.append(str(q))
            return normalized

        if questions_row:
            tech_raw = json.loads(questions_row[0]) if questions_row[0] else []
            nontech_raw = json.loads(questions_row[1]) if questions_row[1] else []
            behavioral_raw = json.loads(questions_row[2]) if questions_row[2] else []

            evaluation["technical_questions"] = normalize_questions(tech_raw)
            evaluation["nontechnical_questions"] = normalize_questions(nontech_raw)
            evaluation["behavioral_questions"] = normalize_questions(behavioral_raw)
        else:
            evaluation["technical_questions"] = []
            evaluation["nontechnical_questions"] = []
            evaluation["behavioral_questions"] = []

        return render_template("evaluation_view.html", evaluation=evaluation)

    except Exception as e:
        logging.error("Error viewing evaluation %s: %s", eval_id, e)
        return f"Error loading evaluation: {str(e)}", 500


@login_required
def history():
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()

    try:
        user_email = session["user"].get("email")
        accessible_emails = get_accessible_user_emails(user_email)

        if not accessible_emails:
            return render_template("history.html", evaluations=[])

        placeholders = ",".join(["?"] * len(accessible_emails))
        where_clause = f"WHERE e.user_email IN ({placeholders})"

        cursor.execute(
            f"""
            SELECT 
                e.id, 
                e.filename, 
                e.job_title, 
                e.match_percentage, 
                e.missing_keywords, 
                e.profile_summary, 
                e.job_stability,
                e.career_progression,
                e.timestamp,
                iq.technical_questions,
                iq.nontechnical_questions,
                e.oorwin_job_id
            FROM evaluations e
            LEFT JOIN interview_questions iq ON e.id = iq.evaluation_id
            {where_clause}
            ORDER BY e.timestamp DESC
        """,
            accessible_emails,
        )

        evaluations = []
        for row in cursor.fetchall():
            try:

                def safe_json_loads(data, default):
                    if not data:
                        logging.info(
                            "Empty data for field, using default: %s", default
                        )
                        return default
                    try:
                        if isinstance(data, str):
                            return json.loads(data)
                        return data
                    except json.JSONDecodeError as err:
                        logging.error(
                            "JSON parsing error for evaluation %s: %s - Data: %s",
                            row[0],
                            err,
                            data,
                        )
                        if isinstance(data, str):
                            try:
                                cleaned = re.sub(r",\s*}", "}", data)
                                cleaned = re.sub(r",\s*]", "]", cleaned)
                                return json.loads(cleaned)
                            except Exception:
                                pass
                        return default

                missing_keywords_raw = row[4]
                try:
                    if missing_keywords_raw:
                        missing_keywords = safe_json_loads(missing_keywords_raw, [])
                        if not isinstance(missing_keywords, list):
                            if isinstance(missing_keywords, str):
                                missing_keywords = [
                                    k.strip(' "\'')
                                    for k in missing_keywords.strip("[]").split(",")
                                ]
                            else:
                                missing_keywords = [str(missing_keywords)]
                    else:
                        missing_keywords = []
                except Exception as ex:
                    logging.error(
                        "Error parsing missing_keywords for eval %s: %s",
                        row[0],
                        ex,
                    )
                    missing_keywords = []

                logging.info(
                    "Raw job_stability data for eval %s: %s", row[0], row[6]
                )
                logging.info(
                    "Raw career_progression data for eval %s: %s",
                    row[0],
                    row[7],
                )

                job_stability_data = row[6]
                if job_stability_data:
                    try:
                        job_stability = safe_json_loads(job_stability_data, {})
                        if not isinstance(job_stability, dict):
                            job_stability = {}
                    except Exception as ex:
                        logging.error(
                            "Error processing job_stability for eval %s: %s",
                            row[0],
                            ex,
                        )
                        job_stability = {}
                else:
                    job_stability = {}

                career_progression_data = row[7]
                if career_progression_data:
                    try:
                        career_progression = safe_json_loads(
                            career_progression_data, {}
                        )
                        if not isinstance(career_progression, dict):
                            career_progression = {}
                    except Exception as ex:
                        logging.error(
                            "Error processing career_progression for eval %s: %s",
                            row[0],
                            ex,
                        )
                        career_progression = {}
                else:
                    career_progression = {}

                technical_questions = safe_json_loads(row[9], [])
                nontechnical_questions = safe_json_loads(row[10], [])

                profile_summary = (
                    str(row[5]) if row[5] is not None else "No summary available"
                )

                if not job_stability:
                    job_stability = {
                        "StabilityScore": 0,
                        "AverageJobTenure": "N/A",
                        "JobCount": 0,
                        "RiskLevel": "N/A",
                        "ReasoningExplanation": "No job stability data available.",
                    }

                if not career_progression:
                    career_progression = {
                        "progression_score": 0,
                        "key_observations": [],
                        "career_path": [],
                        "red_flags": [],
                        "reasoning": "No career progression data available.",
                    }

                try:
                    json.dumps(job_stability)
                    json.dumps(career_progression)
                    json.dumps(technical_questions)
                    json.dumps(nontechnical_questions)
                except (TypeError, ValueError) as ser_err:
                    logging.error(
                        "Serialization error for evaluation %s: %s",
                        row[0],
                        ser_err,
                    )
                    if not isinstance(job_stability, dict):
                        job_stability = {
                            "error": "Invalid data structure",
                            "message": str(job_stability),
                        }
                    if not isinstance(career_progression, dict):
                        career_progression = {
                            "error": "Invalid data structure",
                            "message": str(career_progression),
                        }
                    if not isinstance(technical_questions, list):
                        technical_questions = ["Error loading technical questions"]
                    if not isinstance(nontechnical_questions, list):
                        nontechnical_questions = [
                            "Error loading non-technical questions"
                        ]

                evaluation = {
                    "id": row[0],
                    "filename": row[1],
                    "job_title": row[2],
                    "match_percentage": row[3],
                    "missing_keywords": missing_keywords,
                    "profile_summary": profile_summary,
                    "job_stability": job_stability,
                    "career_progression": career_progression,
                    "timestamp": row[8],
                    "technical_questions": technical_questions,
                    "nontechnical_questions": nontechnical_questions,
                    "oorwin_job_id": row[11],
                }
                evaluations.append(evaluation)

                logging.info(
                    "Processed evaluation %s: job_stability=%s, career_progression=%s",
                    row[0],
                    job_stability,
                    career_progression,
                )

            except Exception as ex:
                logging.error(
                    "Error processing row for evaluation %s: %s", row[0], ex
                )
                continue

        return render_template("history.html", evaluations=evaluations)

    except Exception as e:
        logging.error("Error in history route: %s", e)
        return render_template(
            "history.html", evaluations=[], error="Failed to load evaluations"
        )

    finally:
        conn.close()


@login_required
def feedback_history():
    """Display unified feedback history page"""
    return render_template("feedback_history.html")
