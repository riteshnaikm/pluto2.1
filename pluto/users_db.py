"""User and team access helpers (SQLite)."""

import os
import sqlite3

DATABASE_NAME = os.getenv("DATABASE_NAME", "combined_db.db")


def get_user_info(email):
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    cursor.execute(
        "SELECT email, name, role, team, manager_email FROM users WHERE email = ?",
        (email,),
    )
    user = cursor.fetchone()
    conn.close()

    if user:
        return {
            "email": user[0],
            "name": user[1],
            "role": user[2],
            "team": user[3],
            "manager_email": user[4],
        }
    return None


def create_or_update_user(email, name):
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT OR REPLACE INTO users (email, name, role, updated_at)
        VALUES (?, ?, COALESCE((SELECT role FROM users WHERE email = ?), 'Recruiter'), CURRENT_TIMESTAMP)
        """,
        (email, name, email),
    )
    conn.commit()
    conn.close()


def get_accessible_users(current_user_email):
    user_info = get_user_info(current_user_email)
    if not user_info:
        return []

    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    team = user_info["team"]

    if not team:
        cursor.execute("SELECT email, name, role, team FROM users ORDER BY name")
    else:
        cursor.execute(
            """
            SELECT email, name, role, team FROM users
            WHERE team = ?
            ORDER BY name
            """,
            (team,),
        )

    users = cursor.fetchall()
    conn.close()
    return [{"email": u[0], "name": u[1], "role": u[2], "team": u[3]} for u in users]


def get_accessible_user_emails(current_user_email):
    return [u["email"] for u in get_accessible_users(current_user_email)]


def filter_data_by_role(query, table_name, user_email_column, current_user_email):
    user_info = get_user_info(current_user_email)
    if not user_info:
        return query + " WHERE 1=0"

    accessible_emails = get_accessible_user_emails(current_user_email)
    if not accessible_emails:
        return query + " WHERE 1=0"

    placeholders = ",".join(["?"] * len(accessible_emails))
    if "WHERE" in query.upper():
        return f"{query} AND {user_email_column} IN ({placeholders})"
    return f"{query} WHERE {user_email_column} IN ({placeholders})"
