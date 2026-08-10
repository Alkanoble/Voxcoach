"""Pronunciation assessment using Whisper confidence scores + CMU dict + g2p-en fallback."""

import logging
import nltk

logger = logging.getLogger(__name__)

_g2p = None

# Average spoken English: ~150 wpm → ~0.4s/word
# Flag words that take unusually long (struggling) or very short (mumbling)
_AVG_SECONDS_PER_CHAR = 0.07   # rough: a 5-char word ~0.35s

ARPABET_MAP = {
    "AA": "ah", "AE": "a", "AH": "uh", "AO": "aw", "AW": "ow",
    "AY": "eye", "EH": "eh", "ER": "ur", "EY": "ay", "IH": "ih",
    "IY": "ee", "OW": "oh", "OY": "oy", "UH": "oo", "UW": "oo",
    "B": "b", "CH": "ch", "D": "d", "DH": "th", "F": "f", "G": "g",
    "HH": "h", "JH": "j", "K": "k", "L": "l", "M": "m", "N": "n",
    "NG": "ng", "P": "p", "R": "r", "S": "s", "SH": "sh", "T": "t",
    "TH": "th", "V": "v", "W": "w", "Y": "y", "Z": "z", "ZH": "zh"
}

def to_friendly_phonetics(phones_str: str) -> str:
    phones = [p.rstrip('012') for p in phones_str.split()]
    return "-".join(ARPABET_MAP.get(p, p.lower()) for p in phones)

def _get_g2p():
    global _g2p
    if _g2p is None:
        try:
            nltk.data.find('corpora/cmudict.zip')
        except LookupError:
            nltk.download('cmudict')
        from g2p_en import G2p
        _g2p = G2p()
        logger.info("g2p-en model loaded")
    return _g2p


def _get_pronunciation_hint(word: str) -> tuple[str, int]:
    """
    Return (readable pronunciation hint, syllable count).
    Uses CMU Pronouncing Dictionary first, falls back to g2p-en.
    """
    import pronouncing

    phones = pronouncing.phones_for_word(word)
    if phones:
        # CMU dict hit — use first pronunciation entry
        phone_str = phones[0]
        syllables = pronouncing.syllable_count(phone_str)
        readable = to_friendly_phonetics(phone_str)
        return readable, syllables

    # Fallback to g2p-en for words not in CMU dict
    g2p = _get_g2p()
    phonemes = g2p(word)
    readable = to_friendly_phonetics(" ".join(p for p in phonemes if p.strip()))
    # Estimate syllables: count vowel phonemes
    vowels = sum(1 for p in phonemes if p and p[0] in "AEIOU")
    return readable, max(1, vowels)


def _duration_issue(word: str, duration: float) -> str | None:
    """Flag words whose spoken duration is suspicious."""
    expected = len(word) * _AVG_SECONDS_PER_CHAR
    if duration > expected * 3.0 and duration > 0.8:
        return f"spoken very slowly ({duration:.1f}s) — may indicate difficulty"
    if duration < 0.08 and len(word) > 3:
        return f"spoken very fast ({duration:.2f}s) — may sound mumbled"
    return None


def assess_pronunciation(words: list[dict], confidence_threshold: float = 0.5) -> list[dict]:
    """
    Assess pronunciation quality from Whisper word-level data.

    Signals used:
    1. Whisper confidence  — primary indicator of unclear pronunciation
    2. Word duration       — too slow = struggling, too fast = mumbling
    3. CMU Pronouncing Dict + g2p-en fallback — accurate pronunciation hints

    Args:
        words: list of {"word": str, "start": float, "end": float, "confidence": float}
        confidence_threshold: words below this confidence are flagged

    Returns:
        list of {"word", "issue", "suggestion", "confidence", "timestamp"}
    """
    if not words:
        return []

    issues = []
    seen_words: set[str] = set()

    for w in words:
        clean = w["word"].strip(".,!?;:'\"").lower()

        if len(clean) <= 2 or clean in seen_words:
            continue

        duration = round(w["end"] - w["start"], 3)
        confidence = w["confidence"]

        issue_text = None
        source = ""

        if confidence < confidence_threshold:
            seen_words.add(clean)
            if confidence < 0.3:
                issue_text = f"very unclear pronunciation ({confidence:.0%} confidence)"
            elif confidence < 0.4:
                issue_text = f"unclear pronunciation ({confidence:.0%} confidence)"
            else:
                issue_text = f"slightly unclear pronunciation ({confidence:.0%} confidence)"
            source = "confidence"

        dur_issue = _duration_issue(clean, duration)
        if dur_issue and source != "confidence":
            seen_words.add(clean)
            issue_text = dur_issue
            source = "duration"
        elif dur_issue and source == "confidence":
            # Append duration note to confidence issue
            issue_text += f"; also {dur_issue}"
        
        

        if issue_text:
            try:
                hint, syllables = _get_pronunciation_hint(clean)
                syllable_note = f"{syllables}-syllable word" if syllables > 1 else "1-syllable word"
                suggestion = f"/{hint}/ ({syllable_note})"
            except Exception:
                suggestion = "pronunciation guide unavailable"

            issues.append({
                "word": w["word"].strip(),
                "issue": issue_text,
                "suggestion": suggestion,
                "confidence": confidence,
                "timestamp": w["start"],
            })

    issues.sort(key=lambda x: x["confidence"])
    return issues
