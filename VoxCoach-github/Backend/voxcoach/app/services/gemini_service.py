"""Text-only LLM analysis — grammar + fluency notes + scores.

Tries Gemini first, falls back to Groq (llama) if Gemini fails.
"""

import json
import logging
import re

from app.config import settings

logger = logging.getLogger(__name__)

GRAMMAR_PROMPT_TEMPLATE = """You are an expert English speech coach. Analyze the following transcript (produced by Whisper STT from a spoken recording).

Transcript:
---
{transcript}
---

Speech metrics:
- Speaking pace: {wpm} words per minute
- Average pitch: {avg_pitch} Hz
- Pitch variability: {pitch_var}
- Total duration: {duration} seconds
- Total speaking time: {speaking_time} seconds
- Total pause time: {pause_time} seconds
- Number of pauses: {pause_count}
- Filler words detected: {filler_summary}
- Pronunciation issues detected: {pronunciation_summary}

Return a JSON object with EXACTLY this structure:
{{
  "grammar_issues": [
    {{
      "original": "the incorrect phrase as spoken",
      "correction": "the corrected phrase",
      "explanation": "brief explanation of the grammar rule"
    }}
  ],
  "fluency_notes": "2-3 sentences about speech flow, rhythm, pace, pauses, and confidence based on the metrics above. Mention specific numbers where relevant.",
  "overall_feedback": "2-3 sentences of constructive, encouraging feedback summarizing strengths and top areas for improvement",
  "estimated_score": null,
  "sub_scores": {{
    "grammar": null,
    "pronunciation": null,
    "vocabulary": null,
    "confidence": null,
    "fluency": null
  }}
}}

Guidelines:
- For grammar, only flag clear errors, not stylistic preferences.
- The estimated_score should be 0-100 where 50 is understandable with significant issues, 75 is good with minor issues, 90+ is near-native fluency.
- sub_scores: Rate each skill 0-100. grammar = correctness of sentence structure. pronunciation = clarity based on the pronunciation issues count. vocabulary = range and appropriateness. confidence = how assured based on pace and pauses. fluency = smoothness based on pause patterns and filler count.
- Use the speech metrics to inform your scoring — e.g. many pauses = lower fluency, many fillers = lower confidence.
- If the transcript is empty or unintelligible, return empty arrays, a note in fluency_notes, and low sub_scores.
- Return ONLY the JSON object, no markdown formatting, no code blocks, no extra text."""


def _parse_response(text: str) -> dict:
    """Parse LLM response, handling markdown code fences."""
    cleaned = text.strip()
    match = re.search(r"```(?:json)?\s*\n?(.*?)\n?\s*```", cleaned, re.DOTALL)
    if match:
        cleaned = match.group(1).strip()
    return json.loads(cleaned)


def _build_prompt(**kwargs) -> str:
    base_prompt = GRAMMAR_PROMPT_TEMPLATE.format(
        transcript=kwargs.get("transcript") or "(no transcript available)",
        wpm=f"{kwargs['wpm']:.0f}" if kwargs.get("wpm") else "N/A",
        avg_pitch=f"{kwargs['avg_pitch']:.0f}" if kwargs.get("avg_pitch") else "N/A",
        pitch_var=f"{kwargs['pitch_var']:.1f}" if kwargs.get("pitch_var") else "N/A",
        duration=f"{kwargs['duration']:.1f}" if kwargs.get("duration") else "N/A",
        speaking_time=f"{kwargs['speaking_time']:.1f}" if kwargs.get("speaking_time") else "N/A",
        pause_time=f"{kwargs['pause_time']:.1f}" if kwargs.get("pause_time") else "N/A",
        pause_count=kwargs.get("pause_count", 0),
        filler_summary=kwargs.get("filler_summary", "none"),
        pronunciation_summary=kwargs.get("pronunciation_summary", "none"),
    )

    if kwargs.get('mode') == 'interview' and kwargs.get('question'):
        interview_context = f"\n\nCRITICAL CONTEXT: The user is actively answering the behavioral interview question:\n\"{kwargs['question']}\"\nEvaluate whether their answer is highly professional, well-structured, and directly addresses the scenario."
        base_prompt = base_prompt.replace(
            "Return a JSON object with EXACTLY this structure:", 
            interview_context + "\n\nReturn a JSON object with EXACTLY this structure:"
        )

    return base_prompt


def _call_gemini(prompt: str) -> dict:
    """Call Gemini API."""
    import google.generativeai as genai

    genai.configure(api_key=settings.gemini_api_key)
    model = genai.GenerativeModel("gemini-2.5-flash-lite")
    response = model.generate_content(prompt)
    return _parse_response(response.text)


def _call_groq(prompt: str) -> dict:
    """Call Groq API (Llama)."""
    from groq import Groq

    client = Groq(api_key=settings.groq_api_key)
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
    )
    return _parse_response(response.choices[0].message.content)


def _ensure_defaults(result: dict) -> dict:
    """Ensure all expected keys exist."""
    result.setdefault("grammar_issues", [])
    result.setdefault("fluency_notes", "")
    result.setdefault("overall_feedback", "")
    result.setdefault("estimated_score", 50)
    result.setdefault("sub_scores", {
        "grammar": 50, "pronunciation": 50, "vocabulary": 50,
        "confidence": 50, "fluency": 50,
    })
    return result


def analyze_text(
    transcript: str,
    wpm: float | None = None,
    avg_pitch: float | None = None,
    pitch_var: float | None = None,
    duration: float | None = None,
    speaking_time: float | None = None,
    pause_time: float | None = None,
    pause_count: int = 0,
    filler_summary: str = "none",
    pronunciation_summary: str = "none",
    mode: str = "freestyle",
    question: str = "",
) -> dict:
    """
    Analyze transcript with LLM. Tries Gemini first, falls back to Groq.
    No audio is sent — text only.
    """
    prompt = _build_prompt(
        transcript=transcript, wpm=wpm, avg_pitch=avg_pitch,
        pitch_var=pitch_var, duration=duration, speaking_time=speaking_time,
        pause_time=pause_time, pause_count=pause_count,
        filler_summary=filler_summary, pronunciation_summary=pronunciation_summary,
        mode=mode, question=question
    )

    # Try Gemini first
    if settings.gemini_api_key:
        try:
            result = _call_gemini(prompt)
            logger.info("LLM analysis completed via Gemini")
            return _ensure_defaults(result)
        except Exception as e:
            logger.warning("Gemini failed, falling back to Groq: %s", e)

    # Fallback to Groq
    if settings.groq_api_key:
        result = _call_groq(prompt)
        logger.info("LLM analysis completed via Groq (fallback)")
        return _ensure_defaults(result)

    raise RuntimeError("No LLM API available — both Gemini and Groq keys missing or failed")
