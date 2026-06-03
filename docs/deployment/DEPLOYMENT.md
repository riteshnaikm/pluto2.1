# Deployment Guide — PLUTO (pluto2.1)

> **Canonical product reference:** [../product/PRODUCT_CONTEXT.md](../product/PRODUCT_CONTEXT.md)  
> **Git push from Windows:** [GIT_PUSH_INSTRUCTIONS.md](GIT_PUSH_INSTRUCTIONS.md)  
> **Last reviewed:** May 2026

## Prerequisites

- Ubuntu/Debian (or similar Linux) with `sudo`
- Python **3.10+**, `git`, optional **nginx**
- Network access to: Google OAuth, LLM APIs, Pinecone, internal Oorwin/VoxPro hosts (if used)

```bash
sudo apt update
sudo apt install -y python3.10 python3.10-venv python3.10-dev git nginx
```

Optional for uploads: **Tesseract** (OCR), **LibreOffice** (legacy `.doc`) — see [../guides/DOCUMENT_UPLOADS.md](../guides/DOCUMENT_UPLOADS.md).

---

## Get the code

```bash
sudo mkdir -p /opt/pluto2 && sudo chown $USER:$USER /opt/pluto2
git clone https://github.com/riteshnaikm/pluto2.1.git /opt/pluto2
cd /opt/pluto2
```

---

## Virtual environment & dependencies

```bash
python3.10 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

---

## Environment

Copy and edit secrets (never commit `.env`):

```bash
cp .env.example .env
nano .env
```

Minimum production variables — see [../guides/ENV_AND_MODELS.md](../guides/ENV_AND_MODELS.md) and `.env.example`:

- `FLASK_SECRET_KEY`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `GEMINI_API_KEY` and/or `GROQ_API_KEY`
- `PINECONE_API_KEY`
- `FLASK_ENV=production`, `SESSION_COOKIE_SECURE=true` (behind HTTPS)

Place HR policy PDFs in `HR_docs/`.

---

## Pre-deploy check

```bash
source venv/bin/activate
python verify_before_deploy.py
```

---

## Run (production server)

PLUTO uses **Hypercorn** (ASGI) so async routes work. Entry point is **`run.py`**, not bare `flask run`.

```bash
source venv/bin/activate
python run.py
```

- Linux: binds `http://0.0.0.0:5000`
- Windows dev: `http://127.0.0.1:5000`

HTTPS is typically terminated at **nginx** (app serves HTTP locally).

---

## systemd service (Hypercorn)

```bash
sudo tee /etc/systemd/system/pluto2.service <<'EOF'
[Unit]
Description=PLUTO HR Assistant (Hypercorn)
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/opt/pluto2
Environment="PATH=/opt/pluto2/venv/bin"
EnvironmentFile=/opt/pluto2/.env
ExecStart=/opt/pluto2/venv/bin/python run.py
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable pluto2
sudo systemctl start pluto2
sudo systemctl status pluto2
```

> Older docs referenced **Gunicorn** + `peoplebotV2` — this repo uses **Hypercorn** + `run.py`. Use `deploy_scripts/` for nginx/install helpers if paths differ on your server.

---

## Nginx reverse proxy

```bash
sudo tee /etc/nginx/sites-available/pluto2.conf <<'EOF'
server {
    listen 80;
    server_name your.domain.com;

    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/pluto2.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Enable SSL with certbot when you have a domain.

---

## Logs & updates

```bash
journalctl -u pluto2 -f
```

```bash
cd /opt/pluto2
git pull
source venv/bin/activate && pip install -r requirements.txt
sudo systemctl restart pluto2
```

---

## Legacy note

If you still run an older **peoplebotV2** tree with Gunicorn on port 8000, migrate to this repo layout or adjust paths/service names accordingly — do not mix instructions without updating `WorkingDirectory` and `ExecStart`.
