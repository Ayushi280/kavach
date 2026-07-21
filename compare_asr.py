"""
Compares Whisper-only vs the new IndicConformer-hybrid transcription, chunk
by chunk, on a real (possibly long) call recording. Safer and faster than
feeding a long file into IndicConformer in one shot - also matches how a real
live call would actually be processed (in streaming chunks).
"""

from pydub import AudioSegment
import pydub.utils

FFMPEG_PATH = r"C:\Users\Hp\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.2-full_build\bin\ffmpeg.exe"
FFPROBE_PATH = r"C:\Users\Hp\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.2-full_build\bin\ffprobe.exe"

AudioSegment.converter = FFMPEG_PATH
pydub.utils.get_prober_name = lambda: FFPROBE_PATH

from kavach_pipeline import KavachPipeline

AUDIO_PATH = r"scam_call.mp3"
CHUNK_SEC = 20

kavach = KavachPipeline("model")

print(f"Processing {AUDIO_PATH} in {CHUNK_SEC}s chunks (first run downloads "
      f"the 600M IndicConformer model - can take a few minutes)...\n")

for update in kavach.stream_audio(AUDIO_PATH, chunk_sec=CHUNK_SEC, use_indic_asr=True):
    print(f"[{update['time']}] {update['verdict'].upper()} ({update['confidence']*100:.1f}%) "
          f"| tactics: {update['active_tactics']}")
    print(f"   text: {update['chunk_text']}")
    if update["alert"]:
        print("   >>> 🚨 FIRST SCAM ALERT TRIGGERED HERE <<<")
    print()