"""
Kavach - Tactic Decomposition Engine
=====================================
Instead of just saying "SCAM 94%", this module figures out WHICH manipulation
tactics are present in the text, across all 8 languages Kavach supports.

Every digital-arrest scam follows a playbook:
  1. AUTHORITY      - pretend to be police/CBI/ED/customs
  2. ISOLATION       - "don't tell anyone, stay on the call"
  3. FEAR            - "you'll be arrested", "case registered", urgency
  4. MONEY_DEMAND    - "transfer money", "share OTP", "pay the fee"

detect_tactics() returns which of these 4 are present.
progression_score() turns that into a 0-100 "how far along the scam is" number.

This is intentionally simple (substring matching) - fast, explainable, and
works even on partial/streaming transcripts where the ML model alone might
still be uncertain. It's a SECOND signal alongside MuRIL, not a replacement.
"""

# Keyword banks per tactic, covering en/hi/bn/te/mr/ta/gu/pa.
# NOTE: these lists are a starting set - expand them as you see more real
# scam transcripts. More phrases = better recall, so keep adding.
TACTIC_PATTERNS = {
    "authority": [
        # English
        "police", "cbi", "ed ", "enforcement directorate", "customs", "income tax",
        "rbi", "reserve bank", "court", "judge", "warrant", "fir", "aadhaar",
        "narcotics", "nia", "cyber cell", "officer", "department", "inspector",
        # Hindi
        "पुलिस", "सीबीआई", "ईडी", "कस्टम", "आयकर", "आरबीआई", "रिज़र्व बैंक",
        "कोर्ट", "अदालत", "जज", "वारंट", "एफआईआर", "एफ आर", "आधार", "नारकोटिक्स",
        "साइबर सेल", "अधिकारी", "विभाग", "इंस्पेक्टर",
        # Bengali
        "পুলিশ", "সিবিআই", "ইডি", "কাস্টমস", "আয়কর", "আরবিআই", "আদালত",
        "ওয়ারেন্ট", "এফআইআর", "আধার", "সাইবার সেল", "অফিসার", "বিভাগ",
        # Telugu
        "పోలీసు", "సీబీఐ", "ఈడీ", "కస్టమ్స్", "ఆదాయపు పన్ను", "ఆర్బీఐ",
        "కోర్టు", "వారెంట్", "ఎఫ్ఐఆర్", "ఆధార్", "సైబర్ సెల్", "అధికారి",
        # Marathi
        "पोलीस", "सीबीआय", "ईडी", "कस्टम्स", "आयकर", "आरबीआय", "न्यायालय",
        "वॉरंट", "एफआयआर", "आधार", "सायबर सेल", "अधिकारी",
        # Tamil
        "போலீஸ்", "சிபிஐ", "ஈடி", "சுங்கம்", "வருமான வரி", "ஆர்பிஐ",
        "நீதிமன்றம்", "வாரண்ட்", "எஃப்ஐஆர்", "ஆதார்", "சைபர் செல்", "அதிகாரி",
        # Gujarati
        "પોલીસ", "સીબીઆઈ", "ઈડી", "કસ્ટમ્સ", "આવકવેરો", "આરબીઆઈ", "કોર્ટ",
        "વોરંટ", "એફઆઈઆર", "આધાર", "સાયબર સેલ", "અધિકારી",
        # Punjabi
        "ਪੁਲਿਸ", "ਸੀਬੀਆਈ", "ਈਡੀ", "ਕਸਟਮਜ਼", "ਇਨਕਮ ਟੈਕਸ", "ਆਰਬੀਆਈ",
        "ਅਦਾਲਤ", "ਵਾਰੰਟ", "ਐਫਆਈਆਰ", "ਆਧਾਰ", "ਸਾਈਬਰ ਸੈੱਲ", "ਅਧਿਕਾਰੀ",
    ],
    "isolation": [
        "don't tell anyone", "keep this confidential", "don't disconnect",
        "stay on the call", "don't hang up", "don't tell your family",
        "this is secret", "do not share this",
        "किसी को मत बताना", "गोपनीय रखें", "फोन मत काटना", "कॉल पर बने रहें",
        "परिवार को मत बताना", "यह गुप्त है",
        "কাউকে বলবেন না", "গোপন রাখুন", "ফোন কাটবেন না", "কলে থাকুন",
        "পরিবারকে বলবেন না",
        "ఎవరికీ చెప్పకండి", "రహస్యంగా ఉంచండి", "ఫోన్ కట్ చేయకండి",
        "కాల్‌లో ఉండండి", "కుటుంబానికి చెప్పకండి",
        "कोणालाही सांगू नका", "गुप्त ठेवा", "फोन कापू नका", "कॉलवर रहा",
        "कुटुंबाला सांगू नका",
        "யாருக்கும் சொல்லாதீர்கள்", "ரகசியமாக வையுங்கள்", "போனை துண்டிக்காதீர்கள்",
        "கால் இல் இருங்கள்", "குடும்பத்திற்கு சொல்லாதீர்கள்",
        "કોઈને કહેશો નહીં", "ગુપ્ત રાખો", "ફોન કાપશો નહીં", "કૉલ પર રહો",
        "પરિવારને કહેશો નહીં",
        "ਕਿਸੇ ਨੂੰ ਨਾ ਦੱਸੋ", "ਗੁਪਤ ਰੱਖੋ", "ਫੋਨ ਨਾ ਕੱਟੋ", "ਕਾਲ ਤੇ ਰਹੋ",
        "ਪਰਿਵਾਰ ਨੂੰ ਨਾ ਦੱਸੋ",
    ],
    "fear": [
        "arrest", "jail", "warrant", "freeze your account", "illegal",
        "immediate action", "right now", "urgent", "digital arrest",
        "under investigation", "drugs found", "parcel seized", "legal action",
        "court case", "life imprisonment",
        "गिरफ्तार", "जेल", "वारंट", "खाता फ्रीज", "अवैध", "तुरंत", "अभी",
        "अर्जेंट", "डिजिटल अरेस्ट", "जांच के तहत", "ड्रग्स मिले",
        "पार्सल पकड़ा गया", "कानूनी कार्रवाई", "कोर्ट केस", "उम्रकैद",
        "छुड़ाना", "छड़ाना", "छुड़वाना", "साल के लिए भेज", "रो कर घबरा",
        "গ্রেফতার", "জেল", "ওয়ারেন্ট", "অ্যাকাউন্ট ফ্রিজ", "অবৈধ", "এখনই",
        "জরুরি", "ডিজিটাল অ্যারেস্ট", "তদন্তাধীন", "পার্সেল ধরা পড়েছে",
        "అరెస్టు", "జైలు", "వారెంట్", "ఖాతా స్తంభన", "చట్టవిరుద్ధం", "వెంటనే",
        "అత్యవసరం", "డిజిటల్ అరెస్ట్", "దర్యాప్తులో", "పార్సిల్ పట్టుబడింది",
        "अटक", "तुरुंग", "वॉरंट", "खाते गोठवले", "बेकायदेशीर", "लगेच",
        "तातडीने", "डिजिटल अटक", "तपासाधीन", "पार्सल पकडले",
        "கைது", "சிறை", "வாரண்ட்", "கணக்கு முடக்கம்", "சட்டவிரோதம்", "உடனே",
        "அவசரம்", "டிஜிட்டல் கைது", "விசாரணையில்", "பார்சல் பிடிபட்டது",
        "ધરપકડ", "જેલ", "વોરંટ", "ખાતું ફ્રીઝ", "ગેરકાયદેસર", "તાત્કાલિક",
        "અર્જન્ટ", "ડિજિટલ ધરપકડ", "તપાસ હેઠળ", "પાર્સલ પકડાયું",
        "ਗ੍ਰਿਫਤਾਰ", "ਜੇਲ", "ਵਾਰੰਟ", "ਖਾਤਾ ਫ੍ਰੀਜ਼", "ਗੈਰਕਾਨੂੰਨੀ", "ਹੁਣੇ",
        "ਜ਼ਰੂਰੀ", "ਡਿਜੀਟਲ ਗ੍ਰਿਫਤਾਰੀ", "ਜਾਂਚ ਅਧੀਨ", "ਪਾਰਸਲ ਫੜਿਆ",
    ],
    "money_demand": [
        "transfer money", "pay the fee", "share your otp", "bank account number",
        "upi id", "processing fee", "refundable deposit", "send money",
        "google pay", "phonepe", "verification fee", "pay online",
        "bank details", "card number", "cvv",
        "पैसे ट्रांसफर करो", "फीस भरो", "ओटीपी बताओ", "बैंक खाता नंबर",
        "यूपीआई आईडी", "प्रोसेसिंग फीस", "रिफंडेबल डिपॉजिट", "पैसे भेजो",
        "गूगल पे", "फोन पे", "वेरिफिकेशन फीस", "बैंक डिटेल्स", "कार्ड नंबर",
        "खर्चा पानी",
        "টাকা পাঠান", "ফি দিন", "ওটিপি বলুন", "ব্যাংক অ্যাকাউন্ট নম্বর",
        "ইউপিআই আইডি", "প্রসেসিং ফি", "ব্যাংক বিবরণ",
        "డబ్బు బదిలీ చేయండి", "ఫీజు కట్టండి", "ఓటిపి చెప్పండి",
        "బ్యాంక్ ఖాతా నంబర్", "యుపిఐ ఐడి", "ప్రాసెసింగ్ ఫీజు", "బ్యాంక్ వివరాలు",
        "पैसे ट्रान्सफर करा", "फी भरा", "ओटीपी सांगा", "बँक खाते क्रमांक",
        "युपीआय आयडी", "प्रोसेसिंग फी", "बँक तपशील",
        "பணம் அனுப்பவும்", "கட்டணம் செலுத்தவும்", "ஓடிபி சொல்லுங்கள்",
        "வங்கி கணக்கு எண்", "யுபிஐ ஐடி", "செயலாக்க கட்டணம்", "வங்கி விவரங்கள்",
        "પૈસા ટ્રાન્સફર કરો", "ફી ભરો", "ઓટીપી કહો", "બેંક ખાતા નંબર",
        "યુપીઆઈ આઈડી", "પ્રોસેસિંગ ફી", "બેંક વિગતો",
        "ਪੈਸੇ ਟ੍ਰਾਂਸਫਰ ਕਰੋ", "ਫੀਸ ਭਰੋ", "ਓਟੀਪੀ ਦੱਸੋ", "ਬੈਂਕ ਖਾਤਾ ਨੰਬਰ",
        "ਯੂਪੀਆਈ ਆਈਡੀ", "ਪ੍ਰੋਸੈਸਿੰਗ ਫੀਸ", "ਬੈਂਕ ਵੇਰਵੇ",
    ],
}

