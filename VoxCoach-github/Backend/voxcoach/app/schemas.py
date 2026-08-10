from datetime import datetime

from pydantic import BaseModel, EmailStr


# Cleaned up obsolete auth schemas


# --- Recordings ---
class RecordingResponse(BaseModel):
    id: int
    filename: str
    original_filename: str
    duration_seconds: float | None
    has_report: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Report ---
class GrammarIssue(BaseModel):
    original: str
    correction: str
    explanation: str


class PronunciationIssue(BaseModel):
    word: str
    issue: str
    suggestion: str


class FillerWord(BaseModel):
    word: str
    count: int
    context_examples: list[str] = []


class Pause(BaseModel):
    start: float
    end: float
    duration: float


class WhisperWord(BaseModel):
    word: str
    start: float
    end: float
    confidence: float


class ReportResponse(BaseModel):
    id: str | int
    recording_id: str | int
    transcript: str
    grammar_issues: list[GrammarIssue]
    pronunciation_issues: list[PronunciationIssue]
    filler_words: list[FillerWord]
    fluency_notes: str
    gemini_feedback: str
    speaking_pace_wpm: float | None
    avg_pitch_hz: float | None
    pitch_variability: float | None
    pauses: list[Pause]
    total_pause_time: float | None
    total_speaking_time: float | None
    duration_seconds: float | None
    whisper_words: list[WhisperWord]
    low_confidence_words: list[WhisperWord]
    overall_score: int | None
    score_grammar: int | None
    score_pronunciation: int | None
    score_vocabulary: int | None
    score_confidence: int | None
    score_fluency: int | None
    sentiment_score: float | None = None
    sentiment_label: str | None = None
    readability_score: str | None = None
    whisper_ok: bool
    audio_ok: bool
    gemini_ok: bool
    errors: list[str]
    created_at: datetime


# --- Rephrase ---
class RephraseRequest(BaseModel):
    text: str
    style: str = "natural"  # formal | simple | confident | concise | natural
    count: int = 3


class RephraseResponse(BaseModel):
    original: str
    style: str
    rephrased: list[str]
    tip: str
