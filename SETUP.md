# EAAF Automation — Developer Setup Guide

> **Start here before anything else.**
> Clone from the `main` branch at:
> **https://github.com/ghsansin/eaaf-automation/tree/main**
>
> Always cut your working branch from `main`:
> ```bash
> git checkout main
> git pull origin main
> git checkout -b feature/your-branch-name
> ```

---

## Prerequisites

### Required

- **Node.js 18+** — [nodejs.org](https://nodejs.org)
  - Verify: `node --version`

### Optional (for similarity matching)

- **Python 3.8+** — [python.org](https://www.python.org/downloads/)
  - Needed only for the local embedding service that powers the "Similar Assessments" feature
  - The app works fully without it — similarity results just won't appear
  - Make sure to check **"Add Python to PATH"** during installation
  - Verify: `python --version`

---

## Files Your Team Must Provide

Request these from your team lead before running setup. They are excluded from git because they contain team-specific data — **never commit them**.

| File | Purpose | Required? |
|------|---------|-----------|
| `seed-data/seed-questions.local.json` | Question hierarchy and assessment steps | **Yes** |
| `seed-data/assessments-seed.local.json` | Historical assessment records for similarity matching | No |

Place both files in the `seed-data/` folder at the project root before running the setup script.

---

## Step 1 — Clone the Repository

```bash
git clone https://github.com/ghsansin/eaaf-automation.git
cd eaaf-automation
```

Then cut a branch from `main` before making any changes:

```bash
git checkout main
git pull origin main
git checkout -b feature/your-branch-name
```

---

## Step 2 — Run the Setup Script

From the `eaaf-automation` directory, run:

```powershell
.\setup-dev.ps1
```

This single command does everything:
- Enables PowerShell script execution if needed
- Creates a Python virtual environment and installs embedding service dependencies
- Installs npm dependencies
- Creates the SQLite database (`data/app.db`)
- Seeds the question hierarchy from `seed-data/seed-questions.local.json`
- Seeds historical assessments if `seed-data/assessments-seed.local.json` is present
- Starts the local embedding service on `http://127.0.0.1:8001`

### Available Flags

```powershell
.\setup-dev.ps1 -Clean            # Delete db, venv, and node_modules; rebuild from scratch
.\setup-dev.ps1 -StartDev         # Auto-start the Next.js dev server after setup
.\setup-dev.ps1 -SkipEmbeddings   # Skip starting the embedding service
.\setup-dev.ps1 -SkipSeed         # Skip data seeding (already seeded)
```

You can combine flags:

```powershell
.\setup-dev.ps1 -Clean -StartDev           # Clean rebuild and start dev server
.\setup-dev.ps1 -Clean -SkipEmbeddings     # Clean rebuild without embedding service
```

### "cannot be loaded" error

If PowerShell blocks the script, fix the execution policy first:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

The setup script also handles this automatically on its first run.

### Full Reset

If the database is corrupted or dependencies are stale:

```powershell
.\setup-dev.ps1 -Clean
```

This deletes `data/app.db`, `local-embedding-service\.venv`, and `node_modules`, then rebuilds everything from scratch.

---

## Step 3 — Start the Development Server

If you did **not** use `-StartDev` in the previous step:

```bash
npm run dev
```

Run this from the `eaaf-automation` directory. Then open:

```
http://localhost:3000/eaaf-automation
```

---

## Step 4 — Start the Embedding Service (if needed)

The setup script starts the embedding service automatically. If it is not running in a subsequent session, start it manually in a second terminal:

```bash
npm run embeddings:service
```

It runs at `http://127.0.0.1:8001`. The app works without it — only the Similar Assessments feature requires it.

To restart it after stopping:

```powershell
# Kill any running Python processes first
taskkill /F /IM python.exe

# Then restart
npm run embeddings:service
```

---

## Health Check

The health dashboard confirms everything is running:

```
http://localhost:3000/eaaf-automation/health
```

Checks performed:
- App server is responding
- Database is initialized with required tables
- Seed data (questions) is present
- Local embedding service is reachable at `http://127.0.0.1:8001/health`

When a check fails the page shows the exact fix command.

---

## Quick Reference — npm Scripts

### Development

```bash
npm run dev                   # Start Next.js dev server (port 3000, hot reload)
npm run build                 # Production build
npm run lint                  # ESLint check
npm run embeddings:service    # Start embedding service (http://127.0.0.1:8001)
```

### Database

```bash
npm run db:init               # Create or reset the database schema (data/app.db)
npm run db:seed:assessments   # Load historical assessment records
npm run export:assessments    # Export current DB assessments back to seed file
npm run embeddings:backfill   # Backfill embeddings for existing historical assessments
```

---

## What Each Component Does

### SQLite Database (`data/app.db`)

Stores all application data:
- Assessment questions and step hierarchy (loaded from `seed-questions.local.json`)
- Assessment responses and metadata
- Historical assessment records for similarity matching
- Embeddings for similarity search
- AI result cache (jurisdiction scan, innovative solutions, assembled documents)

Initialized by `npm run db:init`. The `.gitignore` prevents it from being committed.

### Local Embedding Service (`http://127.0.0.1:8001`)

A local Flask server using the `all-MiniLM-L6-v2` sentence-transformer model.

What it does:
- Converts assessment response text into numerical vectors (embeddings)
- Compares a new assessment's embedding against historical ones
- Powers the "Similar Assessments" section on the recommendation report

Why it runs locally:
- Fully offline — no API key or external dependency
- Model chosen for good quality/speed balance on typical assessment text

Started automatically by `setup-dev.ps1`. Manual start: `npm run embeddings:service`.

---

## Development Workflow

### Every Session

1. **Terminal 1 — App:**
   ```bash
   cd eaaf-automation
   npm run dev
   ```

2. **Terminal 2 — Embedding service** *(only if using Similar Assessments)*:
   ```bash
   npm run embeddings:service
   ```

3. Make changes — Next.js hot-reloads automatically.

4. Before committing:
   ```bash
   npm run lint
   npx tsc --noEmit
   ```

### TypeScript Check

```bash
npx tsc --noEmit
```

No output = clean. Fix any reported errors before pushing.

---

## Troubleshooting

### "Python not found" during setup

```
⚠ Python not available — skipping embedding service
```

Install Python 3.8+ with "Add to PATH" checked, restart the terminal, then re-run `setup-dev.ps1`. The app still works without it.

### "pip install failed" during setup

```
✗ pip install failed
```

Install dependencies manually:

```powershell
cd local-embedding-service
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

`sentence-transformers` and `torch` are large — first install may take several minutes.

### "Cannot find seed-data files"

```
⚠ seed-data/seed-questions.local.json not found
```

Request both seed files from your team lead and place them in the `seed-data/` folder, then re-run `setup-dev.ps1`.

### Port conflicts

If port 3000 or 8001 is already in use, find and stop the other process, or change ports:
- Next.js: `npm run dev -- -p 3001`
- Embedding service: edit `local-embedding-service/app.py` and change the port value

---

## Git Workflow

### Branch from `main`

```bash
git checkout main
git pull origin main
git checkout -b feature/your-branch-name
```

Main branch: **https://github.com/ghsansin/eaaf-automation/tree/main**

### Safe to Commit

- TypeScript, JavaScript, CSS, JSON configuration files
- `README.md`, `SETUP.md`, and other documentation
- `rules/eaaf-rules.json` (scoring rules and platform data)

### Never Commit

```
seed-data/seed-questions.local.json
seed-data/assessments-seed.local.json
data/app.db
.env.local
node_modules/
.next/
local-embedding-service/.venv/
```

The `.gitignore` blocks all of these automatically.

### Workflow

1. Make changes on your feature branch
2. Run `npm run lint` and `npx tsc --noEmit` — fix any issues
3. Commit and push your branch
4. Open a pull request targeting `main`

---

## Support

1. Check this guide first
2. Open the health dashboard at `http://localhost:3000/eaaf-automation/health` for live diagnostics
3. Ask your team lead for seed data or environment-specific help
4. Check GitHub Issues: https://github.com/ghsansin/eaaf-automation/issues
