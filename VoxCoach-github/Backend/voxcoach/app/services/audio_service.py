import os

import librosa
import numpy as np
from pydub import AudioSegment


def convert_to_wav(input_path: str) -> str:
    """Convert any audio file to WAV format. Returns path to WAV file."""
    wav_path = os.path.splitext(input_path)[0] + ".wav"
    if input_path.endswith(".wav"):
        return input_path
    audio = AudioSegment.from_file(input_path)
    audio.export(wav_path, format="wav")
    return wav_path


def analyze_audio(wav_path: str) -> dict:
    """Analyze audio for pitch, pauses, and timing metrics."""
    y, sr = librosa.load(wav_path, sr=None)
    duration = librosa.get_duration(y=y, sr=sr)

    # Pitch analysis using pyin
    f0, voiced_flag, voiced_probs = librosa.pyin(y, fmin=50, fmax=500, sr=sr)
    f0_clean = f0[~np.isnan(f0)]
    avg_pitch = float(np.mean(f0_clean)) if len(f0_clean) > 0 else 0.0
    pitch_std = float(np.std(f0_clean)) if len(f0_clean) > 0 else 0.0

    # Pause/silence detection
    intervals = librosa.effects.split(y, top_db=30)
    pauses = []
    total_speaking = 0.0

    for i, (start, end) in enumerate(intervals):
        speaking_dur = (end - start) / sr
        total_speaking += speaking_dur
        if i > 0:
            prev_end = intervals[i - 1][1]
            gap_start = prev_end / sr
            gap_end = start / sr
            gap_dur = gap_end - gap_start
            if gap_dur > 0.3:  # only count pauses longer than 300ms
                pauses.append(
                    {
                        "start": round(gap_start, 2),
                        "end": round(gap_end, 2),
                        "duration": round(gap_dur, 2),
                    }
                )

    total_pause = sum(p["duration"] for p in pauses)

    return {
        "duration_seconds": round(duration, 2),
        "avg_pitch_hz": round(avg_pitch, 1),
        "pitch_variability": round(pitch_std, 1),
        "pauses": pauses,
        "total_pause_time": round(total_pause, 2),
        "total_speaking_time": round(total_speaking, 2),
    }
