"""Parse streamed / batched LLM JSON responses."""

import json
import re


_JD_MATCH_PREVIEW_RE = re.compile(
    r'"JD\s+Match"\s*:\s*"(\d{1,3})\s*%?"',
    re.IGNORECASE,
)

# Incremental field detection for resume-eval SSE (partial JSON while streaming).
_EVAL_FIELD_PREVIEW_SPECS = (
    ("profile_summary", re.compile(r'"Profile\s+Summary"\s*:\s*"((?:[^"\\]|\\.){0,400})', re.IGNORECASE | re.DOTALL)),
    ("reasoning", re.compile(r'"Reasoning"\s*:\s*"((?:[^"\\]|\\.){0,280})', re.IGNORECASE | re.DOTALL)),
)

# Handbook markdown section anchors (0–13 intake-aware playbook).
HANDBOOK_SECTION_PATTERNS = tuple(
    re.compile(rf"\*\*\s*{i}\s*[\.\)]", re.IGNORECASE) for i in range(14)
) + (
    re.compile(r"Hiring Timeline|Priority Playbook", re.IGNORECASE),
    re.compile(r"Overqualification|Flight Risk", re.IGNORECASE),
    re.compile(r"Sales Pitch|Why this role", re.IGNORECASE),
)


def try_extract_jd_match_preview(accumulated: str):
    """Return (percentage int, display str) when JD Match appears in partial JSON."""
    if not accumulated:
        return None, None
    match = _JD_MATCH_PREVIEW_RE.search(accumulated)
    if not match:
        return None, None
    try:
        pct = int(match.group(1))
    except (TypeError, ValueError):
        return None, None
    if pct < 0 or pct > 100:
        return None, None
    return pct, f"{pct}%"


def try_extract_eval_field_previews(accumulated: str, already_sent: set | None = None):
    """
    Yield (field_key, snippet) for eval fields as they appear in partial JSON.
    already_sent: set of keys already emitted to the client.
    """
    if not accumulated:
        return
    sent = already_sent if already_sent is not None else set()
    for key, pattern in _EVAL_FIELD_PREVIEW_SPECS:
        if key in sent:
            continue
        match = pattern.search(accumulated)
        if not match:
            continue
        raw = match.group(1)
        snippet = raw.replace("\\n", " ").replace('\\"', '"').strip()
        if len(snippet) < 24:
            continue
        if len(snippet) > 320:
            snippet = snippet[:317] + "…"
        sent.add(key)
        yield key, snippet


def handbook_section_index_from_markdown(accumulated: str) -> int:
    """Highest handbook loader step index (0-based) detected in streamed markdown."""
    if not accumulated:
        return -1
    best = -1
    for idx, pattern in enumerate(HANDBOOK_SECTION_PATTERNS):
        if pattern.search(accumulated):
            best = idx
    return best


def extract_json_from_text(text: str):
    """Extract JSON object from text, handling deep nesting properly."""
    start_idx = text.find("{")
    if start_idx == -1:
        return None

    brace_count = 0
    in_string = False
    escape_next = False

    for i in range(start_idx, len(text)):
        char = text[i]

        if char == "\\" and not escape_next:
            escape_next = True
            continue

        if char == '"' and not escape_next:
            in_string = not in_string

        escape_next = False

        if not in_string:
            if char == "{":
                brace_count += 1
            elif char == "}":
                brace_count -= 1
                if brace_count == 0:
                    return text[start_idx : i + 1]

    return None


def parse_llm_json_response(response_text: str) -> dict:
    """Clean and parse JSON from model output (resume eval and similar)."""
    if response_text is None:
        raise ValueError("empty response")
    if not isinstance(response_text, str):
        response_text = str(response_text)

    response_text = response_text.strip()
    response_text = re.sub(r"^```json\s*", "", response_text, flags=re.MULTILINE)
    response_text = re.sub(r"^```\s*", "", response_text, flags=re.MULTILINE)
    response_text = re.sub(r"\s*```$", "", response_text)
    response_text = response_text.strip()

    if response_text.startswith("```") and response_text.endswith("```"):
        response_text = response_text[3:-3].strip()

    if response_text and response_text[0] != "{":
        json_start = response_text.find("{")
        if json_start > 0:
            response_text = response_text[json_start:]

    if not response_text.startswith("{"):
        raise ValueError("response does not contain JSON object")

    try:
        parsed = json.loads(response_text)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    json_str = extract_json_from_text(response_text)
    if not json_str:
        raise ValueError("no JSON object found in response")
    parsed = json.loads(json_str)
    if not isinstance(parsed, dict):
        raise ValueError("parsed JSON is not an object")
    return parsed
