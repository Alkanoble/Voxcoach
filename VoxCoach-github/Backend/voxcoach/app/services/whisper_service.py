import logging

from faster_whisper import WhisperModel

logger = logging.getLogger(__name__)

_model = None


def _get_model() -> WhisperModel:
    """Lazy-load the Whisper model (downloaded once, cached)."""
    global _model
    if _model is None:
        logger.info("Loading Whisper model (small)...")
        _model = WhisperModel("small", device="cpu", compute_type="int8")
        logger.info("Whisper model loaded.")
    return _model


def transcribe(wav_path: str) -> dict:
    """
    Transcribe audio using faster-whisper.

    Returns:
        {
            "transcript": "full text",
            "words": [
                {"word": "hello", "start": 0.0, "end": 0.5, "confidence": 0.95},
                ...
            ],
            "low_confidence_words": [
                {"word": "...", "start": ..., "end": ..., "confidence": ...},
                ...
            ]
        }
    """
    model = _get_model()

    # vad_filter=False: don't strip short silences/hesitations so fillers are preserved
    # initial_prompt: nudges Whisper to transcribe disfluencies instead of cleaning them up
    segments, info = model.transcribe(
        wav_path,
        beam_size=5,
        word_timestamps=True,
        vad_filter=False,
        initial_prompt="um, uh, ah, like, you know, so, basically, actually, hmm, er",
    )

    all_words = []
    text_parts = []

    for segment in segments:
        text_parts.append(segment.text)
        if segment.words:
            for w in segment.words:
                all_words.append({
                    "word": w.word.strip(),
                    "start": round(w.start, 2),
                    "end": round(w.end, 2),
                    "confidence": round(w.probability, 3),
                })

    transcript = " ".join(text_parts).strip()

    # Flag words with low confidence as potential pronunciation issues
    # Threshold: below 0.5 is likely mispronounced or unclear
    low_confidence = [
        w for w in all_words
        if w["confidence"] < 0.5 and len(w["word"]) > 1
    ]

    return {
        "transcript": transcript,
        "words": all_words,
        "low_confidence_words": low_confidence,
        "language": info.language,
        "language_probability": round(info.language_probability, 3),
    }
