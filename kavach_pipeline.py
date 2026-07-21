"""
Kavach - Unified Detection Pipeline
====================================
Everything in ONE place: MuRIL model + Whisper + chunked streaming.
Import this from the backend API - one class, clean methods, structured output.

Usage:
    from kavach_pipeline import KavachPipeline
    kavach = KavachPipeline(model_path="path/to/kavach_muril")

    kavach.check_text("This is CBI, you are under digital arrest")
    # -> {"is_scam": True, "verdict": "scam", "confidence": 0.997, "language": "en"}

    kavach.check_audio("scam_call.mp3")
    # -> {..., "transcript": "...", "language": "hi"}

    for update in kavach.stream_audio("scam_call.mp3"):
        print(update)   # live per-chunk results, with alert flag
"""

import os
import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer
from faster_whisper import WhisperModel
from tactic_engine import detect_tactics, progression_score, active_tactic_labels
from indic_asr import transcribe_indic
from llm_tactic_tagger import tag_tactics_llm
from deepfake_detector import analyze_long_audio
from honeypot_agent import extract_payment_details


class KavachPipeline:
    def __init__(self, model_path, whisper_size=None, max_len=128):
        """Load MuRIL (scam detector) + Whisper (speech-to-text) once.

        whisper_size: if not passed, read from the WHISPER_SIZE env var,
        defaulting to 'small'. This is how we run a big accurate model
        (large-v3) on the AWS GPU server (set WHISPER_SIZE=large-v3 in the
        server's .env) while keeping a light model locally on CPU - same code,
        right model per environment."""
        self.max_len = max_len
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        if whisper_size is None:
            whisper_size = os.environ.get("WHISPER_SIZE", "small")

        # --- MuRIL: the scam detector ---
        self.tokenizer = AutoTokenizer.from_pretrained(model_path)
        self.model = AutoModelForSequenceClassification.from_pretrained(model_path)
        self.model.to(self.device)
        self.model.eval()

        # --- Whisper: speech to text ---
        # Auto-use GPU when available (e.g. on the AWS GPU server) - float16 is
        # fast + accurate there. Falls back to CPU int8 locally. This is what
        # lets us run a BIGGER whisper_size (small/large-v3) fast in the cloud
        # instead of being stuck on 'tiny' for CPU speed.
        if torch.cuda.is_available():
            self.whisper = WhisperModel(whisper_size, device="cuda", compute_type="float16")
        else:
            self.whisper = WhisperModel(whisper_size, device="cpu", compute_type="int8")

    # ---------------------------------------------------------------
    # 1. TEXT -> verdict
    # ---------------------------------------------------------------
    def check_text(self, text):
        enc = self.tokenizer(text, return_tensors="pt", truncation=True,
                             max_length=self.max_len).to(self.device)
        with torch.no_grad():
            probs = torch.softmax(self.model(**enc).logits, dim=-1)[0]
        scam_prob = float(probs[1])
        is_scam = scam_prob > 0.5

        # --- Tactic Decomposition: WHICH manipulation tactics are present ---
        tactics = detect_tactics(text)
        tactic_source = "keywords"

        # Fallback: if MuRIL confidently says SCAM but the keyword engine found
        # nothing (the real gap we saw in testing), ask the LLM tagger instead.
        # Never runs on safe/uncertain text - keeps cost and latency minimal.
        if is_scam and scam_prob > 0.8 and not any(tactics.values()):
            llm_result = tag_tactics_llm(text)
            llm_tactics = {k: llm_result.get(k, False) for k in tactics}
            if any(llm_tactics.values()):
                tactics = llm_tactics
                tactic_source = "llm_fallback"

        # --- Live intel extraction: pull any UPI ID / account number the
        # scammer said, straight out of the transcript we're already hearing.
        # No interaction with the scammer, no new audio - just pattern
        # matching on text. Cheap enough to run on every check; only
        # meaningful when something was actually found. ---
        extracted = extract_payment_details(text)
        has_intel = bool(extracted["upi_ids"] or extracted["account_numbers"])

        return {
            "is_scam": is_scam,
            "verdict": "scam" if is_scam else "safe",
            "confidence": round(scam_prob if is_scam else 1 - scam_prob, 4),
            "scam_probability": round(scam_prob, 4),
            "tactics": tactics,
            "active_tactics": active_tactic_labels(tactics),
            "progression": progression_score(tactics),
            "tactic_source": tactic_source,
            "extracted_payment_details": extracted,
            "has_payment_intel": has_intel,
        }

    # ---------------------------------------------------------------
    # 2. AUDIO (whole clip) -> transcript + verdict
    # ---------------------------------------------------------------
    def check_audio(self, audio_path, use_indic_asr=True, include_deepfake=True):
        """Whisper does quick language detection first. If the detected
        language is an Indian language IndicConformer supports, we re-transcribe
        with IndicConformer for better accuracy (fixes garbled Hindi/regional
        audio) - that transcript is what actually gets classified. English
        and unsupported languages just keep the Whisper transcript.

        For the LIVE mobile path, call with use_indic_asr=False,
        include_deepfake=False -> fast Whisper-only, so a phone chunk gets a
        verdict quickly. The heavier IndicConformer + deepfake analysis is for
        uploaded/complete recordings where latency doesn't matter."""
        segments, info = self.whisper.transcribe(audio_path, task="transcribe")
        whisper_transcript = " ".join(seg.text for seg in segments).strip()
        language = info.language

        transcript = whisper_transcript
        asr_engine = "whisper"

        if use_indic_asr:
            indic_text = transcribe_indic(audio_path, language)
            if indic_text:
                transcript = indic_text
                asr_engine = "indic-conformer"

        result = self.check_text(transcript)
        result["transcript"] = transcript
        result["language"] = language
        result["asr_engine"] = asr_engine

        # Deepfake/AI-voice check - chunked (the model was only trained on
        # 2.5-13s clips, so long recordings must be split, not fed whole).
        # Skipped on the fast/live path. Wrapped so a detector hiccup never
        # breaks the core scam verdict.
        if include_deepfake:
            try:
                _, deepfake_summary = analyze_long_audio(audio_path, max_chunks=6)
                result["deepfake"] = deepfake_summary
            except Exception as e:
                result["deepfake"] = {"error": str(e)}

        return result

    # ---------------------------------------------------------------
    # 3. AUDIO (streaming) -> live per-chunk verdicts (the real-time demo)
    # ---------------------------------------------------------------
    def stream_audio(self, audio_path, chunk_sec=20, use_indic_asr=True):
        """Yields a result dict per chunk. 'alert' flips True the moment a scam
        is first detected - i.e. catching it DURING the call.

        Each chunk is transcribed the same hybrid way as check_audio(): Whisper
        detects the language, then IndicConformer re-transcribes that chunk for
        better accuracy if it's a supported Indian language. Processing in
        chunks (not the whole call at once) is also what keeps this safe and
        fast for long recordings - a 17-minute call is ~50 chunks of ~20s each,
        not one giant multi-minute inference call."""
        from pydub import AudioSegment
        from indic_asr import transcribe_indic
        audio = AudioSegment.from_file(audio_path)
        total = int(len(audio) / 1000)

        running_text = ""
        alerted = False
        for start in range(0, total, chunk_sec):
            chunk = audio[start * 1000:(start + chunk_sec) * 1000]
            chunk.export("_chunk.wav", format="wav")
            segments, info = self.whisper.transcribe("_chunk.wav", task="transcribe")
            chunk_text = " ".join(seg.text for seg in segments).strip()

            if use_indic_asr:
                indic_text = transcribe_indic("_chunk.wav", info.language)
                if indic_text:
                    chunk_text = indic_text

            running_text += " " + chunk_text

            result = self.check_text(running_text)
            new_alert = result["is_scam"] and not alerted
            if new_alert:
                alerted = True

            yield {
                "time": f"{start}-{start + chunk_sec}s",
                "seconds": start + chunk_sec,
                "chunk_text": chunk_text,
                "verdict": result["verdict"],
                "confidence": result["confidence"],
                "alert": new_alert,   # True only on the first scam detection
                # tactics are computed on running_text (everything heard so far),
                # so this is naturally cumulative - once a tactic fires, it stays lit.
                "active_tactics": result["active_tactics"],
                "progression": result["progression"],
            }


# ---------------------------------------------------------------
# quick standalone test
# ---------------------------------------------------------------
if __name__ == "__main__":
    MODEL_PATH = "/content/drive/MyDrive/kavach/kavach_muril"   # change to your path
    kavach = KavachPipeline(MODEL_PATH)

    print(kavach.check_text("This is CBI, you are under digital arrest, transfer money now"))
    print(kavach.check_text("बेटा ऑफिस पहुँच गया, फ्री हो तो कॉल करना"))

    # audio tests (uncomment with a real file):
    # print(kavach.check_audio("scam_call.mp3"))
    # for u in kavach.stream_audio("scam_call.mp3"):
    #     print(u)