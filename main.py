"""
Kavach - Backend API (FastAPI)
==============================
Wraps the KavachPipeline (MuRIL model) as an HTTP API the frontend + bot call.

Run:  uvicorn main:app --reload
Docs: http://localhost:8000/docs

Endpoints:
  POST /check        -> real scam detection {is_scam, verdict, confidence}
  GET  /stats        -> dashboard numbers (REAL - counted from logged detections)
  GET  /alerts       -> live scam alerts feed (REAL - actual recent detections)
  GET  /fraud-graph  -> fraud network nodes + links (REAL - built from harvested
                        UPI/account details; see detection_log.py for the
                        honesty note on what the "scammer" node represents)
"""

import os
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from kavach_pipeline import KavachPipeline
from guardian_voice import generate_voice
from family_alert import send_family_alert
from honeypot_agent import run_demo_conversation
from deepfake_detector import detect_deepfake, analyze_long_audio
from risk_session import (open_risk_session, get_risk_status,
                          clear_risk_session, evaluate_payment)
from detection_log import (init_db, log_detection, update_detection, get_stats,
                           get_alerts, get_fraud_graph, generate_incident_report,
                           set_scammer_phone)

app = FastAPI(title="Kavach API")

# allow the browser frontend to call this API
app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])

kavach = KavachPipeline("model")   # loads MuRIL once at startup
init_db()                          # creates kavach_detections.db if missing

# In-memory live-call sessions. Keyed by a session_id the app generates once
# per call (crypto.randomUUID on "Start Protection"). Each holds the running
# transcript for that call + the single detection row id it maps to, so one
# call = ONE incident that grows as more chunks arrive - instead of every 12s
# chunk becoming its own disconnected row. Cleared when the call ends or the
# server restarts (fine - this is live-call state, not durable data).
_live_sessions = {}


class Msg(BaseModel):
    text: str
    user_id: str = "demo_victim"   # so a detection can open a risk window for this user
    latitude: float = None         # real device GPS, sent by the app (with permission)
    longitude: float = None
    log_to_dashboard: bool = True  # the app's privacy toggle - False skips detection_log
                                   # entirely (no row saved -> won't appear in /stats,
                                   # /alerts, or /fraud-graph). Detection + protection
                                   # (circuit breaker, family alert) still work either way -
                                   # this ONLY controls whether the event is remembered
                                   # for the dashboard/graph.
    scammer_phone: str = None      # OPTIONAL, USER-TYPED - the number the victim sees on
                                   # their own phone's call screen. Kavach never reads this
                                   # from audio; it's purely what the human enters, used to
                                   # build the incident-report helper.


class PhoneReport(BaseModel):
    scammer_phone: str


class PaymentIntent(BaseModel):
    user_id: str = "demo_victim"
    amount: float
    payee: str = None
    new_payee: bool = False


class VoiceRequest(BaseModel):
    language: str = "en"
    tactics: dict = None


class FamilyAlertRequest(BaseModel):
    victim_id: str = "demo_victim"
    victim_name: str = "Your family member"
    active_tactics: list = None
    confidence: float = None
    location: str = None
    extracted_payment_details: dict = None   # {"upi_ids": [...], "account_numbers": [...]}


@app.get("/")
def home():
    return {"status": "Kavach API is running"}


# --- REAL: scam detection (also arms the payment circuit breaker) ---
@app.post("/check")
def check(msg: Msg):
    result = kavach.check_text(msg.text)
    # If this is a confident scam, open a high-risk window for the user so the
    # payment circuit breaker activates automatically - no manual toggle.
    if result["is_scam"] and result["scam_probability"] > 0.8:
        open_risk_session(msg.user_id,
                          reason="Scam detected in call/message",
                          confidence=result["confidence"],
                          active_tactics=result["active_tactics"])
        result["risk_window_opened"] = True

    # REAL persistence - every check becomes a row, feeding /stats, /alerts,
    # and /fraud-graph with genuine data instead of mock numbers. Skipped
    # entirely if the user has the privacy toggle off - detection and
    # protection above already happened either way.
    if msg.log_to_dashboard:
        detection_id = log_detection(msg.user_id, result["is_scam"], result["confidence"],
                     result["active_tactics"],
                     result["extracted_payment_details"]["upi_ids"],
                     result["extracted_payment_details"]["account_numbers"],
                     language="en", latitude=msg.latitude, longitude=msg.longitude,
                     scammer_phone=msg.scammer_phone)
        result["detection_id"] = detection_id  # save this - needed for
                                               # /report-phone/{id} and /incident-report/{id}
    return result


