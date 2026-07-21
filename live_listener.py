"""
Kavach - Speakerphone Companion (live microphone listener)
===========================================================
THE HONEST live-capture story. Third-party apps CANNOT record phone calls on
modern Android (Google banned the Accessibility-API method in 2024; even
Truecaller dropped call recording). So Kavach does NOT tap the call stream.

Instead - exactly how elderly victims already use phones - the call is put on
SPEAKER, and Kavach listens through the device's own microphone (ambient
audio). This is:
  - Legal: you're a party to your own call, consenting to your own mic.
  - Buildable: standard microphone access, no banned APIs.
  - Honest: no pretending to secretly intercept calls.
  - Realistic: "a hearing aid that understands scams."

This script is the laptop/demo version (uses the computer's mic). On a phone
it becomes a foreground service using the same mic API. Everything downstream
- ASR (Whisper + IndicConformer), MuRIL, tactic decomposition - is the SAME
pipeline used for uploaded recordings; only the audio SOURCE changed.

On first scam detection it: opens the payment risk window (arming the circuit
breaker), fires the Family Alert, and can play the Guardian Voice warning.

Requires: pip install sounddevice soundfile
"""

import os
import time
import queue
import numpy as np
import soundfile as sf
import sounddevice as sd
import torch

# Cap PyTorch's CPU thread pool so it doesn't monopolize every core - the
# mic's audio callback runs on its own thread and needs to be scheduled
# promptly, or PortAudio's internal buffer overflows (confirmed by testing:
# repeated "input overflow" + Whisper hallucinating on dropped audio). Leaving
# at least one core free for the callback thread fixes the root cause, not
# just the symptom.
_cpu_count = os.cpu_count() or 4
torch.set_num_threads(max(1, _cpu_count - 1))

from kavach_pipeline import KavachPipeline
from deepfake_detector import detect_deepfake

# these live in the backend folder; the demo runs from wherever both are importable
try:
    from risk_session import open_risk_session
except ImportError:
    open_risk_session = None
try:
    from family_alert import send_family_alert
except ImportError:
    send_family_alert = None
try:
    from guardian_voice import generate_voice
except ImportError:
    generate_voice = None

SAMPLE_RATE = 16000        # what Whisper/IndicConformer expect
CHUNK_SECONDS = 5          # analyze every 5s of speech
CHUNK_FILE = "_live_chunk.wav"


