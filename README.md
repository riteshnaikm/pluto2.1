# PLUTO — HR Assistant Suite

Internal AI tooling for PeopleLogic recruiters and HR (Info Buddy, Recruiter Handbook, MatchMaker).

## Run locally

```bash
python -m venv venv
venv\Scripts\activate   # Windows
pip install -r requirements.txt
copy .env.example .env    # then fill in keys
python run.py
```

Open `http://127.0.0.1:5000` after Google OAuth is configured.

## Documentation

**All docs:** [docs/README.md](docs/README.md) (index, last reviewed May 2026)

**Start here for development:** [docs/product/PRODUCT_CONTEXT.md](docs/product/PRODUCT_CONTEXT.md)

## Repository layout

| Path | Purpose |
|------|---------|
| `app.py` | Main Flask application |
| `pluto/` | Blueprints, routes, shared modules |
| `templates/` / `static/` | UI |
| `docs/` | Documentation only |
| `HR_docs/` | RAG policy PDFs |
| `deploy_scripts/` | Production setup |

License: see [LICENSE](LICENSE).
