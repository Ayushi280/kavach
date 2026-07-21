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
from detection_log import init_db, log_detection, get_stats, get_alerts, get_fraud_graph

app = FastAPI(title="Kavach API")

# allow the browser frontend to call this API
app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])

kavach = KavachPipeline("model")   # loads MuRIL once at startup
init_db()                          # creates kavach_detections.db if missing


class Msg(BaseModel):
    text: str
    user_id: str = "demo_victim"   # so a detection can open a risk window for this user
    latitude: float = None         # real device GPS, sent by the app (with permission)
    longitude: float = None


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
    # and /fraud-graph with genuine data instead of mock numbers.
    log_detection(msg.user_id, result["is_scam"], result["confidence"],
                 result["active_tactics"],
                 result["extracted_payment_details"]["upi_ids"],
                 result["extracted_payment_details"]["account_numbers"],
                 language="en", latitude=msg.latitude, longitude=msg.longitude)
    return result


# --- REAL: audio scam check (the phone app / live mic sends chunks here) ---
@app.post("/check-audio")
async def check_audio(file: UploadFile = File(...), user_id: str = "demo_victim",
                       latitude: float = Form(None), longitude: float = Form(None)):
    """The phone app records ~5s of mic audio and POSTs it here, along with the
    device's GPS (latitude/longitude - the app must ask location permission
    and send real coordinates; if it doesn't, these stay null and that
    detection just won't show a pin on the Crime Map). Fast path: Whisper-only
    transcription (no IndicConformer / no deepfake) so a phone chunk gets a
    verdict quickly. Returns the same shape as /check (verdict, tactics,
    progression, transcript) and arms the payment circuit breaker on a
    confident scam - so the app's detection and money-blocking are one chain."""
    temp_path = f"_audio_chunk_{file.filename}"
    with open(temp_path, "wb") as f:
        f.write(await file.read())

    result = kavach.check_audio(temp_path, use_indic_asr=False, include_deepfake=False)

    if result["is_scam"] and result["scam_probability"] > 0.8:
        open_risk_session(user_id, reason="Scam detected in live call",
                          confidence=result["confidence"],
                          active_tactics=result["active_tactics"])
        result["risk_window_opened"] = True

    log_detection(user_id, result["is_scam"], result["confidence"],
                 result["active_tactics"],
                 result["extracted_payment_details"]["upi_ids"],
                 result["extracted_payment_details"]["account_numbers"],
                 language=result.get("language"), latitude=latitude, longitude=longitude)
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
    chunks, summary = analyze_long_audio(temp_path, max_chunks=max_chunks or None)
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