# --- REAL: audio scam check (the phone app / live mic sends chunks here) ---
@app.post("/check-audio")
async def check_audio(file: UploadFile = File(...), user_id: str = "demo_victim",
                       latitude: float = Form(None), longitude: float = Form(None),
                       log_to_dashboard: bool = Form(True),
                       scammer_phone: str = Form(None),
                       session_id: str = Form(None)):
    """The phone app records ~5s of mic audio and POSTs it here, along with the
    device's GPS (latitude/longitude - the app must ask location permission
    and send real coordinates; if it doesn't, these stay null and that
    detection just won't show a pin on the Crime Map). Fast path: Whisper-only
    transcription (no IndicConformer / no deepfake) so a phone chunk gets a
    verdict quickly. Returns the same shape as /check (verdict, tactics,
    progression, transcript) and arms the payment circuit breaker on a
    confident scam - so the app's detection and money-blocking are one chain.

    log_to_dashboard=False is the app's privacy toggle - the audio itself is
    NEVER kept either way (see the finally block below), this only controls
    whether the resulting VERDICT gets saved for the dashboard/fraud graph."""
    temp_path = f"_audio_chunk_{file.filename}"
    with open(temp_path, "wb") as f:
        f.write(await file.read())

    try:
        # Transcribe THIS chunk only (fast Whisper path).
        chunk_result = kavach.check_audio(temp_path, use_indic_asr=False,
                                          include_deepfake=False)
    finally:
        # Privacy: raw audio deleted the instant we're done with it.
        if os.path.exists(temp_path):
            os.remove(temp_path)

    chunk_text = chunk_result.get("transcript", "")
    language = chunk_result.get("language")

    # --- SESSION ACCUMULATION ---
    # If the app sent a session_id, build up the WHOLE call's transcript and
    # run detection on all of it - so a UPI/account spoken in a late chunk is
    # caught and attached to the same incident as the earlier tactics. Without
    # a session_id we fall back to per-chunk behavior.
    if session_id:
        sess = _live_sessions.setdefault(session_id,
                                         {"transcript": "", "detection_id": None})
        sess["transcript"] = (sess["transcript"] + " " + chunk_text).strip()
        text_to_check = sess["transcript"]
    else:
        text_to_check = chunk_text

    result = kavach.check_text(text_to_check) if text_to_check else chunk_result
    result["transcript"] = text_to_check
    result["language"] = language

    if result["is_scam"] and result["scam_probability"] > 0.8:
        open_risk_session(user_id, reason="Scam detected in live call",
                          confidence=result["confidence"],
                          active_tactics=result["active_tactics"])
        result["risk_window_opened"] = True

    if log_to_dashboard:
        upis = result["extracted_payment_details"]["upi_ids"]
        accts = result["extracted_payment_details"]["account_numbers"]
        if session_id:
            sess = _live_sessions[session_id]
            if sess["detection_id"] is None:
                # Create the single incident row for this call the first time
                # it looks like a scam - avoids logging pure-safe chatter.
                if result["is_scam"]:
                    sess["detection_id"] = log_detection(
                        user_id, True, result["confidence"], result["active_tactics"],
                        upis, accts, language=language, latitude=latitude,
                        longitude=longitude, scammer_phone=scammer_phone)
            else:
                # Update the same row as the call continues (tactics grow, and a
                # later-spoken UPI/account now attaches to THIS incident).
                update_detection(sess["detection_id"], result["is_scam"],
                                 result["confidence"], result["active_tactics"],
                                 upis, accts, language=language)
            result["detection_id"] = sess["detection_id"]
        else:
            result["detection_id"] = log_detection(
                user_id, result["is_scam"], result["confidence"],
                result["active_tactics"], upis, accts, language=language,
                latitude=latitude, longitude=longitude, scammer_phone=scammer_phone)
    return result


