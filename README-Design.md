# EAAF Automation — Architecture & Design Reference

> For architects and developers onboarding to the codebase.
> Keep this document updated when you change DB schema, API contracts, or core data flows.

---

## 1. What the Application Does

EAAF Automation is a **BC Government Enterprise Architecture Assessment Framework** tool. It guides architects through a structured multi-stage questionnaire and produces a **deterministic, rules-based platform recommendation** — one of four platforms:

- **Salesforce** (CRM + Case Management)
- **ServiceNow** (ITSM + Workflow)
- **Microsoft Power Platform** (Low-code / M365)
- **Custom Build**

The recommendation is entirely deterministic (no AI decides the platform). AI is used only for two optional, exploratory enrichment features: Jurisdiction Scan and Innovative Solutions.

---

## 2. Technology Stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router, Turbopack) |
| Language | TypeScript |
| Database | SQLite via `better-sqlite3` |
| AI Provider | Configurable (Gemini, OpenAI, Anthropic, Azure, custom) |
| Embedding Service | Local Python Flask + `all-MiniLM-L6-v2` sentence-transformer |
| Deployment | Local dev + Cloudflare Tunnel for external sharing |

---

## 3. Frontend Architecture

### Pages

| Route | File | Purpose |
|---|---|---|
| `/eaaf-automation` | `app/page.tsx` | Dashboard — lists all assessments with status |
| `/eaaf-automation/assessment/[id]` | `app/assessment/[id]/page.tsx` | Main assessment experience — questionnaire + report |
| `/eaaf-automation/health` | `app/health/page.tsx` | Live diagnostics dashboard |

### Key Components

| Component | Purpose |
|---|---|
| `RecommendationReport.tsx` | Full 10-section report renderer. Manages report loading state, section expand/collapse, executive summary, architect approval |
| `JurisdictionScan.tsx` | AI-powered section — finds comparable public sector implementations by region |
| `InnovativeSolutions.tsx` | AI-powered section — surfaces alternative architectural ideas |
| `BusinessContextPanel.tsx` | Editable panel for business context fields (problem, drivers, requirements) |
| `SimilarAssessments.tsx` | Renders historical assessment similarity comparison |
| `AssessmentForm.tsx` | Questionnaire form — question rendering and response capture |

### Report Section Map (RecommendationReport)

| # | Section | Data Source |
|---|---|---|
| 1 | Assessment Overview | `assessments` table |
| 2 | Business Context | `assessments` table |
| 3 | Assessment Signals | Deterministic engine (enriched scoring signals) |
| 4 | Platform Evaluation | Deterministic engine (platform scores + SWOT) |
| 5 | Rules-Based Decision | Deterministic engine (rationale + confidence) |
| 6 | Historical Similarity | Embedding similarity engine |
| 7 | Decision Confidence | Institutional + similarity confidence models |
| 8 | Jurisdiction Scan | AI (cached in `assessment_ai_cache`) |
| 9 | AI-Assisted Innovative Solutions | AI (cached in `assessment_ai_cache`) |
| 10 | Final Recommendation | Architect approval input → `recommendations` table |

---

## 4. Backend Architecture

### API Routes

```
app/api/
├── assessment/
│   ├── create/route.ts          POST  — create new assessment
│   └── [id]/
│       ├── route.ts             GET   — fetch assessment  |  PUT — update overview fields
│       ├── next/route.ts        POST  — advance to next step
│       ├── previous/route.ts    POST  — go back one step
│       ├── recommend/
│       │   ├── route.ts         POST  — generate full report  |  GET — load cached report
│       │   └── approval/route.ts POST — record architect approval (marks assessment completed)
│       ├── jurisdiction-scan/   POST  — run AI jurisdiction scan
│       ├── innovative-solutions/POST  — run AI innovative solutions
│       ├── similar/route.ts     GET   — load historical similarity results
│       └── findings/route.ts    GET   — assessment findings summary
├── assessments/route.ts         GET   — list all assessments (dashboard)
├── questions/route.ts           GET   — fetch questions for a step
├── response/save/route.ts       POST  — save a single question response
├── responses/route.ts           GET   — fetch all responses for an assessment
├── steps/route.ts               GET   — fetch assessment step definitions
└── health/route.ts              GET   — system health check
```

### Core Libraries

#### `lib/deterministic/` — Rules-Based Decision Engine

