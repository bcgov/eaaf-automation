# EAAF Automation

Enterprise Architecture Assessment Framework (EAAF) — automated platform recommendation tool for BC Government enterprise architects.

---

## What This Application Does

EAAF Automation guides an enterprise architect through a structured, multi-stage assessment of a proposed digital service or application. At the end of the assessment, it produces a formal recommendation report that recommends one of four BC Government–approved delivery platforms:

- **Salesforce** — citizen-facing portals, CRM, case management
- **ServiceNow** — IT service management, workflow automation, incident management
- **Microsoft Power Platform** — low-code applications, internal tooling, M365-integrated workflows
- **Custom Build** — unique requirements that cannot be met by an existing platform

The recommendation is determined entirely by a **Rules Based Decision Engine** — a deterministic scoring system driven by predefined architecture rules. There is no black-box AI involved in the platform selection.

---

## How It Works

### Assessment Stages

Each assessment moves through five sequential stages:

| Stage | Purpose |
|-------|---------|
| **1. Architecture** | Current-state architecture, integration needs, data classification |
| **2. Cloud Assessment** | Cloud hosting model, SaaS vs PaaS preferences, security posture |
| **3. Platform Assessment** | Workflow complexity, licensing constraints, vendor alignment |
| **4. Operational Considerations** | Team capability, timeline, governance, support model |
| **5. Final Recommendation** | Automated report with platform recommendation and rationale |

### Recommendation Report

The final report produced at Stage 5 includes:

1. **Platform Recommendation** — the selected platform with confidence score
2. **Assessment Responses** — full record of all responses across all stages
3. **Assessment Signals and Scoring Evidence** — which responses triggered which scoring rules and why
4. **Platform Evaluation** — all four platforms assessed and scored, with rationale for why each was or was not selected
5. **Rules Based Decision Engine** — the deterministic scoring result with confidence breakdown
6. **Historical Precedent** — similar past assessments and how they compare
7. **Institutional Confidence** — evidence quality assessment and low-signal advisory
8. **Jurisdiction Scan** *(AI-assisted)* — real-world Canadian public sector implementations most closely aligned with this assessment
9. **Innovative Solutions** *(AI-assisted)* — exploratory architectural alternatives and variations
10. **Final Recommendation Sign-off** — architect confirmation recorded for governance

---

## Configuring the Scoring Rules

The platform recommendation logic is driven by a single configuration file:

### `rules/eaaf-rules.json`

This is the master configuration for the entire scoring engine. All rule changes are made here — no code changes are needed for most adjustments.

| Section in the file | What it controls |
|--------------------|-----------------|
| `platformRules.scoringRules` | Keywords that trigger scoring for each platform, with point values |
| `platformRules.platformDisplay` | Display names for each platform |
| `platformRules.platformStrengths` | Strengths listed in the Platform Evaluation section |
| `platformRules.platformWeaknesses` | Weaknesses listed in the Platform Evaluation section |
| `explanations.signalMetadata` | Human-readable names and explanations for each scoring signal — provide an entry per question key to replace the auto-derived label |
| `explanations.default` | Fallback signal name, stage, and interpretation text when no signal metadata entry exists |
| `platformGuidance.platformAssessments` | Organizational readiness scores, timeline risks, team capability gaps, and governance risk per platform — shown in the Platform Evaluation section |
| `similarity.categoryModel` | Dimension weights used when comparing assessments for similarity (e.g., 20% for business domain, 15% for integration complexity) |
| `similarity.stopWords` | Common words ignored during text comparison |

**To adjust scoring:** Open `rules/eaaf-rules.json`, find the question key under `platformRules.scoringRules`, and add, remove, or reweight keywords.

**To give a signal a proper name:** Add an entry to `explanations.signalMetadata` keyed by the question key (e.g., `"CLOUD_SAAS_001"`). Without an entry, the app auto-derives a readable name from the key.

**To change platform narratives:** Edit `lib/deterministic/institutional-knowledge-low-signal-report.ts` — the `INSTITUTIONAL_KNOWLEDGE_PLATFORM_PROFILES` array controls the prose descriptions of each platform's pros, cons, and best-fit scenarios.

