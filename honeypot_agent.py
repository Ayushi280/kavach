"""
Kavach - Scam-baiting Honeypot (LITE)
=======================================
This file has TWO separate pieces now - they are NOT the same risk level,
so don't treat the file as one thing:

1. extract_payment_details() - LIVE, SAFE, actually wired into the real
   pipeline (kavach_pipeline.check_text -> used by /check, /check-audio, and
   the Speakerphone Companion). It never talks to anyone. It just reads the
   transcript Kavach is ALREADY hearing (the victim's real call, on speaker,
   same mic we already legally listen through) and pulls out any UPI ID /
   account number the scammer says out loud. That's it - pure pattern
   matching on text we already have, no new audio, no impersonation, no
   consent issue beyond what Speakerphone Companion already has. This is
   what makes the "honeypot" idea real instead of a toy: the app doesn't
   need the victim to do anything, and it doesn't need to fake a
   conversation - scammers say their own payment details unprompted, we just
   have to be listening and grab them, then hand them to Family Alert / a
   future cyber-cell report as real evidence.

2. generate_honeypot_reply() / PERSONA_PROMPT / run_demo_conversation() -
   STILL RESEARCH-DEMO ONLY, not wired into the live call. This is the AI
   persona that WRITES fake stalling replies for the pitch demo screen (or a
   judge to play with). It is not hooked up to speak to a real scammer live -
   doing that would need real-time turn-taking and the app impersonating the
   victim's voice with no human in the loop, which is a much bigger,
   riskier build we deliberately did NOT take on. Keep using this only for
   /honeypot-demo and the pitch.
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


def run_demo_conversation():
    """Scripted end-to-end demo: each line matches a realistic scam pattern
    (from our own training data), the honeypot LLM replies in character, and
    any payment details mentioned get extracted for the Fraud Graph."""
    transcript = []
    extracted_all = {"upi_ids": [], "account_numbers": []}

    for scammer_line in DEMO_SCAMMER_LINES:
        reply = generate_honeypot_reply(scammer_line)
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