| File | Role |
|---|---|
| `engine.ts` | Entry point. Runs keyword matching against all responses, computes platform scores, selects winner, saves recommendation |
| `rules.ts` | Loads and re-exports `eaaf-rules.json` with TypeScript types |
| `scoring-signal-explanation-metadata.ts` | Converts raw scoring hits into human-readable signals (Assessment Concept, Architectural Interpretation, Why It Matters, Platform Impact) |
| `confidence-institutional-knowledge-report.ts` | Calculates institutional knowledge confidence (High/Medium/Low) based on signal quality, completeness, and score separation |
| `confidence-similarity-report.ts` | Calculates advisory confidence from historical similarity data (non-decisional) |
| `static-strategic-platform-fit-data.ts` | Generates platform readiness, timeline, cost, and governance risk narrative for each platform |
| `recommendation-document-assembler.ts` | Produces the assembled document (summary, platform analysis, next steps, disclaimer) |
| `institutional-knowledge-low-signal-report.ts` | Fallback report used when insufficient scoring signals exist |

#### `lib/similarity/` — Historical Assessment Matching

| File | Role |
|---|---|
| `engine.ts` | Finds the top-N most similar historical assessments. Uses semantic embeddings (cosine similarity) with lexical fallback when embedding service is unavailable |
| `embeddings.ts` | Calls the local Python embedding service (`http://127.0.0.1:8001`) to compute and compare embedding vectors |

#### `lib/jurisdiction/` — AI Jurisdiction Scan

| File | Role |
|---|---|
| `engine.ts` | Builds the prompt from assessment context, calls AI, parses JSON response, normalizes entries |
| `ai-client.ts` | Routes calls to the correct AI provider (Gemini, OpenAI, Anthropic, Azure, custom) |
| `config.ts` | Reads AI provider configuration from env vars. Controls regions, temperature, token limits |

#### `lib/innovative/` — AI Innovative Solutions

| File | Role |
|---|---|
| `engine.ts` | Builds prompt, calls AI (via jurisdiction ai-client), parses 1–2 innovative idea objects |

#### `lib/workflow/`

| File | Role |
|---|---|
| `step-navigation.ts` | `advanceToNextStep` / `goToPreviousStep` — updates `current_step_id` in `assessments` |

#### `lib/db/`

| File | Role |
|---|---|
| `db.ts` | SQLite connection singleton (`better-sqlite3`) |
| `aiCache.ts` | Read/write for `assessment_ai_cache` (AI scans only) |
| `reportCache.ts` | Read/write for `assessment_report_cache` (full computed report) |

#### `lib/access-control.ts`

Tunnel read-only guard. When a request arrives through a Cloudflare tunnel (non-localhost host), completed assessments are read-only. All mutating API routes call `tunnelReadOnly(req, assessmentId)` at the top of their handler.

#### `middleware.ts`

HTTP Basic Auth. Enforced only when `AUTH_USERNAME` and `AUTH_PASSWORD` are set in `.env.local`. Localhost is always bypassed.

---

## 5. Database Design

### Schema Overview

```
assessments (core record)
    │
    ├── responses (answers to questions)
    ├── assessment_step_state (step completion tracking)
    ├── recommendations (deterministic platform decision)
    ├── assessment_ai_cache (AI scan results — jurisdiction, innovative)
    ├── assessment_report_cache (full computed report cache)
    ├── assessment_embeddings (semantic vector for similarity matching)
    └── assessment_history (point-in-time snapshots)

assessment_steps (step definitions — seeded)
    └── Factor (factors within each step — seeded)
            └── SubFactor (sub-factors — seeded)
                    └── questions (question definitions — seeded)
```

### Table Reference

#### `assessments`
The root record. One row per assessment.

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | |
| `name` | TEXT | Assessment name |
| `status` | TEXT | `draft` → `in_progress` → `completed` |
| `current_step_id` | TEXT | FK-like to step key (e.g. `CLOUD_ASSESSMENT`) |
| `business_context` | TEXT | Business problem description |
| `business_goals` | TEXT | Strategic goals |
| `business_drivers` | TEXT | Drivers (compliance, efficiency, etc.) |
| `business_requirement` | TEXT | Technical/functional requirements |
| `completed_at` | DATETIME | Set when architect records approval |

> **Completion rule:** `status = 'completed'` is only set by the architect approval route (`POST /recommend/approval`). Generating a report does NOT complete an assessment.

---

#### `assessment_steps`, `Factor`, `SubFactor`, `questions`
Seeded from `seed-data/seed-questions.local.json`. Define the question hierarchy. Never written to at runtime.