class SpeakerphoneCompanion:
    def __init__(self, model_path="model", user_id="demo_victim", whisper_size=None):
        # Local CPU default = 'tiny' (light, keeps pace with the mic thread).
        # On the GPU server, WHISPER_SIZE=large-v3 in .env overrides this so the
        # live path also gets the accurate model - GPU makes it fast enough.
        if whisper_size is None:
            whisper_size = os.environ.get("WHISPER_SIZE", "tiny")
        print(f"Loading Kavach pipeline (MuRIL + Whisper '{whisper_size}')...")
        self.kavach = KavachPipeline(model_path, whisper_size=whisper_size)
        self.user_id = user_id
        self.running_text = ""
        self.alerted = False
        self.deepfake_flagged = False   # sticky - once flagged, keep showing it
        self._audio_q = queue.Queue()

    def _mic_callback(self, indata, frames, time_info, status):
        """Called by sounddevice for each mic buffer - just queue the audio."""
        if status:
            print("mic status:", status)
        self._audio_q.put(indata.copy())

    def _on_first_scam(self, result):
        """Fire the autonomous interventions - the victim does nothing."""
        print("\n" + "=" * 55)
        print("🚨 SCAM DETECTED - triggering autonomous protection")
        print("=" * 55)

        if open_risk_session:
            open_risk_session(self.user_id, "Live scam call detected",
                              confidence=result["confidence"],
                              active_tactics=result["active_tactics"])
            print("   ✅ Payment circuit breaker ARMED (risk window open)")

        if send_family_alert:
            r = send_family_alert(self.user_id, active_tactics=result["active_tactics"],
                                  confidence=result["confidence"],
                                  extracted_payment_details=result.get("extracted_payment_details"))
            print(f"   {'✅' if r.get('sent') else '⚠️'} Family alert: {r}")

        if generate_voice:
            lang = result.get("language", "hi")
            path = generate_voice(lang, result.get("tactics"), out_path="_live_guardian.mp3")
            print(f"   ✅ Guardian Voice warning generated: {path}")
            try:
                data, sr = sf.read(path, dtype="float32")
                sd.play(data, sr)
            except Exception as e:
                print("   (couldn't auto-play guardian voice:", e, ")")
        print("=" * 55 + "\n")

    def listen(self, max_seconds=None):
        """Start listening on the mic. Ctrl+C to stop, or set max_seconds.

        REAL-TIME DESIGN NOTE: this uses Whisper ONLY for live chunks, not the
        IndicConformer hybrid check_audio() uses. IndicConformer (600M params,
        CPU) is too slow per-chunk to keep up with live audio - using it here
        would make the pipeline fall further and further behind, which is
        exactly the "nothing happens until I stop talking" bug. IndicConformer
        stays reserved for check_audio() on uploaded/complete recordings,
        where taking extra time for better accuracy is the right trade-off.

        We also actively DISCARD any backlog beyond the current chunk, so the
        system always analyzes close to 'now' instead of catching up on stale
        audio - staying real-time matters more than transcribing every second."""
        print("\n🎙️  Kavach is listening (put the call on SPEAKER)...")
        print("    Speak or play a scam-call recording near the mic.\n")
        start = time.time()

        with sd.InputStream(samplerate=SAMPLE_RATE, channels=1,
                            blocksize=4000,  # ~0.25s per callback - steadier,
                                             # less overhead than the default
                            callback=self._mic_callback):
            buffer = np.zeros((0, 1), dtype=np.float32)
            while True:
                # drain everything currently queued in one go, not one item at
                # a time - lets us detect and drop backlog instead of slowly
                # falling behind it
                new_audio = [self._audio_q.get()]
                while not self._audio_q.empty():
                    new_audio.append(self._audio_q.get_nowait())
                buffer = np.concatenate([buffer] + new_audio)

                if len(buffer) >= SAMPLE_RATE * CHUNK_SECONDS:
                    # keep only the most recent CHUNK_SECONDS of audio - if we
                    # fell behind, older backlog audio is dropped rather than
                    # processed late. Real-time > completeness for a live warning.
                    chunk = buffer[-SAMPLE_RATE * CHUNK_SECONDS:]
                    buffer = np.zeros((0, 1), dtype=np.float32)
                    sf.write(CHUNK_FILE, chunk, SAMPLE_RATE)

                    # LIVE PATH: Whisper only - fast enough to keep pace.
                    segments, info = self.kavach.whisper.transcribe(
                        CHUNK_FILE, task="transcribe")
                    chunk_text = " ".join(seg.text for seg in segments).strip()
                    if not chunk_text:
                        continue

                    self.running_text += " " + chunk_text
                    verdict = self.kavach.check_text(self.running_text)

                    # Deepfake/AI-voice check on THIS chunk's raw audio - a
                    # signal independent of what's being said. Wrapped so a
                    # detector hiccup never breaks the live loop.
                    try:
                        df = detect_deepfake(CHUNK_FILE)
                        if df["is_synthetic"] and df["confidence"] > 0.7:
                            self.deepfake_flagged = True
                    except Exception as e:
                        df = {"error": str(e)}

                    tag = "🔴 SCAM" if verdict["is_scam"] else "🟢 safe"
                    voice_tag = " ⚠️ AI-VOICE" if self.deepfake_flagged else ""
                    print(f"[{int(time.time()-start)}s] {tag}{voice_tag} "
                          f"({verdict['confidence']*100:.0f}%) | "
                          f"tactics: {verdict['active_tactics']}")
                    print(f"    heard: {chunk_text}")
                    if "error" not in df:
                        print(f"    voice check: {'SYNTHETIC' if df['is_synthetic'] else 'human'} "
                              f"({df['confidence']*100:.0f}%)")
                    if verdict.get("has_payment_intel"):
                        print(f"    💳 HARVESTED FROM SCAMMER: "
                              f"{verdict['extracted_payment_details']}")

                    if verdict["is_scam"] and not self.alerted:
                        self.alerted = True
                        self._on_first_scam(verdict)

                if max_seconds and (time.time() - start) > max_seconds:
                    print("\n(stopped - reached max_seconds)")
                    break


if __name__ == "__main__":
    companion = SpeakerphoneCompanion(model_path="model")
    try:
        companion.listen()
    except KeyboardInterrupt:
        print("\nStopped listening.")