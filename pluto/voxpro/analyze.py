"""LLM call analysis from merged transcript."""

from __future__ import annotations

import json
import logging
import time

from pluto.llm_parse import parse_llm_json_response
from pluto.voxpro.config import (
    CALL_ANALYSIS_GEMINI_MODEL,
    CALL_ANALYSIS_GROQ_MODEL,
    CALL_ANALYSIS_MAX_COMPLETION_TOKENS,
    CALL_ANALYSIS_MAX_TRANSCRIPT_CHARS,
    CALL_ANALYSIS_MODEL_PROVIDER,
)

logger = logging.getLogger(__name__)

ANALYSIS_PROMPT_TEMPLATE = """You are an expert recruitment analyst for PeopleLogic.

Analyze the following recruiter–candidate phone conversation transcript(s).
Multiple calls may be included with headers (date, recruiter email, direction).

TRANSCRIPT:
{transcript}

{context_block}

Return a JSON object with exactly these keys (no markdown outside JSON):
{{
  "executive_summary": "2-4 sentences",
  "candidate_signals": {{
    "interest_level": "high|medium|low|unknown",
    "compensation_mentions": "string or null",
    "notice_period": "string or null",
    "location_remote": "string or null",
    "concerns": ["list of strings"],
    "positive_signals": ["list of strings"]
  }},
  "jd_alignment": "How conversation aligns with job context, or N/A if no JD provided",
  "red_flags": ["list"],
  "recruiter_coaching": ["actionable tips for the recruiter"],
  "recommended_follow_ups": ["list"],
  "overall_recommendation": "proceed|hold|reject|needs_more_info"
}}

Also include key "analysis_markdown" with a concise report (headings, bullets) for recruiters.
Keep analysis_markdown under 1500 words. Be brief in reasoning; prioritize valid JSON output.
"""


def _build_context_block(
    *,
    job_description: str | None,
    resume_summary: str | None,
    handbook_excerpt: str | None,
    metadata: dict,
) -> str:
    parts = []
    if metadata:
        parts.append(
            "METADATA: "
            + json.dumps(
                {
                    k: metadata[k]
                    for k in metadata
                    if metadata[k] is not None
                },
                default=str,
            )
        )
    if job_description:
        parts.append("JOB DESCRIPTION:\n" + job_description[:8000])
    if resume_summary:
        parts.append("RESUME EVALUATION SUMMARY:\n" + resume_summary[:4000])
    if handbook_excerpt:
        parts.append("HANDBOOK EXCERPT:\n" + handbook_excerpt[:4000])
    if not parts:
        return "CONTEXT: None provided."
    return "\n\n".join(parts)


def analyze_transcript(
    transcript: str,
    *,
    job_description: str | None = None,
    resume_summary: str | None = None,
    handbook_excerpt: str | None = None,
    metadata: dict | None = None,
) -> tuple[dict, str, float]:
    """Returns (analysis_json, analysis_markdown, time_taken_seconds)."""
    import app as m

    context_block = _build_context_block(
        job_description=job_description,
        resume_summary=resume_summary,
        handbook_excerpt=handbook_excerpt,
        metadata=metadata or {},
    )
    max_chars = CALL_ANALYSIS_MAX_TRANSCRIPT_CHARS
    transcript_body = transcript or ""
    truncated = len(transcript_body) > max_chars
    if truncated:
        logger.warning(
            "Call analysis transcript truncated %s -> %s chars for Groq TPM limits",
            len(transcript_body),
            max_chars,
        )
        transcript_body = (
            transcript_body[:max_chars]
            + "\n\n[Transcript truncated for analysis — see full text in UI.]"
        )

    prompt = ANALYSIS_PROMPT_TEMPLATE.format(
        transcript=transcript_body,
        context_block=context_block,
    )

    provider = CALL_ANALYSIS_MODEL_PROVIDER
    model_override = None
    if provider == "groq":
        model_override = CALL_ANALYSIS_GROQ_MODEL
    elif provider == "gemini":
        model_override = CALL_ANALYSIS_GEMINI_MODEL

    start = time.time()
    response = m.generate_content_unified(
        prompt,
        stream=False,
        provider_override=provider,
        model_override=model_override,
        max_completion_tokens_override=CALL_ANALYSIS_MAX_COMPLETION_TOKENS,
    )
    elapsed = time.time() - start
    text = response.text if hasattr(response, "text") else str(response)

    try:
        parsed = parse_llm_json_response(text)
    except ValueError as exc:
        logger.warning("Call analysis JSON parse failed: %s", exc)
        parsed = {
            "executive_summary": text[:2000],
            "parse_error": str(exc),
        }
        markdown = text
        return parsed, markdown, elapsed

    markdown = parsed.get("analysis_markdown") or _default_markdown(parsed)
    if "analysis_markdown" in parsed:
        analysis_data = {k: v for k, v in parsed.items() if k != "analysis_markdown"}
    else:
        analysis_data = parsed
    return analysis_data, markdown, elapsed


def _default_markdown(data: dict) -> str:
    lines = ["# Call analysis", ""]
    if data.get("executive_summary"):
        lines.append("## Summary")
        lines.append(str(data["executive_summary"]))
        lines.append("")
    if data.get("recommended_follow_ups"):
        lines.append("## Recommended follow-ups")
        for item in data["recommended_follow_ups"]:
            lines.append(f"- {item}")
    return "\n".join(lines)