| Table | Purpose |
|---|---|
| `assessment_steps` | 4 evaluation stages (Architecture, Cloud, Platform, Operational) + Final Recommendation |
| `Factor` | Named evaluation factors within each stage |
| `SubFactor` | Sub-factors within each factor |
| `questions` | Individual questions with `question_key` used for scoring rule lookup |

---

#### `responses`
Architect's answers. One row per `(assessment_id, question_id)`.

| Column | Notes |
|---|---|
| `assessment_id` | FK to `assessments` |
| `question_id` | FK to `questions` |
| `step_id` | FK to `assessment_steps` (for step-level queries) |
| `response_text` | Free text answer |
| `updated_at` | Used to detect if answers changed since last report generation |

---

#### `recommendations`
The deterministic platform decision. One row per assessment (replaced on each regeneration).

| Column | Notes |
|---|---|
| `assessment_id` | FK to `assessments` |
| `platform_recommendation` | Display name of the winning platform |
| `rationale` | Auto-generated rationale listing top concept names |
| `confidence_score` | 0–100, normalised suitability score |
| `risks` | Platform-specific risk text |
| `alternatives` | Platform-specific alternative text |
| `architect_approval` | `agree` \| `disagree` \| NULL |
| `architect_approval_reason` | Optional reason for disagreement |
| `architect_approval_recorded_at` | Timestamp when architect submitted |
| `created_at` | Used alongside `responses.updated_at` to detect staleness |

---

#### `assessment_report_cache`
Full computed `FullRec` JSON. One row per assessment. Persists across server restarts.

| Column | Notes |
|---|---|
| `assessment_id` | FK to `assessments` (UNIQUE) |
| `report_json` | Complete JSON blob of the computed report |
| `created_at` | Set on write |

**Written by:** `POST /recommend` (after generating a new report), `GET /recommend` (on first access / cache warm)  
**Read by:** `GET /recommend` — returned directly to client when `responsesChangedSince = false`  
**Invalidated:** Never explicitly deleted — overwritten on each report generation. Effectively stale when answers change (detected via timestamp comparison).

---

#### `assessment_ai_cache`
AI scan results. One row per `(assessment_id, cache_type)`. `INSERT OR REPLACE` on each new scan.

| Column | Notes |
|---|---|
| `assessment_id` | FK to `assessments` |
| `cache_type` | `jurisdiction_scan` \| `innovative_solutions` |
| `result_json` | JSON blob of the AI scan result |

**Written by:** `POST /jurisdiction-scan`, `POST /innovative-solutions`  
**Read by:** `GET /recommend` — injected into the report response so components load cached results on mount

---

#### `assessment_embeddings`
Semantic vector for the assessment, used in similarity search. One row per assessment.

| Column | Notes |
|---|---|
| `assessment_id` | FK to `assessments` (UNIQUE) |
| `context_embedding` | JSON array of floats (all-MiniLM-L6-v2 output) |
| `embedding_model` | Model name for version tracking |

**Written by:** `scripts/backfill-baseline-and-embeddings.js`  
**Read by:** `lib/similarity/engine.ts` — computes cosine similarity against all stored embeddings

---

#### `assessment_step_state`
Tracks per-step completion state. One row per `(assessment_id, step_id)`.

---

#### `assessment_history`
Point-in-time JSON snapshots. Appended on each report generation. Used for audit trail and the historical similarity pool.

---

## 6. Key Data Flows

### Assessment Lifecycle

```
Create assessment (POST /assessment/create)
    └── status: 'draft'

Fill in business context (PUT /assessment/[id])
    └── status: 'in_progress' (implicit via current_step_id)

Answer questions step by step (POST /response/save + POST /next)
    └── responses table grows
    └── current_step_id advances through ARCHITECTURE → CLOUD → PLATFORM → OPERATIONAL

Arrive at FINAL_RECOMMENDATION step

Generate report (POST /recommend)
    └── Deterministic engine scores all responses against eaaf-rules.json keywords
    └── Saves recommendation row (platform winner + rationale)
    └── Builds full FullRec (signals, similarity, confidence, platform fit, assembled doc)
    └── Saves FullRec to assessment_report_cache

Subsequent page loads (GET /recommend)
    └── responsesChangedSince = false → return assessment_report_cache directly
    └── responsesChangedSince = true  → return slim summary → user regenerates

Architect records decision (POST /recommend/approval)
    └── Updates recommendations.architect_approval
    └── Sets assessments.status = 'completed', completed_at = NOW()
```

### Report Cache Strategy

