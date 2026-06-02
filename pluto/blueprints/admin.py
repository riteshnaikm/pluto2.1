"""Admin panel page and API routes."""

import logging
import sqlite3

from flask import Blueprint, jsonify, render_template, request, session

from pluto.auth_decorators import login_required, role_required
from pluto.users_db import DATABASE_NAME, get_accessible_users


def register_admin_routes(app):
    bp = Blueprint("admin", __name__)

    @bp.route("/admin", endpoint="admin_panel")
    @login_required
    @role_required("Admin")
    def admin_panel():
        return render_template("admin.html")

    @bp.route("/api/admin/users", methods=["GET"], endpoint="get_all_users")
    @login_required
    @role_required("Admin")
    def get_all_users():
        try:
            conn = sqlite3.connect(DATABASE_NAME)
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT email, name, role, team, manager_email, created_at
                FROM users
                ORDER BY created_at DESC
                """
            )
            users = [
                {
                    "email": row[0],
                    "name": row[1],
                    "role": row[2],
                    "team": row[3],
                    "manager_email": row[4],
                    "created_at": row[5],
                }
                for row in cursor.fetchall()
            ]
            conn.close()
            return jsonify({"success": True, "users": users})
        except Exception as e:
            logging.error("Error fetching users: %s", e)
            return jsonify({"success": False, "error": str(e)}), 500

    @bp.route("/api/admin/users", methods=["POST"], endpoint="update_user")
    @login_required
    @role_required("Admin")
    def update_user():
        try:
            data = request.json
            email = data.get("email")
            role = data.get("role")
            team = data.get("team")
            manager_email = data.get("manager_email")
            name = data.get("name")

            conn = sqlite3.connect(DATABASE_NAME)
            cursor = conn.cursor()
            cursor.execute(
                """
                UPDATE users
                SET role = ?, team = ?, manager_email = ?, name = ?, updated_at = CURRENT_TIMESTAMP
                WHERE email = ?
                """,
                (role, team, manager_email, name, email),
            )
            conn.commit()
            conn.close()
            return jsonify({"success": True, "message": "User updated successfully"})
        except Exception as e:
            logging.error("Error updating user: %s", e)
            return jsonify({"success": False, "error": str(e)}), 500

    @bp.route("/api/admin/users/<email>", methods=["DELETE"], endpoint="delete_user")
    @login_required
    @role_required("Admin")
    def delete_user(email):
        try:
            conn = sqlite3.connect(DATABASE_NAME)
            cursor = conn.cursor()
            cursor.execute("DELETE FROM users WHERE email = ?", (email,))
            conn.commit()
            conn.close()
            return jsonify({"success": True, "message": "User deleted successfully"})
        except Exception as e:
            logging.error("Error deleting user: %s", e)
            return jsonify({"success": False, "error": str(e)}), 500

    @bp.route("/api/admin/teams", methods=["GET"], endpoint="get_teams")
    @login_required
    def get_teams():
        teams = ["ITS", "OSS", "PCS", "ISV", "Core"]
        return jsonify({"success": True, "teams": teams})

    @bp.route("/api/admin/roles", methods=["GET"], endpoint="get_roles")
    @login_required
    def get_roles():
        roles = ["Admin", "Business Manager", "Anchors", "Recruiter"]
        return jsonify({"success": True, "roles": roles})

    @bp.route("/api/admin/accessible-users", methods=["GET"], endpoint="get_accessible_users_api")
    @login_required
    def get_accessible_users_api():
        user_email = session["user"].get("email")
        users = get_accessible_users(user_email)
        return jsonify({"success": True, "users": users})

    app.register_blueprint(bp)
