# EAAF Automation — Database Design

`data/app.db` is a SQLite database, initialized by `npm run db:init`. It is excluded from git.

---

## Tables Overview

| Table | Purpose |
|-------|---------|
| `assessments` | One row per assessment — metadata, status, business context |
| `assessment_steps` | Assessment stages (Architecture, Cloud, Platform, Ops, Final) |
| `Factor` | Scoring factors grouped by step |
| `SubFactor` | Sub-factors grouped by factor |
| `questions` | Question definitions — synced from `rules/eaaf-questions.json` |
| `responses` | User answers — one row per (assessment, question) pair |
| `assessment_step_state` | Per-step completion tracking for each assessment |
| `recommendations` | Final platform recommendation and architect sign-off per assessment |
| `assessment_history` | JSON snapshots of assessments (for audit/history) |
| `assessment_embeddings` | Embedding vectors for similarity matching |
| `assessment_ai_cache` | Cached AI results (jurisdiction scan, innovative solutions) |
| `assessment_report_cache` | Cached fully-assembled recommendation report JSON |

---

## Entity Relationships

```
assessment_steps (1) ──── (N) Factor
Factor           (1) ──── (N) SubFactor
assessment_steps (1) ──── (N) questions
Factor           (1) ──── (N) questions
SubFactor        (1) ──── (N) questions

assessments      (1) ──── (N) responses
questions        (1) ──── (N) responses          ← FK: responses.question_id → questions.id
assessment_steps (1) ──── (N) responses

assessments      (1) ──── (N) assessment_step_state
assessments      (1) ──── (1) recommendations
assessments      (1) ──── (N) assessment_history
assessments      (1) ──── (1) assessment_embeddings
assessments      (1) ──── (N) assessment_ai_cache
assessments      (1) ──── (1) assessment_report_cache
```

---

## Table Definitions

### `assessments`

One row per assessment. Status moves: `draft` → `in_progress` → `completed` → `archived`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | Auto-increment |
| `name` | TEXT | Assessment name |
| `description` | TEXT | Optional description |
| `status` | TEXT | `draft`, `in_progress`, `completed`, `archived` |
| `current_step_id` | TEXT | Active step key |
| `business_context` | TEXT | Free-text business context |
| `business_goals` | TEXT | Goals (JSON array) |
| `business_drivers` | TEXT | Drivers (JSON array) |
| `business_requirement` | TEXT | Requirement summary |
| `created_at` | DATETIME | |
| `updated_at` | DATETIME | |
| `completed_at` | DATETIME | Set when status → completed |

---

### `assessment_steps`

The five fixed stages of every assessment. Populated from `rules/eaaf-questions.json` on `db:init`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | Auto-increment |
| `key` | TEXT UNIQUE | e.g. `ARCHITECTURE`, `CLOUD_ASSESSMENT` |
| `name` | TEXT | Display name |
| `sequence` | INTEGER | Display order (1–5) |
| `description` | TEXT | |

---

### `Factor`

Scoring factors, one or more per step. Populated from `rules/eaaf-questions.json`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | e.g. `fac_arch_security` |
| `stepKey` | TEXT FK → `assessment_steps.key` | |
| `factorKey` | TEXT UNIQUE | e.g. `security` |
| `name` | TEXT | Display name |
| `description` | TEXT | |
| `displayOrder` | INTEGER | Order within step |

---

### `SubFactor`

Sub-factors nested under each factor. Populated from `rules/eaaf-questions.json`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | e.g. `subf_arch_security_controls` |
| `factorId` | TEXT FK → `Factor.id` | |
| `subFactorKey` | TEXT UNIQUE | |
| `name` | TEXT | Display name |
| `description` | TEXT | |
| `displayOrder` | INTEGER | Order within factor |

---

### `questions`

One row per question. Synced from `rules/eaaf-questions.json` every time `db:init` runs.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | Auto-increment — **never reuse, never delete** |
| `step_id` | INTEGER FK → `assessment_steps.id` | |
| `question_key` | TEXT UNIQUE | Stable identifier — e.g. `Q001`, `CLOUD_SAAS_001` |
| `factor` | TEXT | Factor key |
| `question_text` | TEXT | Display text — safe to update |
| `help_text` | TEXT | Optional hint text |
| `input_type` | TEXT | `free_text` (default) |
| `sequence` | INTEGER | Order within step |
| `step_key` | TEXT FK → `assessment_steps.key` | Denormalized for convenience |
| `factorId` | TEXT FK → `Factor.id` | |
| `subFactorId` | TEXT FK → `SubFactor.id` | |

**Critical constraint:** Rows are never deleted from this table. `responses.question_id` is a hard FK to `questions.id`. Deleting a question row would orphan all responses for that question.

---

### `responses`

