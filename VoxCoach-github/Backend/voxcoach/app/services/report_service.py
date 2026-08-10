import json
import logging

from sqlalchemy.orm import Session

from app.models import Recording, Report
from app.services.audio_service import analyze_audio, convert_to_wav

logger = logging.getLogger(__name__)


def get_or_create_report(recording: Recording, db: Session) -> Report:
    """Get existing report or create a blank one for this recording."""
    report = db.query(Report).filter(Report.recording_id == recording.id).first()
    if not report:
        report = Report(recording_id=recording.id)
        db.add(report)
        db.commit()
        db.refresh(report)
    return report


def run_step_transcribe(recording: Recording, db: Session) -> Report:
    """Step 1: Whisper transcription."""
    wav_path = convert_to_wav(recording.file_path)
    report = get_or_create_report(recording, db)

    try:
        from app.services.whisper_service import transcribe

        result = transcribe(wav_path)
        report.transcript = result.get("transcript", "")
        report.whisper_words = json.dumps(result.get("words", []))
        report.low_confidence_words = json.dumps(result.get("low_confidence_words", []))
        report.whisper_ok = True
        errors = json.loads(report.errors)
        errors = [e for e in errors if not e.startswith("Transcription")]
        report.errors = json.dumps(errors)
        logger.info("Whisper completed: %d words", len(result.get("words", [])))
    except Exception as e:
        logger.error("Whisper failed: %s", e)
        report.whisper_ok = False
        errors = json.loads(report.errors)
        errors = [e for e in errors if not e.startswith("Transcription")]
        errors.append(f"Transcription (Whisper): {str(e)}")
        report.errors = json.dumps(errors)

    db.commit()
    db.refresh(report)
    return report


def run_step_audio(recording: Recording, db: Session) -> Report:
    """Step 2: Audio analysis (pitch, pauses, duration)."""
    wav_path = convert_to_wav(recording.file_path)
    report = get_or_create_report(recording, db)

    try:
        audio_results = analyze_audio(wav_path)
        report.avg_pitch_hz = audio_results.get("avg_pitch_hz")
        report.pitch_variability = audio_results.get("pitch_variability")
        report.pauses = json.dumps(audio_results.get("pauses", []))
        report.total_pause_time = audio_results.get("total_pause_time")
        report.total_speaking_time = audio_results.get("total_speaking_time")
        report.duration_seconds = audio_results.get("duration_seconds")

        # Compute WPM if transcript is available
        transcript = report.transcript or ""
        word_count = len(transcript.split()) if transcript else 0
        speaking_time = audio_results.get("total_speaking_time", 0)
        report.speaking_pace_wpm = (
            round(word_count / (speaking_time / 60), 1) if speaking_time > 0 else None
        )

        report.audio_ok = True
        errors = json.loads(report.errors)
        errors = [e for e in errors if not e.startswith("Audio")]
        report.errors = json.dumps(errors)
        logger.info("Audio analysis completed")
    except Exception as e:
        logger.error("Audio analysis failed: %s", e)
        report.audio_ok = False
        errors = json.loads(report.errors)
        errors = [e for e in errors if not e.startswith("Audio")]
        errors.append(f"Audio analysis: {str(e)}")
        report.errors = json.dumps(errors)

    db.commit()
    db.refresh(report)
    return report


def run_step_gemini(recording: Recording, db: Session) -> Report:
    """Step 3: Local filler/pronunciation detection + text-only Gemini for grammar & scores."""
    report = get_or_create_report(recording, db)
    transcript = report.transcript or ""
    whisper_words = json.loads(report.whisper_words)

    # --- Local: Filler detection ---
    filler_summary = "none"
    try:
        from app.services.filler_service import detect_fillers

        fillers = detect_fillers(transcript, whisper_words)
        report.filler_words = json.dumps(fillers)
        if fillers:
            filler_summary = ", ".join(
                f"'{f['word']}' x{f['count']}" for f in fillers[:5]
            )
        logger.info("Filler detection: %d types found", len(fillers))
    except Exception as e:
        logger.warning("Filler detection failed: %s", e)
        report.filler_words = json.dumps([])

    # --- Local: Pronunciation assessment ---
    pronunciation_summary = "none"
    try:
        from app.services.pronunciation_service import assess_pronunciation

        pron_issues = assess_pronunciation(whisper_words)
        report.pronunciation_issues = json.dumps(pron_issues)
        if pron_issues:
            pronunciation_summary = f"{len(pron_issues)} words flagged: " + ", ".join(
                p["word"] for p in pron_issues[:5]
            )
        logger.info("Pronunciation assessment: %d issues", len(pron_issues))
    except Exception as e:
        logger.warning("Pronunciation assessment failed: %s", e)
        report.pronunciation_issues = json.dumps([])

    # --- Gemini: Grammar + fluency notes + scores (text only, no audio) ---
    try:
        from app.services.gemini_service import analyze_text

        pauses = json.loads(report.pauses)
        gemini_results = analyze_text(
            transcript=transcript,
            wpm=report.speaking_pace_wpm,
            avg_pitch=report.avg_pitch_hz,
            pitch_var=report.pitch_variability,
            duration=report.duration_seconds,
            speaking_time=report.total_speaking_time,
            pause_time=report.total_pause_time,
            pause_count=len(pauses),
            filler_summary=filler_summary,
            pronunciation_summary=pronunciation_summary,
        )

        report.grammar_issues = json.dumps(gemini_results.get("grammar_issues", []))
        report.fluency_notes = gemini_results.get("fluency_notes", "")
        report.gemini_feedback = gemini_results.get("overall_feedback", "")
        report.overall_score = gemini_results.get("estimated_score")
        sub = gemini_results.get("sub_scores", {})
        report.score_grammar = sub.get("grammar")
        report.score_pronunciation = sub.get("pronunciation")
        report.score_vocabulary = sub.get("vocabulary")
        report.score_confidence = sub.get("confidence")
        report.score_fluency = sub.get("fluency")
        report.gemini_ok = True
        errors = json.loads(report.errors)
        errors = [e for e in errors if not e.startswith("AI analysis")]
        report.errors = json.dumps(errors)
        logger.info("Gemini text analysis completed")
    except Exception as e:
        logger.error("Gemini failed: %s", e)
        report.gemini_ok = False
        errors = json.loads(report.errors)
        errors = [e for e in errors if not e.startswith("AI analysis")]
        errors.append(f"AI analysis (Gemini): {str(e)}")
        report.errors = json.dumps(errors)

    db.commit()
    db.refresh(report)
    return report
