"""
Kavach - Family Alert
======================
Sends a REAL notification to a family member's Telegram the moment a scam
call is detected for a protected user (e.g. an elderly parent).

Why Telegram and not a new channel: Kavach already has a working, authenticated
Telegram bot. Reusing its token means Family Alert is a genuinely working
feature today, not a mockup - no new integration/approval needed.

For the hackathon demo: FAMILY_CONTACTS maps a "victim_id" to the family
member's Telegram chat_id. In a real product this would be set up once during
onboarding (the app asks "who should we alert?" and stores their chat_id/phone).
To demo this yourself: get YOUR OWN Telegram chat_id (message @userinfobot on
Telegram, it replies with your numeric ID) and put it in FAMILY_CONTACTS below -
then "family" in the demo is just your own Telegram account receiving the alert.
"""

import requests
import os
from dotenv import load_dotenv

load_dotenv()  # reads .env in the current working directory

TELEGRAM_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
API = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}"

# demo config - "demo_victim" pulls its chat_id from .env (FAMILY_TELEGRAM_CHAT_ID)
# so your real ID never gets committed to git or hard-coded in this file.
FAMILY_CONTACTS = {
    "demo_victim": os.environ.get("FAMILY_TELEGRAM_CHAT_ID", ""),
}


def send_family_alert(victim_id="demo_victim", victim_name="Your family member",
                       active_tactics=None, confidence=None, location=None,
                       extracted_payment_details=None):
    """Sends a real Telegram message to the registered family contact.
    Returns a dict describing whether it was actually sent - never silently
    fails, so you can see in logs/demo whether the alert really fired.

    extracted_payment_details: optional {"upi_ids": [...], "account_numbers": [...]}
    harvested live from the scammer's own words (see honeypot_agent.py). When
    present, this is real evidence - the family/victim can report it to the
    bank or cyber cell immediately instead of just knowing "a scam happened"."""
    chat_id = FAMILY_CONTACTS.get(victim_id)
    if not chat_id:
        return {"sent": False, "reason": "no family contact configured - check .env FAMILY_TELEGRAM_CHAT_ID"}

    tactics_line = ", ".join(active_tactics) if active_tactics else "a suspicious call pattern"
    conf_line = f" ({confidence * 100:.0f}% confidence)" if confidence else ""
    loc_line = f"\n📍 Approx. location: {location}" if location else ""

    intel_line = ""
    if extracted_payment_details:
        upi = extracted_payment_details.get("upi_ids") or []
        acct = extracted_payment_details.get("account_numbers") or []
        if upi or acct:
            parts = []
            if upi:
                parts.append(f"UPI: {', '.join(upi)}")
            if acct:
                parts.append(f"Account: {', '.join(acct)}")
            intel_line = f"\n\n💳 *Scammer's own payment details (report these):*\n{' | '.join(parts)}"

    text = (f"🚨 *Kavach Family Alert*\n\n"
            f"{victim_name} may be on an active SCAM call right now{conf_line}.\n"
            f"Detected: {tactics_line}.{loc_line}{intel_line}\n\n"
            f"Please try calling them now to check on them.")

    try:
        res = requests.post(f"{API}/sendMessage",
                             json={"chat_id": chat_id, "text": text, "parse_mode": "Markdown"},
                             timeout=10)
        return {"sent": res.ok, "status_code": res.status_code}
    except requests.RequestException as e:
        return {"sent": False, "reason": str(e)}


if __name__ == "__main__":
    result = send_family_alert(
        victim_id="demo_victim",
        victim_name="Ramesh's mother",
        active_tactics=["Authority impersonation", "Fear / urgency", "Money-transfer demand"],
        confidence=0.98,
    )
    print(result)