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
    """Creates the table if it doesn't exist yet, and adds newer columns to
    existing databases (ALTER TABLE) so upgrading never loses old data."""
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
    # Migration: scammer_phone is a HUMAN-ENTERED field (the victim reads it
    # off their own phone's incoming-call screen) - NOT something Kavach
    # extracts from audio. We are explicit about that distinction everywhere
    # this field is used, so the app never implies it auto-identifies callers.
    try:
        conn.execute("ALTER TABLE detections ADD COLUMN scammer_phone TEXT")
    except sqlite3.OperationalError:
        pass  # column already exists - fine, this runs on every startup
    conn.commit()
    conn.close()


def log_detection(user_id, is_scam, confidence=None, active_tactics=None,
                   upi_ids=None, account_numbers=None, language=None,
                   latitude=None, longitude=None, scammer_phone=None):
    """Saves one real check result. Called from /check and /check-audio right
    after kavach.check_text() / check_audio() runs - every call Kavach
    evaluates becomes one real row here.

    scammer_phone: optional, USER-ENTERED number the call came from (visible
    on the victim's own phone screen - Kavach cannot read this from audio).
    Lets the app compile a complaint/report worth taking to cybercrime.gov.in
    or the local police, even though Kavach itself never identifies callers."""
    conn = _connect()
    cur = conn.execute(
        """INSERT INTO detections
           (timestamp, user_id, is_scam, confidence, active_tactics,
            upi_ids, account_numbers, language, latitude, longitude, scammer_phone)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (datetime.datetime.utcnow().isoformat(), user_id, int(bool(is_scam)),
         confidence, json.dumps(active_tactics or []),
         json.dumps(upi_ids or []), json.dumps(account_numbers or []),
         language, latitude, longitude, scammer_phone),
    )
    conn.commit()
    new_id = cur.lastrowid
    conn.close()
    return new_id  # so the caller (main.py) can hand this id back to the
                   # frontend, which needs it for /incident-report/{id} and
                   # /report-phone/{id} later in the same call session


def update_detection(detection_id, is_scam, confidence=None, active_tactics=None,
                     upi_ids=None, account_numbers=None, language=None):
    """Updates an existing detection row (used by the live-call session logic:
    one incident per call, updated as more of the call is heard - so tactics
    from early chunks and a UPI/account said in a later chunk all attach to the
    SAME incident instead of scattering across many rows). Leaves scammer_phone
    and location untouched (those were set at creation / via /report-phone)."""
    conn = _connect()
    conn.execute(
        """UPDATE detections
           SET is_scam=?, confidence=?, active_tactics=?, upi_ids=?,
               account_numbers=?, language=?
           WHERE id=?""",
        (int(bool(is_scam)), confidence, json.dumps(active_tactics or []),
         json.dumps(upi_ids or []), json.dumps(account_numbers or []),
         language, detection_id),
    )
    conn.commit()
    conn.close()


def get_detection(detection_id):
    """Fetches one full row by id - used to build the incident report."""
    conn = _connect()
    row = conn.execute("SELECT * FROM detections WHERE id=?", (detection_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def set_scammer_phone(detection_id, scammer_phone):
    """Lets the user attach the caller's number AFTER the fact too (e.g. at
    the 'End & Report' step in Live Protection, once the call has ended and
    they're filling in what they saw on their call screen)."""
    conn = _connect()
    conn.execute("UPDATE detections SET scammer_phone=? WHERE id=?",
                 (scammer_phone, detection_id))
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
            "scammer_phone": r["scammer_phone"],  # None unless the user entered it
            "upi_ids": json.loads(r["upi_ids"] or "[]"),
            "account_numbers": json.loads(r["account_numbers"] or "[]"),
        })
    return out


def get_fraud_graph():
    """Builds real nodes/edges from harvested payment details across every
    logged scam detection. The more real calls Kavach catches, the bigger and
    more accurate this graph gets - no fake/hardcoded nodes.

    Honesty note (say this in the demo/pitch): the 'scammer' node represents
    a DETECTED CALL EVENT, not a verified phone number - the pipeline doesn't
    capture caller ID today (we don't claim to identify the culprit). Mule
    nodes ARE fully real - they're the actual UPI IDs / account numbers the
    scammer said out loud, captured passively by extract_payment_details() in
    kavach_pipeline.check_text()."""
    conn = _connect()
    rows = conn.execute(
        "SELECT * FROM detections WHERE is_scam=1 ORDER BY id").fetchall()
    conn.close()

    nodes = {}
    links = []
    for r in rows:
        call_node = f"call_{r['id']}"
        victim_node = f"victim_{r['user_id']}"
        # If the user reported the caller's number, show it - but always
        # marked "(reported)" so nobody mistakes it for Kavach having
        # detected/verified it itself. That distinction matters for honesty.
        if r["scammer_phone"]:
            call_label = f"{r['scammer_phone']} (reported)"
        else:
            call_label = f"Detected call #{r['id']}"
        nodes[call_node] = {"id": call_node, "label": call_label, "type": "scammer"}
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


def generate_incident_report(detection_id):
    """Builds a plain-text complaint-helper summary for one detection - the
    kind of structured facts a victim/family would need to file a report at
    cybercrime.gov.in or a local police station (an FIR).

    IMPORTANT HONESTY NOTE: this is a DRAFT/HELPER, not an actual filed FIR -
    Kavach has no integration with police systems. It just organizes the real
    facts Kavach captured so the human filing the complaint doesn't have to
    reconstruct the call from memory under stress. Returns None if the id
    doesn't exist."""
    row = get_detection(detection_id)
    if not row:
        return None

    upi_ids = json.loads(row["upi_ids"] or "[]")
    accounts = json.loads(row["account_numbers"] or "[]")
    tactics = json.loads(row["active_tactics"] or "[]")

    lines = [
        "KAVACH INCIDENT SUMMARY (complaint draft - not an official filed FIR)",
        "=" * 60,
        f"Date/time of detection (UTC): {row['timestamp']}",
        f"Reported by (app user id): {row['user_id']}",
        f"Caller's number (as entered by the user - not verified by Kavach): "
        f"{row['scammer_phone'] or 'not provided'}",
        f"Kavach confidence this was a scam: "
        f"{round((row['confidence'] or 0) * 100)}%",
        f"Manipulation tactics detected: {', '.join(tactics) or 'none logged'}",
    ]
    if upi_ids:
        lines.append(f"UPI ID(s) the caller asked payment to be sent to: {', '.join(upi_ids)}")
    if accounts:
        lines.append(f"Bank account number(s) the caller mentioned: {', '.join(accounts)}")
    if row["latitude"] is not None:
        lines.append(f"Approx. location at time of call: {row['latitude']}, {row['longitude']}")
    lines.append("")
    lines.append("Suggested next step: file this at cybercrime.gov.in or call 1930 "
                 "(India's cyber-crime helpline), and share the UPI/account number(s) "
                 "above so the bank can be asked to freeze them.")

    return {
        "detection_id": row["id"],
        "report_text": "\n".join(lines),
        "scammer_phone": row["scammer_phone"],
        "upi_ids": upi_ids,
        "account_numbers": accounts,
        "active_tactics": tactics,
        "confidence": row["confidence"],
        "timestamp": row["timestamp"],
    }
