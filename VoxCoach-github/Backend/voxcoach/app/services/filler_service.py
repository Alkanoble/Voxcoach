"""Local filler word detection from Whisper transcript + word timestamps."""

import re

# Filler patterns: exact words and multi-word fillers
FILLER_WORDS = {
    "um", "uh", "uhm", "umm", "hmm", "hm", "er", "ah", "ahh", "em",
    "erm", "uhh", "uuh", "mm", "mmm", "oh", "huh",
}

# Multi-word fillers and discourse markers used as fillers
FILLER_PHRASES = [
    "you know",
    "i mean",
    "sort of",
    "kind of",
    "you see",
]

# Words that are fillers only when used at the start of a sentence or standalone
CONTEXTUAL_FILLERS = {
    "like",  # filler when not used as verb/preposition
    "so",    # filler when at sentence start
    "basically",
    "actually",
    "literally",
    "right",
    "well",
}


def detect_fillers(transcript: str, words: list[dict]) -> list[dict]:
    """
    Detect filler words from Whisper transcript and word timestamps.

    Args:
        transcript: full transcript text
        words: list of {"word": str, "start": float, "end": float, "confidence": float}

    Returns:
        list of {"word": str, "count": int, "timestamps": [...], "context_examples": [...]}
    """
    if not transcript or not words:
        return []

    filler_counts: dict[str, dict] = {}
    word_texts = [w["word"].lower().strip(".,!?;:") for w in words]

    # Detect single-word fillers
    for i, w in enumerate(words):
        clean = w["word"].lower().strip(".,!?;:'\"")

        is_filler = False
        filler_key = None

        if clean in FILLER_WORDS:
            is_filler = True
            filler_key = clean
        elif clean in CONTEXTUAL_FILLERS:
            # "like" is a filler if surrounded by pauses or at phrase boundaries
            # Simple heuristic: if preceding word ends a phrase or there's a gap
            if clean == "like" and i > 0 and i < len(words) - 1:
                gap_before = w["start"] - words[i - 1]["end"] if i > 0 else 0
                gap_after = words[i + 1]["start"] - w["end"] if i < len(words) - 1 else 0
                if gap_before > 0.2 or gap_after > 0.2:
                    is_filler = True
                    filler_key = "like"
            elif clean == "so" and i == 0:
                is_filler = True
                filler_key = "so"
            elif clean in ("basically", "actually", "literally"):
                is_filler = True
                filler_key = clean

        if is_filler and filler_key:
            if filler_key not in filler_counts:
                filler_counts[filler_key] = {
                    "word": filler_key,
                    "count": 0,
                    "timestamps": [],
                    "context_examples": [],
                }
            filler_counts[filler_key]["count"] += 1
            filler_counts[filler_key]["timestamps"].append(round(w["start"], 2))

            # Build context: 3 words before and after
            start_idx = max(0, i - 3)
            end_idx = min(len(words), i + 4)
            context = " ".join(wd["word"] for wd in words[start_idx:end_idx])
            if len(filler_counts[filler_key]["context_examples"]) < 3:
                filler_counts[filler_key]["context_examples"].append(context)

    # Detect multi-word fillers from transcript
    transcript_lower = transcript.lower()
    for phrase in FILLER_PHRASES:
        count = len(re.findall(r"\b" + re.escape(phrase) + r"\b", transcript_lower))
        if count > 0:
            # Find examples from transcript
            examples = []
            for match in re.finditer(r"\b" + re.escape(phrase) + r"\b", transcript_lower):
                start = max(0, match.start() - 30)
                end = min(len(transcript), match.end() + 30)
                snippet = transcript[start:end].strip()
                if len(examples) < 3:
                    examples.append(f"...{snippet}...")

            filler_counts[phrase] = {
                "word": phrase,
                "count": count,
                "timestamps": [],
                "context_examples": examples,
            }

    # Sort by count descending
    result = sorted(filler_counts.values(), key=lambda x: x["count"], reverse=True)
    return result
