"""
Kavach - Deepfake / AI-Voice Detection (LITE)
================================================
2026-era scams increasingly use cloned voices ("Ma, I'm in trouble, send
money" in a voice that sounds exactly like your son). This module adds one
more signal to the tactic decomposition: is the caller's voice itself
synthetic/AI-generated?

Uses a PRE-TRAINED model (garystafford/wav2vec2-deepfake-voice-detector,
built on a Wav2Vec2-XLSR-53 multilingual base) - per the roadmap's explicit
instruction, we integrate an existing detector rather than training one from
scratch. 97.9% validation accuracy on its own test set; note honestly in the
README that generalization to real-world Indian phone audio / novel TTS
engines is not guaranteed (documented limitation of the source model).

This differentiates Kavach from every text-only scam classifier in the room -
an audio-authenticity check is a distinct signal, not just another keyword.
"""

import torch
import librosa

MODEL_NAME = "garystafford/wav2vec2-deepfake-voice-detector"

_model = None
_feature_extractor = None


def _load_model():
    global _model, _feature_extractor
    if _model is None:
        from transformers import AutoModelForAudioClassification, AutoFeatureExtractor
        _feature_extractor = AutoFeatureExtractor.from_pretrained(MODEL_NAME)
        _model = AutoModelForAudioClassification.from_pretrained(MODEL_NAME)
        _model.eval()
    return _model, _feature_extractor


def detect_deepfake(audio_path):
    """Returns whether the voice in audio_path sounds AI-generated/cloned.
    {"is_synthetic": bool, "confidence": float, "prob_real": float, "prob_fake": float}"""
    model, feature_extractor = _load_model()

    # model was trained on 2.5-13s clips - librosa resamples to 16kHz mono
    audio, sr = librosa.load(audio_path, sr=16000, mono=True)
    inputs = feature_extractor(audio, sampling_rate=16000, return_tensors="pt", padding=True)

    with torch.no_grad():
        logits = model(**inputs).logits
        probs = torch.softmax(logits, dim=-1)[0]

    prob_real = float(probs[0])
    prob_fake = float(probs[1])
    is_synthetic = prob_fake > 0.5

    return {
        "is_synthetic": is_synthetic,
        "confidence": round(prob_fake if is_synthetic else prob_real, 4),
        "prob_real": round(prob_real, 4),
        "prob_fake": round(prob_fake, 4),
    }


def analyze_long_audio(audio_path, chunk_sec=10, max_chunks=None):
    """For full call recordings (minutes long) - the underlying model was
    only trained on 2.5-13s clips, so feeding a whole long file in one shot
    is unreliable AND slow (attention cost grows fast with length). This
    splits the recording into chunk_sec pieces, runs the detector on each,
    and aggregates. Returns per-chunk results plus a summary.

    max_chunks: cap how many chunks actually get analyzed (CPU inference is
    slow, and for testing/demo purposes a sample proves the concept just as
    well as scanning the entire recording - e.g. max_chunks=6 checks the
    first ~60s and returns in a fraction of the time. Leave as None to
    analyze the whole file when you actually need full coverage."""
    from pydub import AudioSegment
    audio = AudioSegment.from_file(audio_path)
    total_sec = int(len(audio) / 1000)

    starts = list(range(0, total_sec, chunk_sec))
    if max_chunks:
        starts = starts[:max_chunks]

    chunks_result = []
    for start in starts:
        chunk = audio[start * 1000:(start + chunk_sec) * 1000]
        chunk_path = "_deepfake_chunk.wav"
        chunk.export(chunk_path, format="wav")
        try:
            r = detect_deepfake(chunk_path)
            r["time"] = f"{start}-{start + chunk_sec}s"
            chunks_result.append(r)
        except Exception as e:
            chunks_result.append({"time": f"{start}-{start + chunk_sec}s", "error": str(e)})

    synthetic_chunks = [c for c in chunks_result if c.get("is_synthetic")]
    summary = {
        "total_chunks": len(chunks_result),
        "synthetic_chunks": len(synthetic_chunks),
        "any_synthetic_detected": len(synthetic_chunks) > 0,
        "max_fake_confidence": max((c.get("prob_fake", 0) for c in chunks_result), default=0),
    }
    return chunks_result, summary


if __name__ == "__main__":
    result = detect_deepfake("scam_call.mp3")  # change to a real file to test
    print(result)