TACTIC_LABELS = {
    "authority": "Authority impersonation",
    "isolation": "Isolation",
    "fear": "Fear / urgency",
    "money_demand": "Money-transfer demand",
}


def detect_tactics(text: str) -> dict:
    """Scan text for each tactic's keyword bank. Case-insensitive substring
    match - simple on purpose: fast, explainable, works on partial transcripts."""
    t = text.lower()
    return {tactic: any(kw.lower() in t for kw in keywords)
            for tactic, keywords in TACTIC_PATTERNS.items()}


def progression_score(tactics: dict) -> float:
    """0-100: how many of the 4 tactics have fired so far."""
    return round(sum(tactics.values()) / len(tactics) * 100, 1)


def active_tactic_labels(tactics: dict) -> list:
    """Human-readable list of which tactics are currently active, e.g.
    ['Authority impersonation', 'Fear / urgency'] - this is what the UI lights up."""
    return [TACTIC_LABELS[k] for k, v in tactics.items() if v]


if __name__ == "__main__":
    tests = [
        "I am calling from CBI, this is a digital arrest, don't tell anyone, transfer money now",
        "बेटा ऑफिस पहुँच गया, फ्री हो तो कॉल करना",
        "मैं दिल्ली सीबीआई से बात कर रहा हूं, पार्सल पकड़ा गया है, किसी को मत बताना",
    ]
    for t in tests:
        tac = detect_tactics(t)
        print(t[:50], "->", active_tactic_labels(tac), f"{progression_score(tac)}%")