```
GET /recommend
    ├── responsesChangedSince = true  → return slim summary (client shows Generate button)
    └── responsesChangedSince = false
            ├── assessment_report_cache hit  → return cached FullRec (fast)
            └── assessment_report_cache miss → computeFullReport() → save cache → return FullRec (slow, once only)
```

Cache persists in SQLite — survives server restarts. The "slow first load" only happens once per assessment per DB instance.

### Concept-Based Signal Reporting

The deterministic engine matches keywords internally but the report **never exposes matched keywords**. Each matched rule surfaces:

- **Assessment Concept** — name from `eaaf-rules.json` (e.g. "Enterprise IT Service Management")
- **Evidence Found** — architect's actual response text
- **Architectural Interpretation** — rule `description` field
- **Why It Matters** — rule `whyItMatters` field
- **Platform Impact** — `+X pts` per platform, concept-driven rationale

---

## 7. Configuration Reference (`.env.local`)

| Variable | Purpose | Required |
|---|---|---|
| `NEXT_PUBLIC_BASE_PATH` | Injected automatically from `next.config.ts` — do not set manually | — |
| `AUTH_USERNAME` | Basic auth username for external access | No (disables auth if absent) |
| `AUTH_PASSWORD` | Basic auth password for external access | No |
| `TUNNEL_ORIGIN` | Cloudflare tunnel hostname(s) for `allowedDevOrigins` (comma-separated) | No |
| `JURISDICTION_AI_PROVIDER` | `gemini` \| `openai` \| `anthropic` \| `azure` \| `custom` | Yes (for AI scans) |
| `JURISDICTION_AI_ENDPOINT` | Base URL for AI provider | Yes (for AI scans) |
| `JURISDICTION_AI_KEY` | API key | Yes (for AI scans) |
| `JURISDICTION_AI_MODEL` | Model name | Yes (for AI scans) |
| `JURISDICTION_AI_MAX_TOKENS` | Default 4000 | No |
| `JURISDICTION_AI_TEMPERATURE` | Default 0.1 (jurisdiction scan), overridden by `INNOVATIVE_AI_TEMPERATURE` | No |
| `INNOVATIVE_AI_TEMPERATURE` | Default 0.7 — higher for creative ideation | No |
| `JURISDICTION_REGIONS` | Comma-separated: `canada,us,europe,other` — default `canada` | No |
| `LOCAL_EMBEDDING_SERVICE_URL` | Default `http://127.0.0.1:8001` | No |

---

## 8. Access Control

### HTTP Basic Auth (`middleware.ts`)
Applies to all routes when `AUTH_USERNAME` / `AUTH_PASSWORD` are set. Bypassed for `localhost` and `127.0.0.1` automatically.

### Tunnel Read-Only (`lib/access-control.ts`)
When requests arrive through a Cloudflare tunnel (non-localhost `Host` header), **completed assessments are read-only**. The following routes enforce this via `tunnelReadOnly(req, assessmentId)`:

- `PUT /assessment/[id]`
- `POST .../next`, `POST .../previous`
- `POST .../recommend`
- `POST .../recommend/approval`
- `POST .../jurisdiction-scan`
- `POST .../innovative-solutions`
- `POST /response/save`

New assessments and in-progress assessments remain fully editable through the tunnel.

**To remove:** Delete `lib/access-control.ts` and remove the two-line guard from each protected route.

---

## 9. Rules Configuration (`rules/eaaf-rules.json`)

The authoritative source for scoring rules, platform display names, confidence thresholds, rationale templates, and similarity configuration. Key sections:

| Section | Used By |
|---|---|
| `platformRules.scoringRules` | Deterministic engine — keyword matching and platform scores |
| `platformRules.platformDisplay/Strengths/Weaknesses/Risks/Alternatives` | Report Section 4 (Platform Evaluation) |
| `platformRules.rationaleTemplates` | Auto-generated rationale text in `recommendations.rationale` |
| `confidence.institutional` | Confidence scoring thresholds and labels |
| `confidence.similarity` | Historical similarity advisory confidence |
| `lowSignal` | Fallback recommendation when insufficient signals exist |
| `platformGuidance` | Readiness, timeline, cost, governance narrative per platform |
| `recommendationTemplate` | Section 8 assembled document templates |
| `similarity` | Stop words, category weights, lexical fallback narratives |

**To add a new scoring concept:** Add a new entry under `platformRules.scoringRules[questionKey]` with `concept`, `description`, `whyItMatters`, `keywords`, and `scores`.
THIS FILE ACTS AS as a 
Decision engine.
Knowledge base.
Report content repository.
Confidence framework.
Historical similarity configuration.
Recommendation generation template library
