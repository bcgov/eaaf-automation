# EAAF Automation

Next.js + TypeScript application for enterprise architecture assessment and deterministic platform recommendation engine.

---

## Prerequisites (Install First)

### Required

- **Node.js 18+** — [Download from nodejs.org](https://nodejs.org)
  - Needed for Next.js, npm packages, TypeScript scripts
  - Verify: `node --version`

### Optional but Recommended

- **Python 3.8+** — [Download from python.org](https://www.python.org/downloads/)
  - Needed for local embedding service (historical assessment similarity matching)
  - If skipped: App still works, but historical comparison features won't run
  - Verify: `python --version`

---

## Files Your Team Must Provide

Before running setup, request these files from your team lead (not in git repo):

| File | Purpose | Required? |
|------|---------|-----------|
| `seed-data/seed-questions.local.json` | Question hierarchy & assessment steps | **Yes** |
| `seed-data/assessments-seed.local.json` | Historical assessment records | No (app works without) |

These are excluded from git because they contain team-specific data. **Never commit them.**

---

## Getting Started (5 Minutes)

### 1. Clone and Open

```bash
git clone https://github.com/ghsansin/eaaf-automation.git
cd eaaf-automation
```

### 2. Run Setup Script

**PowerShell (Windows):**

```powershell
.\setup-dev.ps1
```

This single command does everything:
- ✅ Enables PowerShell script execution (if needed)
- ✅ Creates Python virtual environment and installs Flask/sentence-transformers
- ✅ Installs npm dependencies
- ✅ Creates SQLite database
- ✅ Seeds question hierarchy (from your `seed-data/seed-questions.local.json`)
- ✅ Seeds historical assessments (if available)
- ✅ Starts embedding service on `http://127.0.0.1:8001` (using isolated venv)

**Optional flags:**
```powershell
.\setup-dev.ps1 -Clean            # Delete db, venv, node_modules; rebuild from scratch
.\setup-dev.ps1 -StartDev         # Auto-start dev server immediately
.\setup-dev.ps1 -SkipEmbeddings   # Skip embedding service
.\setup-dev.ps1 -SkipSeed         # Skip data seeding
```

Important:
- `./setup-dev.ps1` prepares the environment and may start the embedding service, but it does **not** keep a Next.js app server running unless you pass `-StartDev`.
- If you do not use `-StartDev`, run `npm run dev` manually from the `eaaf-automation` folder.
- In PowerShell, use `;` (not `&&`) when chaining commands, for example: `cd eaaf-automation; npm run dev`.

**Resetting Everything:**

If you need a completely fresh environment (corrupted DB, stale dependencies, etc.):

```powershell
.\setup-dev.ps1 -Clean
```

This will:
- Delete `data/app.db` (database)
- Delete `local-embedding-service\.venv` (Python environment)
- Delete `node_modules` (npm dependencies)
- Then run the full setup from scratch

You can combine flags:
```powershell
.\setup-dev.ps1 -Clean -StartDev           # Clean rebuild + auto-start dev server
.\setup-dev.ps1 -Clean -SkipEmbeddings     # Clean rebuild without embeddings
```

**Expected output (without `-StartDev`):**
```
╔════════════════════════════════════════════════════════════════╗
║         EAAF Automation — Local Development Setup             ║
╚════════════════════════════════════════════════════════════════╝

[1/7] Checking PowerShell execution policy...
  ✓ Execution policy OK (RemoteSigned)

[2/7] Checking prerequisites...
  ✓ Node.js v18.17.0
  ✓ Python 3.11.5

[3/7] Setting up Python embedding service environment...
  ✓ Virtual environment created
  ✓ Python dependencies installed

[4/7] Installing npm dependencies...
  ✓ Dependencies installed

[5/7] Initializing database...
  ✓ Database initialized

[6/7] Seeding assessment data...
  ✓ Assessment data seeded

[7/7] Starting local embedding service...
  ✓ Embedding service started (PID: 12345)

╔════════════════════════════════════════════════════════════════╗
║                     Setup complete! ✓                         ║
╚════════════════════════════════════════════════════════════════╝

🚀 Start the development server with:
   npm run dev

  Open http://localhost:3000/eaaf-automation in your browser
```

**Expected output (with `-StartDev`):**
```
[... steps 1-7 same as above ...]

╔════════════════════════════════════════════════════════════════╗
║                     Setup complete! ✓                         ║
╚════════════════════════════════════════════════════════════════╝

🚀 Starting development server...
  Open http://localhost:3000/eaaf-automation in your browser

> next dev
▲ Next.js 16.2.7
- Local:        http://localhost:3000/eaaf-automation
```

Server is now running. Just open the browser URL above.

### 3. Start Development Server

If you ran setup **without** `-StartDev` flag:

```bash
npm run dev
```

Run this command from the `eaaf-automation` directory (the folder that contains `package.json`).

Then open **http://localhost:3000/eaaf-automation** in your browser.

(If you used `.\setup-dev.ps1 -StartDev`, the server is already running — just open the browser.)

---

## Quick Reference — Running Commands

### Every Development Session

```bash
npm run dev          # Start Next.js server (port 3000)
```

If the embedding service isn't running, start it in another terminal:

```bash
npm run embeddings:service    # Start on http://127.0.0.1:8001
```

### Database & Seeding

```bash
npm run db:init                  # Create/reset database schema
npm run db:seed:assessments      # Load historical assessments
npm run export:assessments       # Export current DB to seed file
```

### Build & Deployment

```bash
npm run build       # Production build
npm run lint        # Check code quality
```

### Health Dashboard

Open the live diagnostics dashboard:

```text
http://localhost:3000/eaaf-automation/health
```

This page checks:
- App server rendering
- Database initialization and required tables
- Seed data presence
- Local embedding service readiness (`http://127.0.0.1:8001/health`)

When a check fails, the page shows specific fix commands aligned to this README.

---

## What Each Tool Does

### Embedding Service (`http://127.0.0.1:8001`)

**What it is:** Local Flask server using `all-MiniLM-L6-v2` sentence transformer

**What it does:**
- Converts assessment responses into mathematical vectors (embeddings)
- Compares new assessments against historical ones
- Powers the "Similar Assessments" feature on recommendation page

**Why it's optional:**
- Deterministic engine (rule-based scoring) works without it
- Similarity feature just won't show historical matches
- Useful for learning patterns, not required for core functionality

**Why this model:**
- Runs fully offline (no API key, no external dependency)
- Good balance of quality and speed for typical assessment text
- Stable support via sentence-transformers community

**Started by:** `setup-dev.ps1` in background automatically

**Manual start:**
```bash
npm run embeddings:service
```

### Database (SQLite at `lib/db/app.db`)

**What it stores:**
- Assessment questions and steps (from `seed-questions.local.json`)
- Historical assessment records (from `assessments-seed.local.json`)
- Embeddings for similarity matching

**Initialized by:** `npm run db:init` (runs `scripts/init-db.ts`)

**Never commit:** The `.gitignore` protects local seed data files

---

## Troubleshooting

### "Python not found" during setup

**If you see:** `⚠ Python not available — skipping embedding service`

**This means:** Python isn't installed or not in your PATH

**To fix:**
1. Install Python 3.8+ from [python.org](https://www.python.org/downloads/)
2. Make sure to check "Add Python to PATH" during installation
3. Restart your terminal and run `setup-dev.ps1` again

**It's optional:** App still works without it. Just run `npm run dev` to proceed.

### "pip install failed" during setup

**If you see:** `✗ pip install failed`

**This means:** Python packages couldn't be installed into the virtual environment

**To fix manually:**
```powershell
cd local-embedding-service
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Note: `sentence-transformers` and `torch` are large packages — first install may take several minutes on slow connections.

### "Cannot find seed-data files"

**If you see:** `⚠ seed-data/seed-questions.local.json not found`

**This means:** Your team hasn't provided the seed data

**To fix:**
1. Request `seed-data/seed-questions.local.json` and `seed-data/assessments-seed.local.json` from your team lead
2. Place them in the `seed-data/` folder (root of project)
3. Run `setup-dev.ps1` again

**It's required for questions:** The database needs the question hierarchy to function

### "setup-dev.ps1 cannot be loaded"

**If you see:** `cannot be loaded because running scripts is disabled on this system`

**This means:** PowerShell execution policy is too restrictive

**To fix manually:**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Or just run `setup-dev.ps1` and it will fix itself automatically.

---

## Architecture Overview

### Recommendation Engine (Deterministic)

**What it does:** Analyzes assessment responses and recommends one of 4 platforms:
- Salesforce
- ServiceNow
- Microsoft Power Platform
- Custom Build

**How it works:**
1. Matches keywords from responses against scoring rules (`lib/deterministic/engine.ts`)
2. Awards points to each platform based on matches
3. Calculates confidence (how certain we are) based on completeness
4. Returns detailed rationale with explanation of each signal

**Where to tweak:** See [Institutional Knowledge Entry Points](#institutional-knowledge-entry-points)

### Similarity Matching (Embedding-Based)

**What it does:** Shows historical assessments similar to the current one

**How it works:**
1. Converts assessment text to numerical vectors (via embedding service)
2. Compares current assessment against historical ones
3. Returns top 3 matches with detailed comparison

**Where to tweak:** `lib/similarity/engine.ts` (category weights, thresholds, narrative templates)

---

## Institutional Knowledge Entry Points

If you need to adjust scoring rules or platform data, edit these files:

### Deterministic Scoring

| File | What to Edit | Example |
|------|--------------|---------|
| `lib/deterministic/engine.ts` | `SCORING_RULES` array | Add keyword triggers for platforms |
| `lib/deterministic/scoring-signal-explanation-metadata.ts` | `SIGNAL_METADATA` object | Explain why each keyword matters |
| `lib/deterministic/institutional-knowledge-low-signal-report.ts` | `INSTITUTIONAL_KNOWLEDGE_PLATFORM_PROFILES` array | Platform pros/cons/best fit text |
| `lib/deterministic/static-strategic-platform-fit-data.ts` | Readiness assessments | Timeline, team gaps, governance risk per platform |
| `lib/deterministic/confidence-institutional-knowledge-report.ts` | Institutional confidence formulas | Adjust deterministic evidence confidence calculations |
| `lib/deterministic/confidence-similarity-report.ts` | Similarity confidence formulas | Adjust historical alignment and similarity advisory confidence |

### Similarity Matching

| File | What to Edit | Example |
|------|--------------|---------|
| `lib/similarity/engine.ts` | `CATEGORY_MODEL` weights | Adjust importance of each dimension (15%, 20%, etc.) |
| `lib/similarity/engine.ts` | `STOP_WORDS` array | Words to ignore during text comparison |
| `lib/similarity/engine.ts` | `buildAssessmentProfile()` | Traits to detect (e.g., "citizen-facing", "integration-heavy") |

---

## Development Workflow

### First-Time Setup (One Time Only)

```powershell
.\setup-dev.ps1 -StartDev
```

This auto-starts the dev server. Or run without the flag and start it manually:
```powershell
.\setup-dev.ps1
npm run dev
```

### Each Development Session

1. **Terminal 1 — Dev server:**
   ```bash
   npm run dev
   ```
  Open http://localhost:3000/eaaf-automation in your browser

2. **Terminal 2 — Embedding service (if needed):**
   ```bash
   npm run embeddings:service
   ```
   Runs on http://127.0.0.1:8001

3. **Make code changes** — Next.js recompiles automatically

4. **Check code quality:**
   ```bash
   npm run lint
   ```

### If You Stop the Embedding Service Accidentally

```bash
# Stop any running Python processes
taskkill /F /IM python.exe

# Or restart it cleanly
npm run embeddings:service
```

---

## Git Workflow

### Safe to Commit

- All TypeScript, JavaScript, CSS, configuration files
- `README.md`, documentation

### Never Commit

- `seed-data/seed-questions.local.json`
- `seed-data/assessments-seed.local.json`
- `lib/db/app.db` (database file)
- `node_modules/`, `dist/`, `.next/`

The `.gitignore` blocks these automatically.

---

## Frequently Asked Questions

**Q: Do I need Python to develop?**
A: No, only if you want the similarity feature. Run `npm run dev` and it works fine without it.

**Q: Can I commit seed data?**
A: No — these are team-specific and kept local. Export your DB changes via `npm run export:assessments`.

**Q: What if the app crashes?**
A: Check the terminal for error messages. Most issues are:
- Missing `seed-questions.local.json` → Ask team lead
- Python path issues → Restart terminal and re-run `setup-dev.ps1`
- Port conflicts → Another app is using 3000 or 8001

**Q: How do I contribute changes?**
A: Create a feature branch, make changes, run `npm run lint`, commit, and push to GitHub.

---

## Support

For questions or issues:
1. Check this README first
2. Ask your team lead for team-specific setup help
3. Check GitHub Issues: https://github.com/ghsansin/eaaf-automation/issues
