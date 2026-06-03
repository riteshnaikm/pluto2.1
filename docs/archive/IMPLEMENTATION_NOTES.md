# Archived implementation notes

Condensed from `GROQ_IMPLEMENTATION_SUMMARY.md` and `IMPLEMENTATION_SUMMARY.md` (removed from repo root during docs reorganisation).

## Model switching (Gemini ↔ OpenAI)

- `MODEL_PROVIDER` env selects provider; `generate_content_unified()` in `app.py` routes requests.
- `UnifiedModelResponse` normalises streaming and non-streaming replies.
- Startup logs print the active provider/model.
- Dependencies: `openai` package when using OpenAI.

## Groq provider

- Native `groq` client; fallback to Gemini if init fails.
- Env: `GROQ_API_KEY`, `GROQ_MODEL`, `GROQ_REASONING_EFFORT` (and handbook-specific override).
- Reasoning models: temperature may be skipped; higher token limits supported.

## Where to look in code today

| Concern | Location |
|---------|----------|
| Provider switch | `app.py` — `MODEL_PROVIDER`, `generate_content_unified()` |
| Env template | `.env.example` |
| User guide | [../guides/MODEL_SWITCHING_GUIDE.md](../guides/MODEL_SWITCHING_GUIDE.md) |
| Env reference | [../guides/ENV_AND_MODELS.md](../guides/ENV_AND_MODELS.md) |

For full historical prose, use git history before the docs folder reorganisation.
