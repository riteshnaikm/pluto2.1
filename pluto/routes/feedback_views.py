"""Feedback REST API views."""

import logging
import sqlite3

from flask import jsonify, request

from pluto.auth_decorators import login_required
from pluto.users_db import DATABASE_NAME


@login_required
def get_all_feedback():
    """Get all feedback from all 3 sources"""
    try:
        conn = sqlite3.connect(DATABASE_NAME)
        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT qf.id, qf.question_id, qf.rating, qf.feedback, qf.timestamp,
                   qh.question, qh.final_answer
            FROM qa_feedback qf
            JOIN qa_history qh ON qf.question_id = qh.id
            ORDER BY qf.timestamp DESC
        """
        )
        hr_assistant = []
        for row in cursor.fetchall():
            hr_assistant.append(
                {
                    "id": row[0],
                    "question_id": row[1],
                    "rating": row[2],
                    "feedback": row[3],
                    "timestamp": row[4],
                    "question": row[5],
                    "answer": row[6],
                }
            )

        cursor.execute(
            """
            SELECT hf.id, hf.handbook_id, hf.rating, hf.comments, hf.timestamp,
                   rh.job_title, rh.oorwin_job_id, rh.markdown_content
            FROM handbook_feedback hf
            JOIN recruiter_handbooks rh ON hf.handbook_id = rh.id
            ORDER BY hf.timestamp DESC
        """
        )
        handbooks = []
        for row in cursor.fetchall():
            handbooks.append(
                {
                    "id": row[0],
                    "handbook_id": row[1],
                    "rating": row[2],
                    "comments": row[3],
                    "timestamp": row[4],
                    "job_title": row[5],
                    "oorwin_job_id": row[6],
                    "markdown_content": row[7],
                }
            )

        cursor.execute(
            """
            SELECT f.id, f.evaluation_id, f.rating, f.comments, f.timestamp,
                   e.filename, e.job_title, e.match_percentage, e.oorwin_job_id,
                   e.match_factors, e.profile_summary, e.missing_keywords,
                   e.job_stability, e.career_progression, e.technical_questions,
                   e.nontechnical_questions, e.behavioral_questions
            FROM feedback f
            JOIN evaluations e ON f.evaluation_id = e.id
            ORDER BY f.timestamp DESC
        """
        )
        evaluations = []
        for row in cursor.fetchall():
            evaluations.append(
                {
                    "id": row[0],
                    "evaluation_id": row[1],
                    "rating": row[2],
                    "comments": row[3],
                    "timestamp": row[4],
                    "filename": row[5],
                    "job_title": row[6],
                    "match_percentage": row[7],
                    "oorwin_job_id": row[8],
                    "match_factors": row[9],
                    "profile_summary": row[10],
                    "missing_keywords": row[11],
                    "job_stability": row[12],
                    "career_progression": row[13],
                    "technical_questions": row[14],
                    "nontechnical_questions": row[15],
                    "behavioral_questions": row[16],
                }
            )

        conn.close()

        return jsonify(
            {
                "success": True,
                "hr_assistant": hr_assistant,
                "handbooks": handbooks,
                "evaluations": evaluations,
            }
        )

    except Exception as e:
        logging.error("Error getting all feedback: %s", e)
        return jsonify({"success": False, "error": str(e)}), 500


@login_required
def check_feedback_exists(feedback_type, item_id):
    """Check if feedback already exists for a given item"""
    try:
        conn = sqlite3.connect(DATABASE_NAME)
        cursor = conn.cursor()

        if feedback_type == "qa":
            cursor.execute(
                "SELECT id FROM qa_feedback WHERE question_id = ?",
                (item_id,),
            )
        elif feedback_type == "handbook":
            cursor.execute(
                "SELECT id FROM handbook_feedback WHERE handbook_id = ?",
                (item_id,),
            )
        elif feedback_type == "evaluation":
            cursor.execute(
                "SELECT id FROM feedback WHERE evaluation_id = ?",
                (item_id,),
            )
        else:
            return jsonify({"success": False, "error": "Invalid feedback type"}), 400

        exists = cursor.fetchone() is not None
        conn.close()

        return jsonify({"success": True, "exists": exists})

    except Exception as e:
        logging.error("Error checking feedback: %s", e)
        return jsonify({"success": False, "error": str(e)}), 500


@login_required
def submit_handbook_feedback():
    """Submit feedback for a recruiter handbook"""
    try:
        data = request.get_json()

        if not data or "handbook_id" not in data or "rating" not in data:
            return (
                jsonify({"success": False, "error": "Missing handbook_id or rating"}),
                400,
            )

        handbook_id = data["handbook_id"]
        rating = data["rating"]
        comments = data.get("comments", "")

        if not isinstance(rating, int) or rating < 1 or rating > 5:
            return (
                jsonify(
                    {"success": False, "error": "Rating must be between 1 and 5"}
                ),
                400,
            )

        conn = sqlite3.connect(DATABASE_NAME)
        cursor = conn.cursor()

        cursor.execute(
            "SELECT id FROM handbook_feedback WHERE handbook_id = ?",
            (handbook_id,),
        )
        if cursor.fetchone():
            conn.close()
            return (
                jsonify(
                    {
                        "success": False,
                        "error": "Feedback already submitted for this handbook",
                    }
                ),
                400,
            )

        cursor.execute(
            """
            INSERT INTO handbook_feedback (handbook_id, rating, comments)
            VALUES (?, ?, ?)
        """,
            (handbook_id, rating, comments),
        )

        conn.commit()
        conn.close()

        return jsonify({"success": True, "message": "Feedback submitted successfully"})

    except sqlite3.IntegrityError:
        return (
            jsonify(
                {
                    "success": False,
                    "error": "Feedback already submitted for this handbook",
                }
            ),
            400,
        )
    except Exception as e:
        logging.error("Error submitting handbook feedback: %s", e)
        return jsonify({"success": False, "error": str(e)}), 500


@login_required
def submit_feedback():
    """Handle feedback for both Q&A and resume evaluations."""
    try:
        data = request.get_json()
        logging.info("Received feedback data: %s", data)

        if not data:
            logging.error("No feedback data received")
            return jsonify({"error": "No feedback data provided"}), 400

        conn = sqlite3.connect(DATABASE_NAME)
        cursor = conn.cursor()

        try:
            if "question" in data:
                if "rating" not in data:
                    return jsonify({"error": "Missing rating"}), 400

                cursor.execute(
                    """
                    SELECT id FROM qa_history 
                    WHERE question = ? 
                    ORDER BY timestamp DESC 
                    LIMIT 1
                """,
                    (data["question"],),
                )

                result = cursor.fetchone()
                if not result:
                    cursor.execute(
                        """
                        INSERT INTO qa_history (question, final_answer)
                        VALUES (?, ?)
                    """,
                        (data["question"], ""),
                    )
                    question_id = cursor.lastrowid
                else:
                    question_id = result[0]

                cursor.execute(
                    "SELECT id FROM qa_feedback WHERE question_id = ?",
                    (question_id,),
                )
                if cursor.fetchone():
                    return (
                        jsonify(
                            {"error": "Feedback already submitted for this question"}
                        ),
                        400,
                    )

                cursor.execute(
                    """
                    INSERT INTO qa_feedback (question_id, rating, feedback, timestamp)
                    VALUES (?, ?, ?, datetime('now'))
                """,
                    (question_id, data["rating"], data.get("feedback", "")),
                )

            else:
                if "evaluation_id" not in data or "rating" not in data:
                    return (
                        jsonify({"error": "Missing evaluation_id or rating"}),
                        400,
                    )

                cursor.execute(
                    "SELECT id FROM feedback WHERE evaluation_id = ?",
                    (data["evaluation_id"],),
                )
                if cursor.fetchone():
                    return (
                        jsonify(
                            {
                                "error": "Feedback already submitted for this evaluation"
                            }
                        ),
                        400,
                    )

                cursor.execute(
                    """
                    INSERT INTO feedback (evaluation_id, rating, comments, timestamp)
                    VALUES (?, ?, ?, datetime('now'))
                """,
                    (
                        data["evaluation_id"],
                        data["rating"],
                        data.get("comments", ""),
                    ),
                )

            conn.commit()
            return jsonify({"message": "Feedback submitted successfully"})

        finally:
            conn.close()

    except sqlite3.IntegrityError as e:
        logging.error("Integrity error in submit_feedback: %s", e)
        return jsonify({"error": "Feedback already submitted"}), 400
    except sqlite3.Error as e:
        logging.error("Database error in submit_feedback: %s", e)
        return jsonify({"error": "Database error occurred"}), 500
    except Exception as e:
        logging.error("Error in submit_feedback: %s", e)
        return jsonify({"error": "An unexpected error occurred"}), 500
