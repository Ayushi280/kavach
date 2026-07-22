"""
Kavach - Passive Evidence Capture (mule-account intelligence)
=============================================================
NAMING NOTE: we deliberately do NOT call this a "honeypot" anymore. A honeypot
implies an AI actively baiting/talking to the scammer. We do not do that, and
claiming we do would be dishonest. What we actually do is PASSIVE: we listen to
the call the victim is already on (on speaker) and capture the payment details
the scammer says anyway.

This file has TWO separate pieces - NOT the same risk level:

1. extract_payment_details() - LIVE, SAFE, wired into the real pipeline
   (kavach_pipeline.check_text -> used by /check, /check-audio, and the
   Speakerphone Companion). It never talks to anyone. It reads the transcript
   Kavach is ALREADY hearing and pulls out any UPI ID / account number the
   scammer says out loud - pure pattern matching on text we already have. No
   new audio, no impersonation, no baiting. Scammers always name a mule
   account (that's how they get paid), so if the user chooses to keep
   listening, we capture it and hand it to Family Alert + the Cyber Cell map
   as real evidence. This is the honest, buildable core.

   IMPORTANT product truth: this competes with warning the victim early. If we
   warn and they hang up, nothing is captured - and that's the RIGHT call.
   Protecting the victim wins; capture is opportunistic best-effort on
   whatever was already spoken. Describe it that way, never as "we extract the
   scammer's account by baiting them."

2. generate_honeypot_reply() / PERSONA_PROMPT / run_demo_conversation() -
   RESEARCH-DEMO ONLY, NOT wired into the live call and NOT part of the
   shipped product. Kept purely as a /honeypot-demo endpoint for the pitch to
   illustrate the concept. It does not talk to any real scammer. If it adds
   confusion, it can be dropped entirely without affecting the live app.
"""

import os
import re
from dotenv import load_dotenv

load_dotenv()

try:
    from google import genai
    _api_key = os.environ.get("GEMINI_API_KEY", "")
    _client = genai.Client(api_key=_api_key) if _api_key else None
except ImportError:
    _client = None

PERSONA_PROMPT = """You are role-playing as "Ramesh", a confused, slightly hard-of-hearing \
68-year-old retired teacher, for a DEFENSIVE RESEARCH DEMO that tests how a \
scam-baiting AI could stall fraudsters and waste their time. You are NOT talking \
to a real person - this is a scripted research simulation using an already-collected \
scam call transcript pattern.

Your goals in every reply:
1. Sound genuinely confused and a little hard of hearing - ask the caller to repeat things.
2. Stall for time - ask slow, rambling questions, mention needing to find your glasses/hearing aid, etc.
3. Never actually agree to pay or share real information (there is none - this is fictional).
4. Occasionally ask practical questions like "how would I even send this" or "which account" -
   these are designed to prompt the (simulated) caller to reveal more procedural details.
5. Keep each reply short (1-3 sentences), natural, and in the same language as the caller's message.

Do not break character or mention this is a demo/simulation in your reply text.

The caller (from an already-collected scam transcript pattern) just said: "{scammer_text}"

Reply as Ramesh:"""


def generate_honeypot_reply(scammer_text):
    """Generates the honeypot persona's stalling reply to one scammer line."""
    if _client is None:
        return "[LLM not configured - set GEMINI_API_KEY in .env]"
    try:
        response = _client.models.generate_content(
            model="gemini-3.5-flash",
            contents=PERSONA_PROMPT.format(scammer_text=scammer_text),
        )
        return response.text.strip()
    except Exception as e:
        return f"[honeypot error: {e}]"


# --- payment detail extraction: turns a scammer line into Fraud Graph data ---
UPI_PATTERN = re.compile(r"[\w.\-]{2,}@[a-zA-Z]{2,}")   # e.g. 9999999999@examplepay
ACCOUNT_PATTERN = re.compile(r"\b\d{9,18}\b")             # bank / mule account numbers


def extract_payment_details(text):
    """Pulls UPI IDs and account numbers out of a scammer message - this is
    the 'harvesting' step that would feed the Fraud Network Graph with real
    mule payment info in a genuine deployment."""
    return {
        "upi_ids": UPI_PATTERN.findall(text),
        "account_numbers": ACCOUNT_PATTERN.findall(text),
    }


# --- demo conversation: uses REALISTIC lines matching patterns already in
# our own training data, NOT newly invented scam content, with obviously
# fictional example payment details for the extraction demo ---
DEMO_SCAMMER_LINES = [
    "मैं दिल्ली सीबीआई से बात कर रहा हूं, पार्सल पकड़ा गया है, किसी को मत बताना",
    "आपका आधार कार्ड इस केस में इस्तेमाल हुआ है, आपको तुरंत कार्रवाई करनी होगी",
    "ठीक है, केस बंद करने के लिए आपको फीस भरनी होगी, यह रहा UPI: 9999999999@examplepay",
    "अगर आप पैसे नहीं भेज पाते तो अकाउंट नंबर 123456789012 में जमा कर दीजिए",
]


# What the victim naturally says while stalling - STATIC lines, no LLM call.
# We deliberately do NOT use Gemini here: (1) it hits free-tier quota and dumps
# ugly 429 errors into the demo, and (2) per our honesty stance, Kavach does
# not use an AI to talk to scammers. In a real call the human victim is doing
# the talking; Kavach just listens and captures. These lines simply illustrate
# a victim keeping the caller talking long enough to reveal payment details.
DEMO_VICTIM_LINES = [
    "हाँ बेटा... मुझे ठीक से सुनाई नहीं दे रहा, ज़रा दोबारा बताइए?",
    "अच्छा... मैं अपना चश्मा ढूंढ रही हूँ, एक मिनट रुकिए।",
    "पैसे कैसे भेजूँ? मुझे तो ये सब चलाना नहीं आता... UPI क्या होता है?",
    "अकाउंट नंबर लिख लिया... और कितने पैसे भेजने हैं?",
]


def run_demo_conversation():
    """Passive-capture demo (no LLM, no scammer interaction): shows realistic
    scam lines and the UPI/account numbers Kavach extracts from them. The
    'victim' replies are static illustrations of a person stalling - Kavach
    itself never generates or speaks these to anyone."""
    transcript = []
    extracted_all = {"upi_ids": [], "account_numbers": []}

    for i, scammer_line in enumerate(DEMO_SCAMMER_LINES):
        reply = DEMO_VICTIM_LINES[i % len(DEMO_VICTIM_LINES)]
        details = extract_payment_details(scammer_line)
        extracted_all["upi_ids"].extend(details["upi_ids"])
        extracted_all["account_numbers"].extend(details["account_numbers"])

        transcript.append({"scammer": scammer_line, "honeypot": reply, "extracted": details})

    return transcript, extracted_all


if __name__ == "__main__":
    transcript, extracted = run_demo_conversation()
    for turn in transcript:
        print(f"SCAMMER:  {turn['scammer']}")
        print(f"HONEYPOT: {turn['honeypot']}")
        if turn["extracted"]["upi_ids"] or turn["extracted"]["account_numbers"]:
            print(f"  >>> extracted: {turn['extracted']}")
        print()
    print("=== Total extracted (feeds Fraud Graph) ===")
    print(extracted)
