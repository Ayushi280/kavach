"""
Mines your EXISTING scam training data for recurring phrases, so we can grow
the Tactic Engine's keyword banks systematically (from real collected data)
instead of only ad-hoc from individual calls we happen to test.

Run this in Colab where your data is already loaded (digital_arrest_scams.csv,
translated_scams.csv, scam_snippets.csv etc. combined into `all_data` from
your training notebook). It prints the most common 2-4 word phrases found in
SCAM-labeled text that are NOT already covered by tactic_engine.py's keyword
banks - i.e. candidate phrases worth adding.
"""

import re
from collections import Counter
import pandas as pd
import sys
sys.path.append('/content/drive/MyDrive/kavach')
from tactic_engine import TACTIC_PATTERNS

# flatten all existing keywords into one set for "already covered" checking
ALREADY_COVERED = set()
for keywords in TACTIC_PATTERNS.values():
    ALREADY_COVERED.update(k.lower() for k in keywords)


# junk n-grams to skip: URLs, punctuation-only fragments, pure numbers
JUNK_PATTERN = re.compile(r"^[\W\d_]+$")  # no real letters at all
URL_JUNK = ("http", "www", ".com", "://", "/ /")


def is_junk(phrase):
    if JUNK_PATTERN.match(phrase.replace(" ", "")):
        return True
    lower = phrase.lower()
    return any(bad in lower for bad in URL_JUNK)


def get_ngrams(text, n_min=2, n_max=4):
    words = text.split()
    ngrams = []
    for n in range(n_min, n_max + 1):
        for i in range(len(words) - n + 1):
            ngrams.append(" ".join(words[i:i + n]))
    return ngrams


def mine_phrases(df, text_col="text", label_col="label", type_col="type", top_n=60):
    """Only mines 'call'-type rows (real digital-arrest transcripts/snippets).
    Ranks phrases by DISTINCTIVENESS (scam frequency vs safe frequency), not
    raw frequency - otherwise generic conversational filler ('theek hai',
    'ji sir') dominates, since with only ~39 real calls, common speech
    patterns are more frequent than the actual scam-specific content words."""
    scam_subset = df[(df[label_col] == "scam") & (df[type_col] == "call")]
    safe_subset = df[df[label_col] == "safe"]  # broad safe corpus as baseline
    scam_texts = scam_subset[text_col].dropna().astype(str)
    safe_texts = safe_subset[text_col].dropna().astype(str)
    print(f"Comparing {len(scam_texts)} call-type scam rows vs {len(safe_texts)} safe rows...\n")

    scam_counter = Counter()
    for text in scam_texts:
        scam_counter.update(get_ngrams(text))

    safe_counter = Counter()
    for text in safe_texts:
        safe_counter.update(get_ngrams(text))

    scored = []
    for phrase, scam_count in scam_counter.items():
        if scam_count < 2 or phrase.lower() in ALREADY_COVERED or is_junk(phrase):
            continue
        safe_count = safe_counter.get(phrase, 0)
        distinctiveness = scam_count / (safe_count + 1)  # +1 smoothing
        scored.append((phrase, scam_count, safe_count, distinctiveness))

    scored.sort(key=lambda x: (-x[3], -x[1]))  # highest distinctiveness first

    print(f"Top {top_n} candidate phrases (scam-distinctive, not yet in tactic_engine.py):\n")
    print(f"{'phrase':<30} {'scam_count':>10} {'safe_count':>10} {'ratio':>8}")
    for phrase, scam_count, safe_count, ratio in scored[:top_n]:
        print(f"{phrase:<30} {scam_count:>10} {safe_count:>10} {ratio:>8.1f}")


# ---- run it on your combined training data ----
mine_phrases(all_data, text_col="text", label_col="label", type_col="type")