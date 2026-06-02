import sqlite3

DATABASE_NAME = "combined_db.db"

INDEX_STATEMENTS = [
    "CREATE INDEX IF NOT EXISTS idx_eval_user_email ON evaluations(user_email)",
    "CREATE INDEX IF NOT EXISTS idx_eval_job_id ON evaluations(oorwin_job_id)",
    "CREATE INDEX IF NOT EXISTS idx_eval_timestamp ON evaluations(timestamp)",
    "CREATE INDEX IF NOT EXISTS idx_hb_user_email ON recruiter_handbooks(user_email)",
    "CREATE INDEX IF NOT EXISTS idx_hb_job_id ON recruiter_handbooks(oorwin_job_id)",
    "CREATE INDEX IF NOT EXISTS idx_hb_timestamp ON recruiter_handbooks(timestamp)",
    "CREATE INDEX IF NOT EXISTS idx_feedback_eval ON feedback(evaluation_id)",
    "CREATE INDEX IF NOT EXISTS idx_hbfeedback ON handbook_feedback(handbook_id)",
    "CREATE INDEX IF NOT EXISTS idx_qa_history_ts ON qa_history(timestamp)",
    "CREATE INDEX IF NOT EXISTS idx_iq_eval ON interview_questions(evaluation_id)",
    "CREATE INDEX IF NOT EXISTS idx_users_team ON users(team)",
    "CREATE INDEX IF NOT EXISTS idx_users_manager ON users(manager_email)",
]


def apply_sqlite_pragmas(conn: sqlite3.Connection) -> None:
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute("PRAGMA foreign_keys=ON")


def ensure_indexes(cursor) -> None:
    for stmt in INDEX_STATEMENTS:
        cursor.execute(stmt)


def connect_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DATABASE_NAME)
    apply_sqlite_pragmas(conn)
    return conn
