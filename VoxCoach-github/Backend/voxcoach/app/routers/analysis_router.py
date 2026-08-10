import os
import json
import urllib.request
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from typing import Dict, Any

from app.dependencies import get_current_user
from app.config import settings
from app.firebase_admin import get_firestore, get_bucket
from app.schemas import RephraseRequest, RephraseResponse, ReportResponse
from app.services.audio_service import convert_to_wav

router = APIRouter()
logger = logging.getLogger(__name__)

def _get_recording(recording_id: str, uid: str) -> Dict[str, Any]:
    db = get_firestore()
    doc_ref = db.collection('recordings').document(recording_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Recording not found")
    data = doc.to_dict()
    if data.get('uid') != uid:
        raise HTTPException(status_code=403, detail="Not authorized to access this recording")
    data['id'] = recording_id
    return data

def _get_or_create_report(recording_id: str) -> Dict[str, Any]:
    db = get_firestore()
    doc_ref = db.collection('reports').document(recording_id)
    doc = doc_ref.get()
    if doc.exists:
        return doc.to_dict()
    new_report = {
        'recording_id': recording_id,
        'errors': json.dumps([]),
        'created_at': datetime.utcnow().isoformat()
    }
    doc_ref.set(new_report)
    return new_report

def _save_report(recording_id: str, data: Dict[str, Any]):
    db = get_firestore()
    db.collection('reports').document(recording_id).set(data, merge=True)

def _download_audio(download_url: str, recording_id: str) -> str:
    os.makedirs(settings.temp_dir, exist_ok=True)
    local_path = os.path.join(settings.temp_dir, f"{recording_id}.webm")
    if not os.path.exists(local_path):
        if download_url:
            urllib.request.urlretrieve(download_url, local_path)
        else:
            raise FileNotFoundError("Audio file not found locally and no download_url provided.")
    return local_path

def _report_to_response(report_id: str, report: Dict[str, Any]) -> ReportResponse:
    def safe_loads(val):
        if not val:
            return []
        if isinstance(val, str):
            try:
                return json.loads(val)
            except:
                return []
        return val

    # Schema expects int for id, but we use string doc ids now contextually. 
    # FastAPI handles int to string casting if it was string or we just pass the string if schema was updated.
    # We will pass the fields to match the response schema closely.
    
    # ensure it doesn't fail on id being string by parsing
    try:
        rid = int(report_id)
    except:
        rid = report_id
        
    return ReportResponse(
        id=rid,
        recording_id=report.get("recording_id", rid),
        transcript=report.get("transcript", ""),
        grammar_issues=safe_loads(report.get("grammar_issues")),
        pronunciation_issues=safe_loads(report.get("pronunciation_issues")),
        filler_words=safe_loads(report.get("filler_words")),
        fluency_notes=report.get("fluency_notes", ""),
        gemini_feedback=report.get("gemini_feedback", ""),
        speaking_pace_wpm=report.get("speaking_pace_wpm"),
        avg_pitch_hz=report.get("avg_pitch_hz"),
        pitch_variability=report.get("pitch_variability"),
        pauses=safe_loads(report.get("pauses")),
        total_pause_time=report.get("total_pause_time"),
        total_speaking_time=report.get("total_speaking_time"),
        duration_seconds=report.get("duration_seconds"),
        whisper_words=safe_loads(report.get("whisper_words")),
        low_confidence_words=safe_loads(report.get("low_confidence_words")),
        overall_score=report.get("overall_score"),
        score_grammar=report.get("score_grammar"),
        score_pronunciation=report.get("score_pronunciation"),
        score_vocabulary=report.get("score_vocabulary"),
        score_confidence=report.get("score_confidence"),
        score_fluency=report.get("score_fluency"),
        sentiment_score=report.get("sentiment_score"),
        sentiment_label=report.get("sentiment_label"),
        readability_score=report.get("readability_score"),
        whisper_ok=report.get("whisper_ok", False),
        audio_ok=report.get("audio_ok", False),
        gemini_ok=report.get("gemini_ok", False),
        errors=safe_loads(report.get("errors")),
        created_at=datetime.utcnow()
    )


@router.post("/{recording_id}/upload")
async def upload_audio(recording_id: str, file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    _get_recording(recording_id, current_user['uid'])
    
    os.makedirs(settings.temp_dir, exist_ok=True)
    local_path = os.path.join(settings.temp_dir, f"{recording_id}.webm")
    
    with open(local_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)
        
    return {"status": "ok"}


@router.post("/{recording_id}/step/transcribe", response_model=ReportResponse, response_model_by_alias=False)
def step_transcribe(recording_id: str, current_user: dict = Depends(get_current_user)):
    recording = _get_recording(recording_id, current_user['uid'])
    report = _get_or_create_report(recording_id)
    
    local_path = _download_audio(recording.get('download_url', ''), recording_id)
    wav_path = convert_to_wav(local_path)
    
    try:
        from app.services.whisper_service import transcribe
        result = transcribe(wav_path)
        report["transcript"] = result.get("transcript", "")
        report["whisper_words"] = json.dumps(result.get("words", []))
        report["low_confidence_words"] = json.dumps(result.get("low_confidence_words", []))
        report["whisper_ok"] = True
        
        # NLP Local Analytics
        try:
            import nltk
            try:
                nltk.data.find('tokenizers/punkt')
                nltk.data.find('tokenizers/punkt_tab')
            except LookupError:
                nltk.download('punkt')
                nltk.download('punkt_tab')
            
            from textblob import TextBlob
            import textstat
            if result.get("transcript"):
                blob = TextBlob(result["transcript"])
                report["sentiment_score"] = round(blob.sentiment.polarity, 2)
                if blob.sentiment.polarity > 0.15:
                    report["sentiment_label"] = "Positive"
                elif blob.sentiment.polarity < -0.15:
                    report["sentiment_label"] = "Negative"
                else:
                    report["sentiment_label"] = "Neutral"
                
                grade = textstat.text_standard(result["transcript"], float_output=False)
                report["readability_score"] = str(grade)
        except Exception as nlp_e:
            logger.warning(f"NLP analytics failed: {nlp_e}")

        
        errors = json.loads(report.get("errors", "[]"))
        errors = [e for e in errors if not isinstance(e, str) or not e.startswith("Transcription")]
        report["errors"] = json.dumps(errors)
    except Exception as e:
        logger.error("Whisper failed: %s", e)
        report["whisper_ok"] = False
        errors = json.loads(report.get("errors", "[]"))
        errors = [e for e in errors if not isinstance(e, str) or not e.startswith("Transcription")]
        errors.append(f"Transcription (Whisper): {str(e)}")
        report["errors"] = json.dumps(errors)
        
    _save_report(recording_id, report)
    # The Pydantic ReportResponse model expects standard types, but since we monkeypatch
    # return a dict that conforms implicitly or call the function
    return _report_to_response(recording_id, report)


@router.post("/{recording_id}/step/audio", response_model=ReportResponse)
def step_audio(recording_id: str, current_user: dict = Depends(get_current_user)):
    recording = _get_recording(recording_id, current_user['uid'])
    report = _get_or_create_report(recording_id)
    
    local_path = _download_audio(recording.get('download_url', ''), recording_id)
    wav_path = convert_to_wav(local_path)
    
    try:
        from app.services.audio_service import analyze_audio
        audio_results = analyze_audio(wav_path)
        report["avg_pitch_hz"] = audio_results.get("avg_pitch_hz")
        report["pitch_variability"] = audio_results.get("pitch_variability")
        report["pauses"] = json.dumps(audio_results.get("pauses", []))
        report["total_pause_time"] = audio_results.get("total_pause_time")
        report["total_speaking_time"] = audio_results.get("total_speaking_time")
        report["duration_seconds"] = audio_results.get("duration_seconds")
        
        transcript = report.get("transcript", "")
        word_count = len(transcript.split()) if transcript else 0
        speaking_time = audio_results.get("total_speaking_time", 0)
        report["speaking_pace_wpm"] = (
            round(word_count / (speaking_time / 60), 1) if speaking_time > 0 else None
        )
        
        report["audio_ok"] = True
        errors = json.loads(report.get("errors", "[]"))
        errors = [e for e in errors if not isinstance(e, str) or not e.startswith("Audio")]
        report["errors"] = json.dumps(errors)
        
        db = get_firestore()
        db.collection('recordings').document(recording_id).update({
            "duration_seconds": audio_results.get("duration_seconds", 0)
        })
    except Exception as e:
        logger.error("Audio analysis failed: %s", e)
        report["audio_ok"] = False
        errors = json.loads(report.get("errors", "[]"))
        errors = [e for e in errors if not isinstance(e, str) or not e.startswith("Audio")]
        errors.append(f"Audio analysis: {str(e)}")
        report["errors"] = json.dumps(errors)
        
    _save_report(recording_id, report)
    return _report_to_response(recording_id, report)


@router.post("/{recording_id}/step/gemini", response_model=ReportResponse)
def step_gemini(recording_id: str, current_user: dict = Depends(get_current_user)):
    recording = _get_recording(recording_id, current_user['uid'])
    report = _get_or_create_report(recording_id)
    
    transcript = report.get("transcript", "")
    whisper_words = json.loads(report.get("whisper_words", "[]"))
    
    # Fillers
    filler_summary = "none"
    try:
        from app.services.filler_service import detect_fillers
        fillers = detect_fillers(transcript, whisper_words)
        report["filler_words"] = json.dumps(fillers)
        if fillers:
            filler_summary = ", ".join(f"'{f['word']}' x{f['count']}" for f in fillers[:5])
    except:
        report["filler_words"] = json.dumps([])
        
    # Pronunciation
    pronunciation_summary = "none"
    try:
        from app.services.pronunciation_service import assess_pronunciation
        pron_issues = assess_pronunciation(whisper_words)
        report["pronunciation_issues"] = json.dumps(pron_issues)
        if pron_issues:
            pronunciation_summary = f"{len(pron_issues)} words flagged: " + ", ".join(p["word"] for p in pron_issues[:5])
    except:
        report["pronunciation_issues"] = json.dumps([])
        
    # Gemini
    try:
        from app.services.gemini_service import analyze_text
        pauses = json.loads(report.get("pauses", "[]"))
        gemini_results = analyze_text(
            transcript=transcript,
            wpm=report.get("speaking_pace_wpm"),
            avg_pitch=report.get("avg_pitch_hz"),
            pitch_var=report.get("pitch_variability"),
            duration=report.get("duration_seconds"),
            speaking_time=report.get("total_speaking_time"),
            pause_time=report.get("total_pause_time"),
            pause_count=len(pauses),
            filler_summary=filler_summary,
            pronunciation_summary=pronunciation_summary,
            mode=recording.get("recording_mode", "freestyle"),
            question=recording.get("interview_question", ""),
        )
        
        report["grammar_issues"] = json.dumps(gemini_results.get("grammar_issues", []))
        report["fluency_notes"] = gemini_results.get("fluency_notes", "")
        report["gemini_feedback"] = gemini_results.get("overall_feedback", "")
        report["overall_score"] = gemini_results.get("estimated_score")
        
        sub = gemini_results.get("sub_scores", {})
        report["score_grammar"] = sub.get("grammar")
        report["score_pronunciation"] = sub.get("pronunciation")
        report["score_vocabulary"] = sub.get("vocabulary")
        report["score_confidence"] = sub.get("confidence")
        report["score_fluency"] = sub.get("fluency")
        
        report["gemini_ok"] = True
        errors = json.loads(report.get("errors", "[]"))
        errors = [e for e in errors if not isinstance(e, str) or not e.startswith("AI analysis")]
        report["errors"] = json.dumps(errors)
        
        db = get_firestore()
        
        try:
            fillers_list = json.loads(report.get("filler_words", "[]"))
            total_fillers = sum(f.get("count", 0) for f in fillers_list) if isinstance(fillers_list, list) else 0
        except:
            total_fillers = 0
            
        db.collection('recordings').document(recording_id).update({
            "has_report": True,
            "overall_score": gemini_results.get("estimated_score"),
            "filler_words_count": total_fillers,
            "readability_score": report.get("readability_score", ""),
            "speaking_pace_wpm": report.get("speaking_pace_wpm", 0),
            "transcript_preview": f"{transcript[:60]}..." if transcript and len(transcript) > 60 else transcript
        })
    except Exception as e:
        logger.error("Gemini failed: %s", e)
        report["gemini_ok"] = False
        errors = json.loads(report.get("errors", "[]"))
        errors = [e for e in errors if not isinstance(e, str) or not e.startswith("AI analysis")]
        errors.append(f"AI analysis (Gemini): {str(e)}")
        report["errors"] = json.dumps(errors)
        
    _save_report(recording_id, report)
    return _report_to_response(recording_id, report)


@router.get("/{recording_id}", response_model=ReportResponse)
def get_report(recording_id: str, current_user: dict = Depends(get_current_user)):
    _get_recording(recording_id, current_user['uid'])
    db = get_firestore()
    report_doc = db.collection('reports').document(recording_id).get()
    if not report_doc.exists:
        raise HTTPException(status_code=404, detail="No report found. Run analysis first.")
    
    return _report_to_response(recording_id, report_doc.to_dict())

@router.post("/rephrase", response_model=RephraseResponse)
def rephrase_text(body: RephraseRequest, current_user: dict = Depends(get_current_user)):
    from app.services.rephrase_service import rephrase
    try:
        result = rephrase(text=body.text, style=body.style, count=body.count)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Rephrase failed: {str(e)}")

    return RephraseResponse(
        original=result.get("original", body.text),
        style=result.get("style", body.style),
        rephrased=result.get("rephrased", []),
        tip=result.get("tip", ""),
    )