# --- REAL: payment circuit breaker - the money-stopping decision ---
@app.post("/payment-intent")
def payment_intent(intent: PaymentIntent):
    """A UPI/payment app calls this BEFORE sending money. Returns ALLOW or
    HOLD (with a cooldown) based on whether the user is in an active scam-risk
    window. This is the real circuit breaker - driven by detection, not a toggle."""
    return evaluate_payment(intent.user_id, intent.amount,
                            intent.payee, intent.new_payee)


@app.get("/risk-status/{user_id}")
def risk_status(user_id: str):
    return get_risk_status(user_id)


@app.post("/clear-risk/{user_id}")
def clear_risk(user_id: str):
    """Victim hung up / confirmed safe - close the risk window."""
    return clear_risk_session(user_id)


# --- REAL: Guardian Voice - spoken warning in the victim's language ---
@app.post("/guardian-voice")
def guardian_voice(req: VoiceRequest):
    path = generate_voice(req.language, req.tactics, out_path="_guardian_out.mp3")
    return FileResponse(path, media_type="audio/mpeg", filename="guardian_warning.mp3")


# --- REAL: Family Alert - notifies a registered family contact on Telegram ---
@app.post("/family-alert")
def family_alert(req: FamilyAlertRequest):
    return send_family_alert(req.victim_id, req.victim_name,
                              req.active_tactics, req.confidence, req.location,
                              req.extracted_payment_details)


# --- RESEARCH PROTOTYPE: Scam-baiting Honeypot (LITE, scripted demo only) ---
@app.get("/honeypot-demo")
def honeypot_demo():
    transcript, extracted = run_demo_conversation()
    return {"transcript": transcript, "extracted": extracted}


# --- REAL: Deepfake/AI-voice detection (pre-trained model) ---
@app.post("/deepfake-check")
async def deepfake_check(file: UploadFile = File(...), max_chunks: int = 6):
    """Upload an audio clip (short OR long - long recordings are auto-chunked
    into ~10s pieces, since the underlying model was only trained on 2.5-13s
    clips). max_chunks=6 by default (~first 60s) for a fast result; pass a
    higher number (or omit by setting to 0 for "no cap") for full coverage -
    slower, since CPU inference on each chunk takes real time."""
    temp_path = f"_deepfake_upload_{file.filename}"
    with open(temp_path, "wb") as f:
        f.write(await file.read())
    try:
        chunks, summary = analyze_long_audio(temp_path, max_chunks=max_chunks or None)
    finally:
        # Same privacy guarantee as /check-audio - delete the raw audio
        # immediately, don't keep it around after analysis.
        if os.path.exists(temp_path):
            os.remove(temp_path)
    return {"chunks": chunks, "summary": summary}


# --- REAL: dashboard stats - counted from actual logged detections ---
@app.get("/stats")
def stats():
    return get_stats()


# --- REAL: live scam alerts feed - actual recent detections, newest first ---
@app.get("/alerts")
def alerts(limit: int = 10):
    return get_alerts(limit)


# --- REAL: fraud network graph - built from harvested UPI/account details
# across every real scam detection (see detection_log.get_fraud_graph for
# the honesty note on what "scammer" node means here) ---
@app.get("/fraud-graph")
def fraud_graph():
    return get_fraud_graph()


# --- REAL: attach the caller's number to a detection AFTER the call ends -
# e.g. at the "End & Report" step, once the user has time to type it in from
# their own call screen. Kavach never extracts this itself (see main docstring
# in detection_log.py) - it is always human-entered. ---
@app.post("/report-phone/{detection_id}")
def report_phone(detection_id: int, req: PhoneReport):
    set_scammer_phone(detection_id, req.scammer_phone)
    return {"detection_id": detection_id, "scammer_phone": req.scammer_phone, "saved": True}


# --- REAL: builds a complaint-helper summary for filing at cybercrime.gov.in
# / the local police (1930 helpline) - a DRAFT, not an actual submitted FIR.
# See generate_incident_report()'s docstring for the exact honesty framing. ---
@app.get("/incident-report/{detection_id}")
def incident_report(detection_id: int):
    report = generate_incident_report(detection_id)
    if report is None:
        return {"error": f"no detection found with id {detection_id}"}
    return report
