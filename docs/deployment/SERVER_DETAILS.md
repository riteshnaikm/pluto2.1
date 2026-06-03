# Server access (internal)

**Do not store passwords or SSH secrets in this repository.**

Production/staging access is managed outside git (password manager / IT runbook). Typical pattern for this project:

- Deploy target: internal Linux host on company network
- Deploy user: service account used by `deploy_scripts/`
- Pluto listens behind nginx (see [DEPLOYMENT.md](DEPLOYMENT.md))

If you need hostnames or credentials, ask your infrastructure owner — never commit them to `docs/` or root text files.

> A previous `SERVER DETAILS.txt` at repo root contained plaintext credentials; it was **deleted** during repo cleanup. Rotate those credentials if they were ever committed or shared.
