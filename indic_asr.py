"""
Kavach - Indic ASR (replaces vanilla Whisper for Indian-language calls)
========================================================================
Vanilla Whisper garbled Hindi phone audio during earlier testing. AI4Bharat's
IndicConformer-600M-Multi is trained specifically on Indian languages/accents
and covers all 22 official languages (including Punjabi, which even our TTS
voice couldn't do) - so it's a direct fix for that transcription-quality gap.

This is a separate engine from faster-whisper, not a patch to it: Whisper
auto-detects language from audio, IndicConformer needs the language told to
it upfront. So the pipeline uses Whisper for quick language detection, then
re-transcribes the same audio with IndicConformer for the ACTUAL transcript
quality used in scam detection. Best of both: auto-detect + better accuracy.

First load takes a while (600M-parameter model, downloads once then caches).
"""

import torch
import torchaudio
import soundfile as sf
import numpy as np

# language codes IndicConformer understands (subset relevant to Kavach)
INDIC_LANG_CODES = {
    "en": None,  # not an Indian language - fall back to Whisper's own transcript
    "hi": "hi", "bn": "bn", "te": "te", "mr": "mr",
    "ta": "ta", "gu": "gu", "pa": "pa",
}

# Whisper frequently mislabels spoken Hindi as Urdu (they're the same spoken
# language, "Hindustani" - differing mainly in script). Since Kavach's target
# users, keyword banks, and training data are all Devanagari-based, normalize
# Urdu detections to Hindi so we get a matching, usable transcript instead of
# Perso-Arabic script text that our tactic keywords can never match.
LANGUAGE_NORMALIZE = {"ur": "hi"}

_model = None  # loaded once, lazily - this model is large


def _load_model():
    global _model
    if _model is None:
        from transformers import AutoModel
        _model = AutoModel.from_pretrained(
            "ai4bharat/indic-conformer-600m-multilingual", trust_remote_code=True
        )
    return _model


def transcribe_indic(audio_path, language, decoding="ctc"):
    """Transcribe audio_path using IndicConformer for the given language code
    (e.g. 'hi', 'ta', 'te'...). Returns None if the language isn't supported
    (e.g. English) so the caller can fall back to the Whisper transcript."""
    language = LANGUAGE_NORMALIZE.get(language, language)
    lang_code = INDIC_LANG_CODES.get(language)
    if not lang_code:
        return None

    model = _load_model()

    # soundfile reads the audio (no torchcodec/ffmpeg-linking headaches on Windows)
    data, sr = sf.read(audio_path, dtype="float32")
    if data.ndim > 1:
        data = data.mean(axis=1)  # stereo -> mono
    wav = torch.from_numpy(np.ascontiguousarray(data)).unsqueeze(0)  # shape (1, N)

    target_sr = 16000
    if sr != target_sr:
        resampler = torchaudio.transforms.Resample(orig_freq=sr, new_freq=target_sr)
        wav = resampler(wav)

    return model(wav, lang_code, decoding)


if __name__ == "__main__":
    # quick manual test - point to a real Hindi call recording to try it
    text = transcribe_indic("scam_call_hindi.wav", "hi")
    print("IndicConformer transcript:", text)