One row per (assessment, question) pair. Upserted on every save.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | |
| `assessment_id` | INTEGER FK → `assessments.id` | |
| `question_id` | INTEGER FK → `questions.id` | Resolved at write time from `question_key` |
| `step_id` | INTEGER FK → `assessment_steps.id` | Denormalized from question at write time |
| `response_text` | TEXT | User's answer |
| `created_at` | DATETIME | |
| `updated_at` | DATETIME | Updated on each re-save |

---

### `assessment_step_state`

Tracks completion of each step within each assessment. UNIQUE on `(assessment_id, step_id)`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | |
| `assessment_id` | INTEGER FK | |
| `step_id` | INTEGER FK | |
| `status` | TEXT | `not_started`, `in_progress`, `completed` |
| `started_at` | DATETIME | |
| `completed_at` | DATETIME | |

---

### `recommendations`

Final recommendation produced by the scoring engine. One row per assessment.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | |
| `assessment_id` | INTEGER FK | |
| `platform_recommendation` | TEXT | `ServiceNow`, `PowerPlatform`, `Salesforce`, `CustomBuild` |
| `rationale` | TEXT | Scoring rationale JSON |
| `confidence_score` | INTEGER | 0–100 |
| `risks` | TEXT | JSON array |
| `alternatives` | TEXT | JSON array |
| `architect_approval` | TEXT | `approved`, `overridden`, or null |
| `architect_approval_reason` | TEXT | |
| `architect_approval_recorded_at` | DATETIME | |
| `created_at` | DATETIME | |

---

### `assessment_history`

JSON snapshots for audit purposes.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | |
| `assessment_id` | INTEGER FK | |
| `snapshot_json` | TEXT | Full assessment snapshot at point in time |
| `created_at` | DATETIME | |

---

### `assessment_embeddings`

Stores the embedding vector for each completed assessment. Used by the similarity matching engine. UNIQUE on `assessment_id`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | |
| `assessment_id` | INTEGER FK UNIQUE | |
| `context_embedding` | TEXT | Serialized float vector (JSON array) |
| `embedding_model` | TEXT | Model name, default `all-MiniLM-L6-v2` |
| `created_at` | DATETIME | |
| `updated_at` | DATETIME | |

---

### `assessment_ai_cache`

Caches AI-generated content so repeated report views do not re-invoke the AI. UNIQUE on `(assessment_id, cache_type)`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | |
| `assessment_id` | INTEGER FK | |
| `cache_type` | TEXT | `jurisdiction`, `innovative` |
| `result_json` | TEXT | AI response JSON |
| `created_at` | DATETIME | |

---

### `assessment_report_cache`

Caches the fully-assembled recommendation report JSON. Invalidated when the architect clicks "Re-run". UNIQUE on `assessment_id`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK | |
| `assessment_id` | INTEGER FK UNIQUE | |
| `report_json` | TEXT | Complete report payload |
| `created_at` | DATETIME | |

---

## Question–Response Integrity

```
questions.id (INTEGER PK)
     │
     └── responses.question_id (INTEGER FK)
```

This FK is the reason questions are never deleted:

- A question row in SQLite holds the permanent integer `id` that all response rows reference.
- If a question is removed from `rules/eaaf-questions.json`, `db:init` leaves its SQLite row intact.
- Responses for that question remain readable and are included in historical reports.
- The question simply stops appearing in the active questionnaire.

---

## Auto-Sync on Startup

`npm run db:init` runs the following upsert sequence inside a single transaction:

1. Upsert `assessment_steps` — keyed on `key`
2. Upsert `Factor` — keyed on `id` (TEXT PK)
3. Upsert `SubFactor` — keyed on `id` (TEXT PK)
4. Upsert `questions` — keyed on `question_key` (`ON CONFLICT(question_key) DO UPDATE SET ...`)

Existing integer `id` values on `questions` rows are preserved. No rows are deleted.

Source of truth: `rules/eaaf-questions.json`

---

## Embeddings and Similarity Matching

The `assessment_embeddings` table stores one vector per completed assessment. These are generated by the local Python embedding service (`http://127.0.0.1:8001`) using the `all-MiniLM-L6-v2` sentence-transformer model.

The scoring engine runs cosine similarity between the current assessment's embedding and all stored embeddings to surface the "Similar Assessments" section of the report.

If you add new historical assessments via `npm run db:seed:assessments`, run:

```bash
npm run embeddings:backfill
```

to generate their embeddings.

---

## Database Initialization

```bash
npm run db:init
```

- Creates all tables (safe — uses `CREATE TABLE IF NOT EXISTS`)
- Runs column migration guards (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS` equivalent)
- Syncs all question hierarchy data from `rules/eaaf-questions.json`
- Idempotent — safe to re-run on an existing database

For a full reset:

```bash
Remove-Item data/app.db
npm run db:init
```
