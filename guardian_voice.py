"""
Kavach - Guardian Voice
=======================
When a scam is detected mid-call, Kavach speaks a calm warning to the victim
in THEIR language - this is the "Guardian Voice" feature from the roadmap.

Why TTS instead of just showing text: the victim (often an elderly person)
is scared, staring at a scammer on a video call, and may not look at their
own screen. A calm spoken voice cuts through the panic better than a popup.

Engine: edge-tts (Microsoft's neural voices, free, no API key) for 7 of our
8 languages - much more natural than gTTS. Microsoft has no Punjabi neural
voice yet, so Punjabi falls back to gTTS (still understandable, just more
robotic - note this in the README "what's real vs simulated" table).

NOTE for the pitch: both engines need internet. In a full on-device
production version this would be swapped for an offline TTS engine to match
the privacy-by-design story - fine to state as future scope in the demo.
"""

import asyncio
import edge_tts
from gtts import gTTS

# Neural voice per language (chosen for a calm, warm tone)
EDGE_VOICES = {
    "en": "en-IN-NeerjaNeural",
    "hi": "hi-IN-SwaraNeural",
    "bn": "bn-IN-TanishaaNeural",
    "te": "te-IN-ShrutiNeural",
    "mr": "mr-IN-AarohiNeural",
    "ta": "ta-IN-PallaviNeural",
    "gu": "gu-IN-DhwaniNeural",
    # "pa" intentionally missing - no Microsoft neural voice exists for it yet
}

# Base calm warning per language - short, clear, said ONCE a scam is confirmed.
BASE_WARNING = {
    "en": "This looks like a scam. Real police or officials never arrest you over a phone or video call. Please hang up and call a family member now.",
    "hi": "यह एक धोखाधड़ी लग रही है। असली पुलिस या अधिकारी कभी भी फोन या वीडियो कॉल पर गिरफ्तार नहीं करते। कृपया कॉल काट दें और अभी परिवार के किसी सदस्य को कॉल करें।",
    "bn": "এটি একটি প্রতারণা বলে মনে হচ্ছে। প্রকৃত পুলিশ বা কর্মকর্তারা কখনও ফোন বা ভিডিও কলে গ্রেপ্তার করেন না। অনুগ্রহ করে কল কেটে দিন এবং এখনই পরিবারের কাউকে কল করুন।",
    "te": "ఇది మోసంలా అనిపిస్తోంది. నిజమైన పోలీసులు లేదా అధికారులు ఎప్పుడూ ఫోన్ లేదా వీడియో కాల్‌లో అరెస్టు చేయరు. దయచేసి కాల్ కట్ చేసి ఇప్పుడే కుటుంబ సభ్యుడికి కాల్ చేయండి.",
    "mr": "ही फसवणूक वाटत आहे. खरे पोलीस किंवा अधिकारी कधीही फोन किंवा व्हिडिओ कॉलवर अटक करत नाहीत. कृपया कॉल बंद करा आणि आत्ताच कुटुंबातील सदस्याला कॉल करा.",
    "ta": "இது ஒரு மோசடி போல் தெரிகிறது. உண்மையான போலீஸ் அல்லது அதிகாரிகள் ஒருபோதும் தொலைபேசி அல்லது வீடியோ அழைப்பில் கைது செய்ய மாட்டார்கள். தயவுசெய்து அழைப்பைத் துண்டித்து இப்போதே குடும்ப உறுப்பினரை அழைக்கவும்.",
    "gu": "આ છેતરપિંડી લાગે છે. વાસ્તવિક પોલીસ અથવા અધિકારીઓ ક્યારેય ફોન અથવા વિડિયો કૉલ પર ધરપકડ કરતા નથી. કૃપા કરીને કૉલ કાપી નાખો અને હમણાં જ પરિવારના સભ્યને કૉલ કરો.",
    "pa": "ਇਹ ਇੱਕ ਧੋਖਾਧੜੀ ਜਾਪਦੀ ਹੈ। ਅਸਲੀ ਪੁਲਿਸ ਜਾਂ ਅਧਿਕਾਰੀ ਕਦੇ ਵੀ ਫੋਨ ਜਾਂ ਵੀਡੀਓ ਕਾਲ 'ਤੇ ਗ੍ਰਿਫਤਾਰ ਨਹੀਂ ਕਰਦੇ। ਕਿਰਪਾ ਕਰਕੇ ਕਾਲ ਕੱਟੋ ਅਤੇ ਹੁਣੇ ਪਰਿਵਾਰ ਦੇ ਕਿਸੇ ਮੈਂਬਰ ਨੂੰ ਕਾਲ ਕਰੋ।",
}

# extra line added if money_demand tactic specifically fired - the most urgent one
MONEY_WARNING = {
    "en": "Do not transfer any money or share your OTP.",
    "hi": "कोई भी पैसा ट्रांसफर न करें और अपना ओटीपी न बताएं।",
    "bn": "কোনো টাকা পাঠাবেন না বা আপনার ওটিপি শেয়ার করবেন না।",
    "te": "డబ్బు బదిలీ చేయవద్దు లేదా మీ ఓటిపిని పంచుకోవద్దు.",
    "mr": "कोणतेही पैसे ट्रान्सफर करू नका किंवा तुमचा ओटीपी सांगू नका.",
    "ta": "பணத்தை அனுப்ப வேண்டாம் அல்லது உங்கள் ஓடிபியை பகிர வேண்டாம்.",
    "gu": "કોઈ પણ પૈસા ટ્રાન્સફર કરશો નહીં અથવા તમારો ઓટીપી શેર કરશો નહીં.",
    "pa": "ਕੋਈ ਵੀ ਪੈਸਾ ਟ੍ਰਾਂਸਫਰ ਨਾ ਕਰੋ ਜਾਂ ਆਪਣਾ ਓਟੀਪੀ ਸਾਂਝਾ ਨਾ ਕਰੋ।",
}


def build_warning_text(language="en", tactics=None):
    """Compose the spoken warning - base message + an extra urgent line if
    the money-demand tactic has fired (the most dangerous stage)."""
    lang = language if language in BASE_WARNING else "en"
    text = BASE_WARNING[lang]
    if tactics and tactics.get("money_demand"):
        text += " " + MONEY_WARNING[lang]
    return text


async def _edge_generate(text, voice, out_path):
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(out_path)


def generate_voice(language="en", tactics=None, out_path="guardian_warning.mp3"):
    """Generate the spoken warning as an mp3 file. Returns the file path.
    Uses edge-tts neural voices where available, gTTS fallback for Punjabi."""
    text = build_warning_text(language, tactics)

    if language in EDGE_VOICES:
        voice = EDGE_VOICES[language]
        asyncio.run(_edge_generate(text, voice, out_path))
    else:
        # Punjabi (or any unmapped language) - fallback to gTTS
        lang_code = language if language == "pa" else "en"
        tts = gTTS(text=text, lang=lang_code)
        tts.save(out_path)

    return out_path


if __name__ == "__main__":
    # quick test - generates a Hindi warning with the money-demand escalation
    tactics = {"authority": True, "isolation": True, "fear": True, "money_demand": True}
    path = generate_voice("hi", tactics, "test_guardian_hi.mp3")
    print("Saved:", path)
    print("Text was:", build_warning_text("hi", tactics))