### Confidence Formulas

| File | What it controls |
|------|-----------------|
| `lib/deterministic/confidence-institutional-knowledge-report.ts` | How deterministic evidence contributes to the confidence score |
| `lib/deterministic/confidence-similarity-report.ts` | How historical match quality contributes to confidence |

---

## AI-Assisted Features

Two sections of the report use an external AI model (configured in `.env.local`):

| Feature | Report Section | What it produces |
|---------|---------------|-----------------|
| **Jurisdiction Scan** | Section 8 | Real-world Canadian public sector precedents most similar to this assessment |
| **Innovative Solutions** | Section 9 | Exploratory architectural alternatives and variations |

These features do not influence the platform recommendation. Results are AI-generated and require independent verification before use in governance submissions.

AI results are **cached** after the first run. Subsequent loads of the same assessment show the cached result instantly without re-running the AI, unless the architect explicitly clicks "Re-run."

The AI provider, model, and API key are set in `.env.local` — see the environment configuration below.

---

## Environment Configuration (`.env.local`)

This file is not committed to git. Each developer creates their own local copy. The variables it must contain:

| Variable | Purpose | Example value |
|----------|---------|---------------|
| `JURISDICTION_AI_PROVIDER` | AI provider for jurisdiction scan and innovative solutions | `gemini` |
| `JURISDICTION_AI_ENDPOINT` | API base URL for the AI provider | `https://generativelanguage.googleapis.com/v1beta` |
| `JURISDICTION_AI_KEY` | API key | *(from team lead)* |
| `JURISDICTION_AI_MODEL` | Model name | `gemini-2.5-flash` |
| `JURISDICTION_REGIONS` | Regions to scan (comma-separated) | `canada` or `canada,us,europe,other` |
| `JURISDICTION_AI_MAX_TOKENS` | Max response token limit | `8000` |
| `JURISDICTION_AI_TEMPERATURE` | AI temperature — lower = more factual | `0.2` |
| `INNOVATIVE_AI_TEMPERATURE` | AI temperature for innovative solutions | `0.7` |

Request the key values from your team lead.

---

## Frequently Asked Questions

**Q: Can a business owner or project sponsor use this tool?**
A: The tool is designed for business owners and analysts who would work with enterprise architects.

**Q: Does AI choose the recommended platform?**
A: No. The platform recommendation is made exclusively by the Rules Based Decision Engine — a deterministic, rule-driven system defined by enterprise architects. The AI-assisted sections (Jurisdiction Scan, Innovative Solutions) provide supporting context only and have no influence on the platform selection.

**Q: Can the scoring rules be changed without a developer?**
A: Yes, for most changes. The `rules/eaaf-rules.json` file is plain JSON and can be edited directly. Changes to keyword triggers, point values, platform narrative text, and confidence parameters do not require code changes.

**Q: How is historical precedent used?**
A: Past assessments stored in the database are compared against the current assessment using an embedding-based similarity model. The top matching historical assessments are displayed in the report as supporting context, alongside a detailed breakdown of what they have in common with the current assessment and where they differ.

**Q: What happens if no historical assessments exist?**
A: The recommendation engine works fully without them. The Historical Precedent and Similarity sections of the report will be empty, and the confidence score will reflect the absence of historical alignment.

**Q: Can an architect override the recommendation?**
A: The architect confirms or overrides the recommendation in Section 10 (Final Recommendation Sign-off). This decision is recorded for governance purposes. It does not change the underlying scoring or affect future assessments.

---

## Developer Setup

If you are setting up a local development environment, see **[SETUP.md](SETUP.md)**.

Start from the `main` branch:
**https://github.com/ghsansin/eaaf-automation/tree/main**

Always cut a new branch from `main` before making changes:

```bash
git checkout main
git pull origin main
git checkout -b feature/your-branch-name
```

---

## Support

1. For setup issues, follow the step-by-step guide in [SETUP.md](SETUP.md)
2. For team-specific configuration (seed data, API keys), contact your team lead
3. GitHub Issues: https://github.com/ghsansin/eaaf-automation/issues

