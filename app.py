from __future__ import annotations

import os
import sqlite3
from datetime import datetime
from functools import wraps
from pathlib import Path

from flask import (
    Flask,
    flash,
    g,
    redirect,
    render_template,
    request,
    session,
    url_for,
)
from werkzeug.security import check_password_hash, generate_password_hash

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "ntport.db"

app = Flask(__name__)
app.config.update(
    SECRET_KEY=os.environ.get("SECRET_KEY", "dev-change-this-secret"),
    DATABASE=str(DB_PATH),
)


def get_db() -> sqlite3.Connection:
    if "db" not in g:
        g.db = sqlite3.connect(app.config["DATABASE"])
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(_error: Exception | None) -> None:
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db() -> None:
    db = get_db()
    db.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL,
            full_name TEXT,
            role TEXT DEFAULT 'Operator'
        );

        CREATE TABLE IF NOT EXISTS activity (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
        """
    )
    db.commit()


@app.before_request
def ensure_database() -> None:
    init_db()


@app.context_processor
def inject_user() -> dict:
    user = None
    user_id = session.get("user_id")
    if user_id:
        user = get_db().execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return {"current_user": user, "year": datetime.utcnow().year}


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if "user_id" not in session:
            flash("Please log in to access NTPORT.", "warning")
            return redirect(url_for("login"))
        return view(*args, **kwargs)

    return wrapped


@app.route("/")
def landing():
    return render_template("landing.html")


@app.route("/signup", methods=["GET", "POST"])
def signup():
    if request.method == "POST":
        username = request.form.get("username", "").strip().lower()
        password = request.form.get("password", "")
        full_name = request.form.get("full_name", "").strip()

        if len(username) < 3:
            flash("Username must be at least 3 characters.", "error")
        elif len(password) < 8:
            flash("Password must be at least 8 characters.", "error")
        else:
            db = get_db()
            exists = db.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
            if exists:
                flash("This username is already taken.", "error")
            else:
                hashed = generate_password_hash(password)
                db.execute(
                    "INSERT INTO users (username, password_hash, created_at, full_name) VALUES (?, ?, ?, ?)",
                    (username, hashed, datetime.utcnow().isoformat(), full_name or None),
                )
                db.commit()
                flash("Account created. You can now log in.", "success")
                return redirect(url_for("login"))

    return render_template("signup.html")


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username", "").strip().lower()
        password = request.form.get("password", "")
        db = get_db()
        user = db.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()

        if not user or not check_password_hash(user["password_hash"], password):
            flash("Invalid username or password.", "error")
        else:
            session.clear()
            session["user_id"] = user["id"]
            session.permanent = True

            db.execute(
                "INSERT INTO activity (user_id, title, description, created_at) VALUES (?, ?, ?, ?)",
                (
                    user["id"],
                    "Secure Login",
                    "Authenticated from NTPORT credential gateway.",
                    datetime.utcnow().isoformat(),
                ),
            )
            db.commit()
            flash("Welcome back to NTPORT.", "success")
            return redirect(url_for("dashboard"))

    return render_template("login.html")


@app.route("/logout", methods=["POST"])
@login_required
def logout():
    session.clear()
    flash("You have been logged out.", "success")
    return redirect(url_for("landing"))


@app.route("/dashboard")
@login_required
def dashboard():
    db = get_db()
    user_id = session["user_id"]
    user = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    activities = db.execute(
        "SELECT * FROM activity WHERE user_id = ? ORDER BY created_at DESC LIMIT 6", (user_id,)
    ).fetchall()

    metrics = {
        "uptime": "99.987%",
        "active_integrations": 14,
        "security_score": 96,
        "latency": "31ms",
    }

    return render_template("dashboard.html", user=user, activities=activities, metrics=metrics)


@app.route("/profile")
@login_required
def profile():
    user = get_db().execute("SELECT * FROM users WHERE id = ?", (session["user_id"],)).fetchone()
    return render_template("profile.html", user=user)


@app.route("/settings", methods=["GET", "POST"])
@login_required
def settings():
    db = get_db()
    user = db.execute("SELECT * FROM users WHERE id = ?", (session["user_id"],)).fetchone()

    if request.method == "POST":
        full_name = request.form.get("full_name", "").strip()
        role = request.form.get("role", "").strip() or "Operator"

        db.execute(
            "UPDATE users SET full_name = ?, role = ? WHERE id = ?",
            (full_name or None, role, session["user_id"]),
        )
        db.execute(
            "INSERT INTO activity (user_id, title, description, created_at) VALUES (?, ?, ?, ?)",
            (
                session["user_id"],
                "Profile Updated",
                "Updated personal settings and dashboard identity metadata.",
                datetime.utcnow().isoformat(),
            ),
        )
        db.commit()
        flash("Settings saved.", "success")
        return redirect(url_for("settings"))

    return render_template("settings.html", user=user)


if __name__ == "__main__":
    app.run(debug=True)
