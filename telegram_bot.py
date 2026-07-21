"""
Kavach - Telegram Fraud Shield Bot (MuRIL, multilingual)
---------------------------------------------------------
Users forward a suspicious message/call text and the bot replies whether
it is a SCAM or SAFE, using the fine-tuned MuRIL model (8 Indian languages).

Runs anywhere with internet (long polling - no public URL needed).

Before running:
  1. Get a bot token from @BotFather on Telegram.
  2. Point MODEL_PATH at the saved kavach_muril folder.
"""

import requests
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from tactic_engine import detect_tactics, progression_score, active_tactic_labels
from family_alert import send_family_alert

# ---------- config ----------
import os
from dotenv import load_dotenv
load_dotenv()
TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN")
MODEL_PATH = "model"   # or local path
MAX_LEN = 128
API = f"https://api.telegram.org/bot{TOKEN}"

# ---------- load the trained MuRIL model ----------
tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
model = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH)
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model.to(device)
model.eval()


# ---------- progression bar, e.g. "▓▓▓▓▓▓░░" 75% ----------
def bar(pct):
    filled = round(pct / 100 * 8)
    return "▓" * filled + "░" * (8 - filled)


# ---------- the brain: scam or safe ----------
def analyze(msg):
    enc = tokenizer(msg, return_tensors="pt", truncation=True, max_length=MAX_LEN).to(device)
    with torch.no_grad():
        prob = torch.softmax(model(**enc).logits, -1)[0]

    tactics = detect_tactics(msg)
    active = active_tactic_labels(tactics)
    pct = progression_score(tactics)

    if prob[1] > prob[0]:
        tactic_lines = "\n".join(f"  ✓ {t}" for t in active) if active else "  (no explicit keywords - caught by AI pattern match)"

        # --- Family Alert: fire in real time the moment a scam is confirmed ---
        alert_result = send_family_alert(
            victim_id="demo_victim",
            active_tactics=active,
            confidence=float(prob[1]),
        )
        family_line = "\n👨‍👩‍👧 Family notified." if alert_result.get("sent") else ""

        return (f"⚠️ *SCAM ALERT* — {float(prob[1])*100:.1f}% risk\n\n"
                f"*Scam tactics detected:*\n{tactic_lines}\n"
                f"`{bar(pct)}` {pct}%\n\n"
                "🚫 Do NOT pay money or share any OTP / bank details.\n"
                "👮 Real police or CBI never arrest people over a video call.\n"
                f"🆘 Report at cybercrime.gov.in or call 1930.{family_line}")
    else:
        return (f"✅ *Looks Safe* — {float(prob[0])*100:.1f}% confidence\n\n"
                "Still stay alert if it asks for money, OTP or personal info.")


# ---------- send a reply ----------
def reply(chat_id, text):
    requests.post(f"{API}/sendMessage",
                  json={"chat_id": chat_id, "text": text, "parse_mode": "Markdown"})


# ---------- main loop ----------
def run_bot():
    print("Kavach bot (MuRIL - 8 languages) is running...")
    offset = None
    while True:
        res = requests.get(f"{API}/getUpdates",
                           params={"timeout": 30, "offset": offset}).json()
        for update in res.get("result", []):
            offset = update["update_id"] + 1
            message = update.get("message", {})
            chat_id = message.get("chat", {}).get("id")
            text = message.get("text", "")
            if not text:
                continue

            if text == "/start":
                reply(chat_id, "🛡️ *Kavach - Fraud Shield* (now in 8 Indian languages!)\n\n"
                               "Forward me any suspicious call text, SMS or WhatsApp message, "
                               "and I'll tell you if it's a scam.")
            else:
                reply(chat_id, analyze(text))


if __name__ == "__main__":
    run_bot()