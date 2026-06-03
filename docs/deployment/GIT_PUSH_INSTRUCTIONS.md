# Git Push Instructions — Pluto2

Step-by-step guide to push this project to GitHub from Windows (PowerShell).

**Repository:** [https://github.com/riteshnaikm/pluto2.1.git](https://github.com/riteshnaikm/pluto2.1.git)

---

## Before you start

- Git must be installed (`git --version`)
- Create an empty repo on GitHub if you have not already: [github.com/new](https://github.com/new)
- Do **not** initialize the remote repo with README, `.gitignore`, or license if you are pushing this folder for the first time (this project already has those files)

### Files that must NOT be pushed

These are excluded via `.gitignore` or should stay local:

| File / folder        | Why                                      |
|----------------------|------------------------------------------|
| `.env`               | Contains API keys and secrets            |
| `venv/`              | Local Python environment                 |
| `combined_db.db`     | Local database                           |
| `uploads/*`          | User-uploaded files                      |
| `SERVER DETAILS.txt` | Server credentials (keep local only)   |
| `.claude/`           | Local IDE settings                       |

Before every commit, run `git status` and confirm the files above are **not** listed.

---

## One-time setup

Run these once from the project folder:

```powershell
cd C:\Users\Ritesh\Desktop\pluto2-main
```

### 1. Initialize Git (skip if `.git` already exists)

```powershell
git init
```

### 2. Configure your identity

Run **one command per line** (do not paste multiple commands on the same line):

```powershell
git config --global user.name "riteshnaikm"
```

```powershell
git config --global user.email "your-github-email@example.com"
```

```powershell
git config --global credential.helper manager
```

Replace the email with the one on your GitHub account.

### 3. Connect the remote

```powershell
git branch -M main
git remote add origin https://riteshnaikm@github.com/riteshnaikm/pluto2.1.git
```

If the remote already exists:

```powershell
git remote set-url origin https://riteshnaikm@github.com/riteshnaikm/pluto2.1.git
```

---

## First push (new project)

### Step 1 — Stage files

```powershell
git add .
git status
```

Review the list. Remove anything sensitive that was staged by mistake:

```powershell
git rm --cached "SERVER DETAILS.txt"
```

For a file literally named `$null` (PowerShell accident), use **single quotes**:

```powershell
git rm --cached '$null'
Remove-Item -LiteralPath '.\$null' -ErrorAction SilentlyContinue
```

### Step 2 — Commit

```powershell
git commit -m "Initial commit: Pluto2 HR assistant application"
```

> **Important:** `git add` only stages files. They are not on GitHub until you **commit** and **push**.

### Step 3 — Sync with GitHub (if remote already has a LICENSE commit)

```powershell
git pull origin main --allow-unrelated-histories --no-edit
```

### Step 4 — Push

```powershell
git push -u origin main
```

---

## GitHub authentication (required for push)

GitHub does **not** accept your account password for `git push`. Use a **Personal Access Token (PAT)**.

### Create a token

1. Open: [github.com/settings/tokens/new](https://github.com/settings/tokens/new) (classic token)
2. Name: e.g. `pluto2-push`
3. Expiration: your choice (e.g. 90 days)
4. Scope: check **`repo`**
5. Generate and copy the token (starts with `ghp_...`)

### Clear bad cached credentials (Windows)

1. Press `Win + R`, run: `control /name Microsoft.CredentialManager`
2. Under **Windows Credentials**, delete entries for `git:https://github.com` or `github.com`

### Push and sign in

```powershell
git push -u origin main
```

When prompted:

| Field      | Enter                          |
|------------|--------------------------------|
| Username   | `riteshnaikm`                  |
| Password   | Your **PAT** (`ghp_...`), not your GitHub password |

If no login prompt appears:

```powershell
$env:GIT_TERMINAL_PROMPT = "1"
git push -u origin main
```

---

## Everyday workflow (after first push)

Whenever you change code and want to update GitHub:

```powershell
cd C:\Users\Ritesh\Desktop\pluto2-main
git add .
git status
git commit -m "Describe what you changed"
git push
```

| Step   | Command              | What it does                    |
|--------|----------------------|---------------------------------|
| Stage  | `git add .`          | Marks changed files to include  |
| Commit | `git commit -m "…"`  | Saves a snapshot locally        |
| Push   | `git push`           | Uploads commits to GitHub       |

All three steps are required. Staging alone does not upload files to GitHub.

---

## Common errors

### `error: no action specified`

Two commands were pasted on **one line**. Run each command separately and press Enter after each.

**Wrong:**

```text
git config --global user.name "riteshnaikm"git config --global user.email "..."
```

**Right:**

```powershell
git config --global user.name "riteshnaikm"
git config --global user.email "your-email@example.com"
```

### `No anonymous write access` / `Authentication failed`

- Create a PAT with **`repo`** scope
- Clear old GitHub credentials in Windows Credential Manager
- Use the token as the password when pushing

### Files not visible on GitHub

Usually means files were **staged but never committed**, or commit was never pushed.

Check locally:

```powershell
git log --oneline -3
git status
```

If you see many files under “Changes to be committed”, commit and push:

```powershell
git commit -m "Add project files"
git push origin main
```

### `fatal: pathspec '$null' did not match any files`

In PowerShell, `$null` is a variable. Use single quotes:

```powershell
git rm --cached '$null'
```

---

## Verify on GitHub

After a successful push, open:

**https://github.com/riteshnaikm/pluto2.1**

You should see folders such as `pluto/`, `templates/`, `static/`, and files like `app.py` and `requirements.txt`.

If the page looks empty, hard-refresh the browser (`Ctrl + F5`).

---

## Quick reference

```powershell
# Status and history
git status
git log --oneline -5
git remote -v

# Full update cycle
git add .
git commit -m "Your message"
git push

# First-time push with upstream
git push -u origin main
```
