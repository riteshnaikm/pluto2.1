# Environment & model configuration

Use a root **`.env`** file (copy from [`.env.example`](../../.env.example)). **Never commit** `.env`, `combined_db.db`, or plaintext key files.

## Required (production)

| Variable | Purpose |
|----------|---------|
| `FLASK_SECRET_KEY` | Session signing |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `GEMINI_API_KEY` or `GROQ_API_KEY` | At least one LLM provider |
| `PINECONE_API_KEY` | Info Buddy vector search |

## Model provider selection

Set `MODEL_PROVIDER` to one of: `gemini` (default), `openai`, `groq`.

| Provider | Key variables | Notes |
|----------|---------------|--------|
| Gemini | `GEMINI_API_KEY`, `GEMINI_MODEL` | Default for resume eval / handbook |
| OpenAI | `OPENAI_API_KEY`, `OPENAI_MODEL` | Optional |
| Groq | `GROQ_API_KEY`, `GROQ_MODEL`, `GROQ_REASONING_EFFORT` | Fast inference; handbook may use `HANDBOOK_GROQ_REASONING_EFFORT` |

See [MODEL_SWITCHING_GUIDE.md](MODEL_SWITCHING_GUIDE.md) for full switching behaviour and [archive/IMPLEMENTATION_NOTES.md](../archive/IMPLEMENTATION_NOTES.md) for historical implementation notes.

## Optional performance / security

| Variable | Default | Purpose |
|----------|---------|---------|
| `FAST_EVAL_MODE` | false | Faster eval path |
| `EVALUATION_CACHE_ENABLED` | true | In-process eval cache |
| `MAX_UPLOAD_MB` | 10 | Upload size cap |
| `ALLOWED_EMAIL_DOMAINS` | peoplelogic.in | OAuth domain allowlist |
| `UPLOAD_CLEANUP_MAX_AGE_DAYS` | 7 | `scripts/cleanup_uploads.py` |

## Removed file

`API_KEYS_SETUP.txt` was removed from the repo (it risked holding real keys). Use `.env.example` and this guide only.
