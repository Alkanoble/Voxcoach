"""Sentence rephrasing service — rewrites spoken sentences into cleaner alternatives.

Uses Gemini first, falls back to Groq (llama) if Gemini fails.
"""

import json
import logging
import re

from app.config import settings

logger = logging.getLogger(__name__)

REPHRASE_PROMPT_TEMPLATE = """You are an expert English speech coach helping a speaker improve their communication.

The speaker said:
---
{text}
---

Rephrase the above into {count} alternative versions that are more {style}.
Keep the same meaning but make it sound better for spoken communication.

Return a JSON object with EXACTLY this structure:
{{
  "original": "{text}",
  "style": "{style}",
  "rephrased": [
    "first rephrased version",
    "second rephrased version",
    "third rephrased version"
  ],
  "tip": "one short tip on why these phrasings are better"
}}

Guidelines:
- Preserve the speaker's intended meaning exactly.
- Make each version feel natural when spoken aloud.
- Vary the phrasing across the options — don't just swap single words.
- Return ONLY the JSON object, no markdown, no code blocks, no extra text."""

STYLE_DESCRIPTIONS = {
    "formal": "formal and professional",
    "simple": "clear and easy to understand",
    "confident": "assertive and confident",
    "concise": "concise and to the point",
    "natural": "natural and conversational",
}


def _parse_response(text: str) -> dict:
    cleaned = text.strip()
    match = re.search(r"```(?:json)?\s*\n?(.*?)\n?\s*```", cleaned, re.DOTALL)
    if match:
        cleaned = match.group(1).strip()
    return json.loads(cleaned)


def _build_prompt(text: str, style: str, count: int) -> str:
    style_desc = STYLE_DESCRIPTIONS.get(style, style)
    return REPHRASE_PROMPT_TEMPLATE.format(
        text=text,
        style=style_desc,
        count=count,
    )


def _call_gemini(prompt: str) -> dict:
    import google.generativeai as genai

    genai.configure(api_key=settings.gemini_api_key)
    model = genai.GenerativeModel("gemini-2.0-flash-lite")
    response = model.generate_content(prompt)
    return _parse_response(response.text)


def _call_groq(prompt: str) -> dict:
    from groq import Groq

    client = Groq(api_key=settings.groq_api_key)
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7,
    )
    return _parse_response(response.choices[0].message.content)


def rephrase(text: str, style: str = "natural", count: int = 3) -> dict:
    """
    Rephrase the given text into multiple alternatives.

    Args:
        text: The sentence or passage to rephrase.
        style: One of 'formal', 'simple', 'confident', 'concise', 'natural'.
        count: Number of alternatives to generate (default 3).

    Returns:
        dict with keys: original, style, rephrased (list), tip
    """
    if not text or not text.strip():
        return {
            "original": text,
            "style": style,
            "rephrased": [],
            "tip": "No text provided to rephrase.",
        }

    count = max(1, min(count, 5))
    prompt = _build_prompt(text.strip(), style, count)

    if settings.gemini_api_key:
        try:
            result = _call_gemini(prompt)
            logger.info("Rephrase completed via Gemini (style=%s)", style)
            return result
        except Exception as e:
            logger.warning("Gemini rephrase failed, falling back to Groq: %s", e)

    if settings.groq_api_key:
        result = _call_groq(prompt)
        logger.info("Rephrase completed via Groq fallback (style=%s)", style)
        return result

    raise RuntimeError("No LLM API available — both Gemini and Groq keys missing or failed")
