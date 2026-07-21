"""
Kavach - Risk Session Manager + Payment Circuit Breaker (the REAL logic)
========================================================================
This is what makes the circuit breaker not-a-toy. Instead of a manual toggle,
the payment block is driven by the ACTUAL scam-detection system:

  1. When the detector flags a scam call/message for a user, the pipeline
     opens a time-limited "high-risk window" for that user (open_risk_session).
  2. When a payment app is about to send money, it first asks Kavach
     (evaluate_payment). If the user is inside a high-risk window AND the
     transfer looks dangerous (large amount / new payee), Kavach returns HOLD
     with a graduated cooldown - a speed bump between panic and the transfer.
  3. Small payments to known payees are ALLOWED even during a risk window -
     Kavach must not obstruct a scared person's normal life (buying medicine,
     paying a known bill). Blocking everything would make it a toy people
     switch off.

WHY THIS IS THE RIGHT DESIGN: it works even if the victim is still fully
fooled - it doesn't need them to read a warning, look at the screen, or act.
It stops the actual harm (money leaving) at the last inch.

DEPLOYMENT NOTE (state honestly in the deck): in production the "payment app
asks Kavach first" step is enforced via (a) an Android accessibility-service
overlay that detects a UPI app in the foreground during an active risk window,
and (b) future NPCI/PSP integration applying a dynamic cooling-period on new
payees. This backend is the real decision engine behind both; the demo
simulates the payment app's pre-transfer check calling this API.

Storage: in-memory dict for the demo. In production this is Redis (already in
the Kavach stack) so risk windows survive across processes and expire via TTL.
"""

import time
from dataclasses import dataclass, field

# --- tunables -------------------------------------------------------------
RISK_WINDOW_SECONDS = 30 * 60      # a scam detection keeps a user "at risk" 30 min
SAFE_AMOUNT = 2000                  # ₹ - below this, allow even during a risk window
HIGH_AMOUNT = 20000                # ₹ - above this, maximum cooldown / friction
BASE_COOLDOWN = 15                 # seconds - minimum speed bump when we HOLD
MAX_COOLDOWN = 60                  # seconds - cap for the worst-risk transfers


@dataclass
class RiskSession:
    user_id: str
    reason: str
    confidence: float
    active_tactics: list = field(default_factory=list)
    opened_at: float = field(default_factory=time.time)

    def is_active(self):
        return (time.time() - self.opened_at) < RISK_WINDOW_SECONDS

    def seconds_left(self):
        return max(0, int(RISK_WINDOW_SECONDS - (time.time() - self.opened_at)))


# in-memory store: user_id -> RiskSession  (Redis in production)
_sessions = {}


def open_risk_session(user_id, reason, confidence, active_tactics=None):
    """Called by the detector when a scam is flagged for this user. Opens (or
    refreshes) their high-risk window."""
    _sessions[user_id] = RiskSession(
        user_id=user_id,
        reason=reason,
        confidence=confidence,
        active_tactics=active_tactics or [],
    )
    return {"risk_open": True, "expires_in_sec": RISK_WINDOW_SECONDS}


def get_risk_status(user_id):
    """Is this user currently inside a high-risk window?"""
    s = _sessions.get(user_id)
    if s and s.is_active():
        return {"at_risk": True, "reason": s.reason, "confidence": s.confidence,
                "active_tactics": s.active_tactics, "seconds_left": s.seconds_left()}
    return {"at_risk": False}


def clear_risk_session(user_id):
    """Victim confirmed safe / hung up - close the window."""
    _sessions.pop(user_id, None)
    return {"risk_open": False}


def _cooldown_for(amount):
    """Graduated friction: bigger transfer => longer speed bump."""
    if amount >= HIGH_AMOUNT:
        return MAX_COOLDOWN
    # scale linearly between BASE and MAX across the SAFE..HIGH range
    frac = (amount - SAFE_AMOUNT) / max(1, (HIGH_AMOUNT - SAFE_AMOUNT))
    return int(BASE_COOLDOWN + frac * (MAX_COOLDOWN - BASE_COOLDOWN))


def evaluate_payment(user_id, amount, payee=None, new_payee=False):
    """The circuit breaker decision. A payment app calls this BEFORE sending
    money. Returns ALLOW, WARN, or HOLD with a reason and (for HOLD) a cooldown.

    Decision logic (3 tiers, not 2 - a risk window should never be completely
    silent, but shouldn't fully block routine small payments either):
      - No active risk window            -> ALLOW (normal life, no friction)
      - Risk window + small amount        -> WARN  (soft confirmation - "are
                                              you sure?" - lets it through
                                              but surfaces the risk, doesn't
                                              obstruct medicine/bills)
      - Risk window + large/new payee     -> HOLD  (speed bump + escalation)
    """
    status = get_risk_status(user_id)

    if not status["at_risk"]:
        return {"decision": "ALLOW", "reason": "No active scam risk detected."}

    # Inside a high-risk window.
    dangerous = amount >= SAFE_AMOUNT or new_payee
    if not dangerous:
        return {
            "decision": "WARN",
            "reason": (f"You're inside an active scam-risk window. This payment "
                      f"(₹{amount}) is small enough to proceed, but please confirm "
                      f"it's genuinely yours to make."),
            "amount": amount,
            "payee": payee,
            "risk_reason": status["reason"],
            "active_tactics": status["active_tactics"],
            "confidence": status["confidence"],
            "advice": ("If anyone asked you to make this payment during a call, "
                      "hang up and confirm with family before proceeding."),
        }

    cooldown = _cooldown_for(amount)
    if new_payee:
        cooldown = min(MAX_COOLDOWN, cooldown + 15)  # brand-new payee = extra friction

    return {
        "decision": "HOLD",
        "reason": ("This transfer matches an active scam-call risk window. "
                   "Kavach has paused it as a safety cooldown."),
        "cooldown_sec": cooldown,
        "amount": amount,
        "payee": payee,
        "new_payee": new_payee,
        "risk_reason": status["reason"],
        "active_tactics": status["active_tactics"],
        "confidence": status["confidence"],
        "advice": "Real police/CBI never demand money or arrest over a call. "
                  "Call a family member before sending anything.",
    }


if __name__ == "__main__":
    # demo: no risk -> allow; then a scam opens a window -> large transfer held
    print(evaluate_payment("u1", 50000, "unknown@upi", new_payee=True))
    open_risk_session("u1", "Digital arrest scam call detected",
                      confidence=0.99, active_tactics=["Authority impersonation", "Fear / urgency"])
    print(evaluate_payment("u1", 1500, "milkman@upi"))          # small -> WARN (soft confirm)
    print(evaluate_payment("u1", 50000, "unknown@upi", new_payee=True))  # -> HOLD