"""
Kavach - LLM Tactic Tagger (fallback / second opinion)
========================================================
The keyword-based Tactic Engine (tactic_engine.py) is fast, free, and works
offline - but with only ~39 real training calls, we can't build exhaustive
keyword banks that catch every real-world phrasing (confirmed by testing:
mining attempts on our small dataset didn't surface reliable new phrases).

This module is the "thin optional LLM layer" from the roadmap: called ONLY
when MuRIL confidently says SCAM but the keyword engine found zero tactics -
exactly the gap we saw in real testing (99% SCAM, tactics: []). It uses
Gemini's language understanding instead of keyword matching, so it
generalizes to phrasings never seen in training data.

Kept as a FALLBACK, not the primary path - controls cost/latency and stays
consistent with the "own model does ~95%+ of the work" architecture your
mentor instructions call for. Uses gemini-3.5-flash (cheap, fast) since this
is a simple tagging task, not complex reasoning.
"""

import os
import json
from dotenv import load_dotenv

load_dotenv()

try:
    from google import genai
    _api_key = os.environ.get("GEMINI_API_KEY", "")
    _client = genai.Client(api_key=_api_key) if _api_key else None
except ImportError:
    _client = None

TACTIC_PROMPT = """You are analyzing a phone call transcript for a fraud-detection system. \
Identify which of these 4 manipulation tactics are present in the text below. \
Respond with ONLY a JSON object, no other text, in this exact format:
{{"authority": true/false, "isolation": true/false, "fear": true/false, "money_demand": true/false, "explanation": "one short sentence"}}

Tactics:
- authority: caller impersonates police/government/legal authority
- isolation: caller tells the person not to tell anyone or stay on the call
- fear: caller creates panic/urgency (arrest, legal action, threats)
- money_demand: caller asks for money, OTP, bank details, or payment

Text: "{text}"
"""

_EMPTY_RESULT = {"authority": False, "isolation": False, "fear": False, "money_demand": False}


def tag_tactics_llm(text):
    """Returns the same shape as tactic_engine.detect_tactics() plus an
    'explanation' field, using Gemini instead of keyword matching.
    Fails safe (returns all-False) if no API key is configured or the
    call errors - never crashes the caller."""
    if _client is None:
        return {**_EMPTY_RESULT, "explanation": "LLM tagger not configured (no GEMINI_API_KEY)"}

    try:
        response = _client.models.generate_content(
            model="gemini-3.5-flash",
            contents=TACTIC_PROMPT.format(text=text),
        )
        raw = response.text.strip()
        raw = raw.replace("```json", "").replace("```", "").strip()
        result = json.loads(raw)
        return result
    except Exception as e:
        return {**_EMPTY_RESULT, "explanation": f"LLM tagger error: {e}"}


if __name__ == "__main__":
    test_text = "मैं दिल्ली सीबीआई से बात कर रहा हूं, कोई खर्चा पानी दे दो वरना दस साल के लिए भेज दूंगा"
    print(tag_tactics_llm(test_text))