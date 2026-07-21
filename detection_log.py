"""
Kavach - Detection Log (real persistence)
==========================================
Every real scam check (from /check or /check-audio) gets saved here. This is
what makes /stats, /alerts, and /fraud-graph REAL instead of the old
random.randint() mock data - they now count and display detections that
actually happened, not made-up numbers.

Uses SQLite - built into Python, zero extra installs, one file on disk
(kavach_detections.db). Plenty for a hackathon demo's write volume. A real
production deployment would swap this for Postgres, but every function below
keeps the same shape either way, so that swap wouldn't touch main.py at all.
"""

import sqlite3
import json
import datetime
import os

DB_PATH = os.environ.get("KAVACH_DB_PATH", "kavach_detections.db")


def _connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Creates the table if it doesn't exist yet. Call once at API startup."""
    conn = _connect()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS detections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            user_id TEXT NOT NULL,
            is_scam INTEGER NOT NULL,
            confidence REAL,
            active_tactics TEXT,
            upi_ids TEXT,
            account_numbers TEXT,
            language TEXT,
            latitude REAL,
            longitude REAL
        )
    """)
    conn.commit()
    conn.close()


def log_detection(user_id, is_scam, confidence=None, active_tactics=None,
                   upi_ids=None, account_numbers=None, language=None,
                   latitude=None, longitude=None):
    """Saves one real check result. Called from /check and /check-audio right
    after kavach.check_text() / check_audio() runs - every call Kavach
    evaluates becomes one real row here."""
    conn = _connect()
    conn.execute(
        """INSERT INTO detections
           (timestamp, user_id, is_scam, confidence, active_tactics,
            upi_ids, account_numbers, language, latitude, longitude)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (datetime.datetime.utcnow().isoformat(), user_id, int(bool(is_scam)),
         confidence, json.dumps(active_tactics or []),
         json.dumps(upi_ids or []), json.dumps(account_numbers or []),
         language, latitude, longitude),
    )
    conn.commit()
    conn.close()


def get_stats():
    """Real dashboard numbers, counted from actual logged rows."""
    conn = _connect()
    total = conn.execute("SELECT COUNT(*) c FROM detections").fetchone()["c"]
    scams = conn.execute("SELECT COUNT(*) c FROM detections WHERE is_scam=1").fetchone()["c"]
    today = datetime.datetime.utcnow().date().isoformat()
    scams_today = conn.execute(
        "SELECT COUNT(*) c FROM detections WHERE is_scam=1 AND timestamp LIKE ?",
        (f"{today}%",)).fetchone()["c"]
    victims = conn.execute(
        "SELECT COUNT(DISTINCT user_id) c FROM detections WHERE is_scam=1").fetchone()["c"]
    conn.close()
    return {
        "active_threats": scams,        # total scam detections ever logged
        "blocked_today": scams_today,   # scam detections logged today (UTC)
        "victims_protected": victims,   # distinct users with >=1 scam caught
        "total_checks": total,          # every check run, scam or safe
    }


def get_alerts(limit=10):
    """Real recent scam detections, most recent first."""
    conn = _connect()
    rows = conn.execute(
        "SELECT * FROM detections WHERE is_scam=1 ORDER BY id DESC LIMIT ?",
        (limit,)).fetchall()
    conn.close()
    out = []
    for r in rows:
        out.append({
            "id": r["id"],
            "user_id": r["user_id"],
            "confidence": r["confidence"],
            "active_tactics": json.loads(r["active_tactics"] or "[]"),
            "language": r["language"],
            "location": ({"lat": r["latitude"], "lng": r["longitude"]}
                         if r["latitude"] is not None else None),
            "time": r["timestamp"],
        })
    return out


def get_fraud_graph():
    """Builds real nodes/edges from harvested payment details across every
    logged scam detection. The more real calls Kavach catches, the bigger and
    more accurate this graph gets - no fake/hardcoded nodes.

    Honesty note (say this in the demo/pitch): the 'scammer' node represents
    a DETECTED CALL EVENT, not a verified phone number - the pipeline doesn't
    capture caller ID today. Mule nodes ARE fully real - they're the actual
    UPI IDs / account numbers the scammer said out loud, harvested live by
    the honeypot extraction in kavach_pipeline.check_text()."""
    conn = _connect()
    rows = conn.execute(
        "SELECT * FROM detections WHERE is_scam=1 ORDER BY id").fetchall()
    conn.close()

    nodes = {}
    links = []
    for r in rows:
        call_node = f"call_{r['id']}"
        victim_node = f"victim_{r['user_id']}"
        nodes[call_node] = {"id": call_node, "label": f"Detected call #{r['id']}", "type": "scammer"}
        nodes[victim_node] = {"id": victim_node, "label": r["user_id"], "type": "victim"}
        links.append({"source": call_node, "target": victim_node})

        for upi in json.loads(r["upi_ids"] or "[]"):
            mule_node = f"mule_{upi}"
            nodes[mule_node] = {"id": mule_node, "label": upi, "type": "mule"}
            links.append({"source": call_node, "target": mule_node})

        for acct in json.loads(r["account_numbers"] or "[]"):
            mule_node = f"mule_{acct}"
            nodes[mule_node] = {"id": mule_node, "label": f"Acct ...{acct[-4:]}", "type": "mule"}
            links.append({"source": call_node, "target": mule_node})

    return {"nodes": list(nodes.values()), "links": links}