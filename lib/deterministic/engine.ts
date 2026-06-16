import db from "@/lib/db/db";

// ─── Platform types ────────────────────────────────────────────────────────────

export type Platform = "Salesforce" | "ServiceNow" | "MicrosoftPowerPlatform" | "CustomBuild";

export interface PlatformScore {
  platform: Platform;
  score: number; // 0-100
  reasons: string[];
}

export interface ScoringHit {
  questionKey: string;
  responseSnippet: string;
  keywordMatched: string;
  platformPoints: Partial<Record<Platform, number>>;
}

export interface RecommendationResult {
  platform: Platform;
  displayName: string;
  confidenceScore: number;
  rationale: string;
  risks: string;
  alternatives: string;
  platformScores: PlatformScore[];
  scoringHits: ScoringHit[];
}

// ─── Scoring signals ────────────────────────────────────────────────────────────
// Each question key maps to a set of keyword signals. When a response contains
// these signals the associated platform gets points. Points are summed then
// normalised to 0-100.

interface Signal {
  keywords: string[]; // lower-case substrings to look for
  scores: Partial<Record<Platform, number>>; // positive = favours, negative = penalises
}

// These scoring rules are defined here and can be tuned independently of the DB.
// All keyword matching is case-insensitive substring search.
const SCORING_RULES: Record<string, Signal[]> = {
  // ── ARCHITECTURE ────────────────────────────────────────────────────────────
  Q001: [
    {
      keywords: ["capability", "reuse", "enterprise", "shared"],
      scores: { Salesforce: 3, ServiceNow: 3, MicrosoftPowerPlatform: 2 },
    },
  ],
  Q002: [
    {
      keywords: ["shared service", "standard", "align"],
      scores: { Salesforce: 3, ServiceNow: 3, MicrosoftPowerPlatform: 2 },
    },
  ],
  Q009: [
    {
      keywords: ["sso", "mfa", "rbac", "identity"],
      scores: { Salesforce: 4, ServiceNow: 4, MicrosoftPowerPlatform: 4 },
    },
  ],
  Q010: [
    {
      keywords: ["encryption", "siem", "governance", "policy", "access"],
      scores: { Salesforce: 3, ServiceNow: 4, MicrosoftPowerPlatform: 3 },
    },
  ],

  // ── CLOUD ASSESSMENT ────────────────────────────────────────────────────────
  CLOUD_SAAS_001: [
    {
      keywords: ["saas", "satisfy", "commercial", "product"],
      scores: { Salesforce: 5, ServiceNow: 5, MicrosoftPowerPlatform: 4 },
    },
    {
      keywords: ["custom", "build", "not available", "none"],
      scores: { CustomBuild: 6, Salesforce: -2, ServiceNow: -2, MicrosoftPowerPlatform: -2 },
    },
  ],
  CLOUD_SAAS_002: [
    {
      keywords: ["gap", "missing", "unavailable", "require"],
      scores: { CustomBuild: 4 },
    },
    {
      keywords: ["minor", "small", "few", "acceptable"],
      scores: { Salesforce: 3, ServiceNow: 3, MicrosoftPowerPlatform: 3 },
    },
  ],
  CLOUD_CONSTRAINT_001: [
    {
      keywords: ["no constraint", "acceptable", "no blocking", "multi-region"],
      scores: { Salesforce: 5, ServiceNow: 5, MicrosoftPowerPlatform: 4 },
    },
    {
      keywords: ["sovereignty", "on-prem", "data residency", "block"],
      scores: { CustomBuild: 5, Salesforce: -3, ServiceNow: -2 },
    },
  ],
  CLOUD_BUILD_001: [
    {
      keywords: ["not justified", "saas available", "no justification"],
      scores: { Salesforce: 5, ServiceNow: 4, MicrosoftPowerPlatform: 4 },
    },
    {
      keywords: ["justified", "differentiating", "unique capability"],
      scores: { CustomBuild: 8, Salesforce: -4, ServiceNow: -4, MicrosoftPowerPlatform: -4 },
    },
  ],
  CLOUD_BUILD_002: [
    {
      keywords: ["saas cheaper", "lower cost", "faster"],
      scores: { Salesforce: 3, ServiceNow: 3, MicrosoftPowerPlatform: 3 },
    },
    {
      keywords: ["custom build cheaper", "build cost"],
      scores: { CustomBuild: 4 },
    },
  ],

  // ── PLATFORM ASSESSMENT ─────────────────────────────────────────────────────
  PLAT_CRM_001: [
    {
      keywords: ["crm", "case management", "lifecycle", "orchestration", "strong crm"],
      scores: { Salesforce: 10, ServiceNow: 4, MicrosoftPowerPlatform: 3 },
    },
    {
      keywords: ["itsm", "service management", "workflow", "operations"],
      scores: { ServiceNow: 8, Salesforce: 2, MicrosoftPowerPlatform: 3 },
    },
  ],
  PLAT_CRM_002: [
    {
      keywords: ["customer engagement", "citizen", "portal", "self-service"],
      scores: { Salesforce: 8, MicrosoftPowerPlatform: 5 },
    },
    {
      keywords: ["incident", "service desk", "ticket", "sla"],
      scores: { ServiceNow: 8, Salesforce: 2 },
    },
  ],
  PLAT_WORKFLOW_001: [
    {
      keywords: ["workflow", "itsm", "operations", "internal process", "service management"],
      scores: { ServiceNow: 9, MicrosoftPowerPlatform: 5, Salesforce: 2 },
    },
    {
      keywords: ["minimal", "small", "not primary"],
      scores: { Salesforce: 3 },
    },
  ],
  PLAT_LOWCODE_001: [
    {
      keywords: ["low code", "rapid", "business team", "citizen developer", "primary"],
      scores: { MicrosoftPowerPlatform: 10, Salesforce: 5, ServiceNow: 3 },
    },
    {
      keywords: ["lightweight", "simple", "basic"],
      scores: { MicrosoftPowerPlatform: 8, Salesforce: 2, ServiceNow: 1 },
    },
    {
      keywords: ["not primary", "minimal", "pro developer"],
      scores: { Salesforce: 3, ServiceNow: 4 },
    },
  ],
  PLAT_ORG_SIZE_001: [
    {
      keywords: ["5000", "5,000", "small organization", "limited scope", "simple requirements"],
      scores: { MicrosoftPowerPlatform: 9, Salesforce: 1, ServiceNow: 0 },
    },
  ],
  PLAT_INT_001: [
    {
      keywords: ["deep integration", "empi", "enterprise", "registry", "finance", "bi-directional"],
      scores: { Salesforce: 9, ServiceNow: 6, MicrosoftPowerPlatform: 4 },
    },
    {
      keywords: ["minimal integration", "simple", "few systems", "lightweight integration"],
      scores: { MicrosoftPowerPlatform: 8, ServiceNow: 4, Salesforce: 2 },
    },
  ],
  PLAT_INT_002: [
    {
      keywords: ["high volume", "real-time", "low latency", "reliability"],
      scores: { Salesforce: 7, ServiceNow: 7, MicrosoftPowerPlatform: 4 },
    },
  ],
  PLAT_ECO_001: [
    {
      keywords: ["mature ecosystem", "partner", "governance", "critical"],
      scores: { Salesforce: 9, ServiceNow: 7, MicrosoftPowerPlatform: 6 },
    },
    {
      keywords: ["not important", "minimal", "not critical"],
      scores: { CustomBuild: 3, MicrosoftPowerPlatform: 5 },
    },
  ],

  // ── OPERATIONAL ─────────────────────────────────────────────────────────────
  OPS_SUP_001: [
    {
      keywords: ["partner", "augmentation", "managed service", "support"],
      scores: { Salesforce: 5, ServiceNow: 5, MicrosoftPowerPlatform: 4 },
    },
    {
      keywords: ["internal only", "no external", "self-sufficient"],
      scores: { CustomBuild: 4, MicrosoftPowerPlatform: 4 },
    },
  ],
  OPS_SUP_002: [
    {
      keywords: ["managed service", "partner", "vendor support"],
      scores: { Salesforce: 4, ServiceNow: 4, MicrosoftPowerPlatform: 3 },
    },
  ],
  OPS_RISK_001: [
    {
      keywords: ["privacy", "compliance", "audit", "gdpr", "strict"],
      scores: { Salesforce: 7, ServiceNow: 6, MicrosoftPowerPlatform: 5 },
    },
    {
      keywords: ["minimal", "low risk", "not critical"],
      scores: { CustomBuild: 4, MicrosoftPowerPlatform: 5 },
    },
  ],

  // ── FINAL RECOMMENDATION ────────────────────────────────────────────────────
  FINAL_REC_001: [
    {
      keywords: ["salesforce", "crm", "case management"],
      scores: { Salesforce: 10 },
    },
    {
      keywords: ["servicenow", "itsm", "workflow"],
      scores: { ServiceNow: 10 },
    },
    {
      keywords: ["power platform", "dynamics", "microsoft"],
      scores: { MicrosoftPowerPlatform: 10 },
    },
    {
      keywords: ["custom", "build", "bespoke"],
      scores: { CustomBuild: 10 },
    },
  ],
  FINAL_REC_002: [
    {
      keywords: ["high confidence", "high", "strong"],
      scores: { Salesforce: 5, ServiceNow: 5, MicrosoftPowerPlatform: 5 },
    },
  ],

  // ── METADATA SCORING (Business context, goals, drivers, requirement) ────────
  META_Business_Context: [
    {
      keywords: ["itsm", "incident", "service desk", "service request", "problem management", "change control", "change management", "sla", "workflow automation"],
      scores: { ServiceNow: 9, Salesforce: 2, MicrosoftPowerPlatform: 1 },
    },
    {
      keywords: ["under 5000", "less than 5000", "small scope", "boutique", "limited", "lightweight", "simple", "internal staff"],
      scores: { MicrosoftPowerPlatform: 8, Salesforce: 1 },
    },
    {
      keywords: ["enterprise-wide", "complex", "deep integration", "crm"],
      scores: { Salesforce: 6, ServiceNow: 4 },
    },
  ],
  META_Business_Requirement: [
    {
      keywords: ["itsm", "incident", "service desk", "service request", "problem management", "change control", "change management", "sla", "workflow"],
      scores: { ServiceNow: 10, Salesforce: 1, MicrosoftPowerPlatform: 1 },
    },
    {
      keywords: ["under 5000", "less than 5000", "small scope", "boutique", "limited", "lightweight", "simple", "internal"],
      scores: { MicrosoftPowerPlatform: 9, Salesforce: 0 },
    },
    {
      keywords: ["complex crm", "case management", "deep integration"],
      scores: { Salesforce: 7, ServiceNow: 5 },
    },
  ],
  META_Business_Goals: [
    {
      keywords: ["incident management", "sla enforcement", "workflow automation", "service desk"],
      scores: { ServiceNow: 8, Salesforce: 2 },
    },
    {
      keywords: ["rapid deployment", "quick", "agile", "low cost"],
      scores: { MicrosoftPowerPlatform: 8, Salesforce: 2 },
    },
    {
      keywords: ["complex workflow", "case lifecycle", "mature ecosystem"],
      scores: { Salesforce: 6, ServiceNow: 5 },
    },
  ],
  META_Business_Drivers: [
    {
      keywords: ["sla compliance", "operational efficiency", "incident management", "workflow automation"],
      scores: { ServiceNow: 8, Salesforce: 2 },
    },
    {
      keywords: ["speed", "rapid", "cost reduction"],
      scores: { MicrosoftPowerPlatform: 7, Salesforce: 1 },
    },
    {
      keywords: ["enterprise standardization", "complex requirements"],
      scores: { Salesforce: 6, ServiceNow: 5 },
    },
  ],
};

// ─── Platform display metadata ───────────────────────────────────────────────

export const PLATFORM_DISPLAY: Record<Platform, string> = {
  Salesforce: "Salesforce (CRM + Case Management)",
  ServiceNow: "ServiceNow (ITSM + Workflow)",
  MicrosoftPowerPlatform: "Microsoft Power Platform",
  CustomBuild: "Custom Build",
};

export const PLATFORM_STRENGTHS: Record<Platform, string[]> = {
  Salesforce: [
    "Market-leading CRM and case management capabilities",
    "Deep enterprise integration ecosystem (MuleSoft, APIs)",
    "Mature BC Government and Canadian public sector deployment history",
    "Robust RBAC, audit logging, and data governance controls",
    "AppExchange ecosystem with pre-built accelerators",
    "Strong support for complex case lifecycle management",
  ],
  ServiceNow: [
    "Best-in-class ITSM and workflow automation",
    "Proven for service desk, incident, and change management",
    "Strong operational governance and SLA management",
    "Now Platform extensibility for custom workflows",
    "Enterprise-grade audit trail and compliance reporting",
    "Broad Canadian public sector adoption for IT operations",
  ],
  MicrosoftPowerPlatform: [
    "Included within existing BC Government M365 E3/E5 licences — no significant incremental cost",
    "Rapid low-code application development for business teams",
    "Native integration with Teams, SharePoint, and Azure AD",
    "Power Automate for lightweight workflow orchestration",
    "Suitable for lightweight and moderate workflow requirements",
    "Familiar tooling for ministry staff already using M365",
  ],
  CustomBuild: [
    "Full control over functionality, data model, and architecture",
    "No vendor lock-in or licensing dependency",
    "Can be tailored precisely to unique regulatory requirements",
    "Potential for reuse across multiple ministry programs",
    "Full ownership of IP and source code",
  ],
};

export const PLATFORM_WEAKNESSES: Record<Platform, string[]> = {
  Salesforce: [
    "High per-user licensing cost — significant budget implication at scale",
    "Requires dedicated Salesforce admin and developer skills",
    "Complex integration with legacy provincial systems (EMPI, financial registries)",
    "Customisation can accumulate technical debt if not governed",
    "Vendor dependency for roadmap and pricing changes",
  ],
  ServiceNow: [
    "Limited CRM depth — not designed for citizen or case-centric workflows",
    "Significant implementation effort and specialist team required",
    "High licensing cost, particularly for non-IT use cases",
    "Overkill for lightweight or non-ITSM business problems",
    "Requires dedicated ServiceNow platform expertise",
  ],
  MicrosoftPowerPlatform: [
    "Governance challenges with citizen development at scale",
    "Limited enterprise integration without premium connectors (additional cost)",
    "Power Apps can become fragile or ungoverned without CoE toolkit",
    "Advanced scenario licensing may be required for some capabilities",
    "Less suited for complex case lifecycle management",
    "Long-term viability of low-code solutions requires architectural oversight",
  ],
  CustomBuild: [
    "High development cost and long delivery timeline",
    "Long-term maintenance burden falls entirely on the ministry",
    "Significant talent dependency — risk if key staff leave",
    "No vendor roadmap, security patching, or product evolution",
    "Rarely justified when commercial SaaS alternatives exist",
    "Higher risk profile for complex integrations",
  ],
};

const PLATFORM_RISKS: Record<Platform, string> = {
  Salesforce:
    "Custom integration complexity; high per-user licensing cost; dependency on Salesforce admin skills",
  ServiceNow:
    "Significant implementation effort; limited CRM depth; requires ServiceNow specialist team",
  MicrosoftPowerPlatform:
    "Governance challenges with citizen development; limited enterprise integration without premium connectors",
  CustomBuild:
    "High development cost and time; long-term maintenance burden; talent dependency; no vendor roadmap benefit",
};

const PLATFORM_ALTERNATIVES: Record<Platform, string> = {
  Salesforce:
    "ServiceNow for ITSM-heavy workloads; Microsoft Power Platform for lower cost; Custom build for unique capability gaps",
  ServiceNow:
    "Salesforce for CRM/case-centric use cases; Microsoft Power Platform for lighter workflow needs",
  MicrosoftPowerPlatform:
    "Salesforce for enterprise CRM depth; ServiceNow for ITSM; Custom build if unique IP is required",
  CustomBuild:
    "Salesforce or ServiceNow should be reconsidered — both offer extensible platforms that may meet needs without full custom investment",
};

// ─── Score engine ─────────────────────────────────────────────────────────────

function scoreResponse(
  questionKey: string,
  responseText: string,
  scores: Record<Platform, number>,
  reasons: Record<Platform, string[]>,
  hits: ScoringHit[]
): void {
  const rules = SCORING_RULES[questionKey];
  if (!rules) return;

  const lowerResponse = responseText.toLowerCase();

  for (const rule of rules) {
    const matchedKw = rule.keywords.find((kw) => lowerResponse.includes(kw));
    const matched = !!matchedKw;
    if (matched) {
      const positivePoints: Partial<Record<Platform, number>> = {};
      for (const [platform, points] of Object.entries(rule.scores) as [Platform, number][]) {
        scores[platform] = (scores[platform] ?? 0) + points;
        if (points > 0) {
          positivePoints[platform] = points;
          reasons[platform] = reasons[platform] ?? [];
          reasons[platform].push(
            `${questionKey} response signals "${rule.keywords[0]}" (${points > 0 ? "+" : ""}${points}pts)`
          );
        }
      }
      if (Object.keys(positivePoints).length > 0) {
        hits.push({
          questionKey,
          responseSnippet: responseText.substring(0, 120) + (responseText.length > 120 ? "…" : ""),
          keywordMatched: matchedKw!,
          platformPoints: positivePoints,
        });
      }
    }
  }
}

function normaliseScores(raw: Record<Platform, number>): Record<Platform, number> {
  const min = Math.min(...Object.values(raw));
  const shifted: Record<Platform, number> = {} as any;
  for (const [p, v] of Object.entries(raw) as [Platform, number][]) {
    shifted[p] = Math.max(0, v - Math.min(0, min));
  }

  const max = Math.max(...Object.values(shifted));
  if (max === 0) {
    const result: Record<Platform, number> = {} as any;
    for (const p of Object.keys(shifted) as Platform[]) result[p] = 0;
    return result;
  }

  const normalised: Record<Platform, number> = {} as any;
  for (const [p, v] of Object.entries(shifted) as [Platform, number][]) {
    normalised[p] = Math.round((v / max) * 100);
  }
  return normalised;
}

function buildRationale(
  winner: Platform,
  winnerScore: number,
  responses: Record<string, string>,
  reasons: Record<Platform, string[]>
): string {
  const answeredCount = Object.values(responses).filter((r) => r.trim().length > 0).length;
  const topReasons = (reasons[winner] ?? []).slice(0, 3);

  const parts: string[] = [
    `Based on ${answeredCount} assessment responses, ${PLATFORM_DISPLAY[winner]} achieved the highest platform suitability score (${winnerScore}/100).`,
  ];

  if (topReasons.length > 0) {
    const signalSummary = topReasons
      .map((r) => r.replace(/^[A-Z_\d]+ response signals /, "Assessment signal: ").replace(/\s*\([+-]\d+pts\)$/, ""))
      .join("; ");
    parts.push(`Key evidence: ${signalSummary}.`);
  } else {
    parts.push("No keyword signals were matched in responses — this recommendation is based on default scoring only and should be treated as indicative.");
  }

  return parts.join(" ");
}

export function generateRecommendation(assessmentId: number): RecommendationResult {
  const assessment = db
    .prepare(
      `SELECT business_context, business_goals, business_drivers, business_requirement
       FROM assessments WHERE id = ?`
    )
    .get(assessmentId) as { business_context: string; business_goals: string; business_drivers: string; business_requirement: string } | undefined;

  const rows = db
    .prepare(
      `SELECT q.question_key, r.response_text
       FROM responses r
       JOIN questions q ON r.question_id = q.id
       WHERE r.assessment_id = ?`
    )
    .all(assessmentId) as Array<{ question_key: string; response_text: string }>;

  const responses: Record<string, string> = {};
  for (const row of rows) {
    responses[row.question_key] = row.response_text;
  }

  const rawScores: Record<Platform, number> = {
    Salesforce: 0,
    ServiceNow: 0,
    MicrosoftPowerPlatform: 0,
    CustomBuild: 0,
  };
  const reasons: Record<Platform, string[]> = {
    Salesforce: [],
    ServiceNow: [],
    MicrosoftPowerPlatform: [],
    CustomBuild: [],
  };
  const scoringHits: ScoringHit[] = [];

  if (assessment) {
    const metadataFields = [
      { text: assessment.business_context, label: "Business Context" },
      { text: assessment.business_goals, label: "Business Goals" },
      { text: assessment.business_drivers, label: "Business Drivers" },
      { text: assessment.business_requirement, label: "Business Requirement" },
    ];

    for (const { text, label } of metadataFields) {
      if (text) {
        scoreResponse(`META_${label.replace(/\s+/g, "_")}`, text, rawScores, reasons, scoringHits);
      }
    }
  }

  for (const [questionKey, responseText] of Object.entries(responses)) {
    if (responseText) {
      scoreResponse(questionKey, responseText, rawScores, reasons, scoringHits);
    }
  }

  const normScores = normaliseScores(rawScores);

  const winner = (Object.entries(normScores) as [Platform, number][]).reduce(
    (best, [p, s]) => (s > best[1] ? [p, s] : best),
    ["Salesforce", 0] as [Platform, number]
  )[0];

  const winnerScore = normScores[winner];

  const platformScores: PlatformScore[] = (Object.entries(normScores) as [Platform, number][])
    .sort((a, b) => b[1] - a[1])
    .map(([platform, score]) => ({
      platform,
      score,
      reasons: reasons[platform] ?? [],
    }));

  return {
    platform: winner,
    displayName: PLATFORM_DISPLAY[winner],
    confidenceScore: winnerScore,
    rationale: buildRationale(winner, winnerScore, responses, reasons),
    risks: PLATFORM_RISKS[winner],
    alternatives: PLATFORM_ALTERNATIVES[winner],
    platformScores,
    scoringHits,
  };
}

export function saveRecommendation(assessmentId: number, result: RecommendationResult): void {
  const now = new Date().toISOString();

  const existing = db
    .prepare(
      `SELECT architect_approval, architect_approval_reason, architect_approval_recorded_at
       FROM recommendations
       WHERE assessment_id = ?`
    )
    .get(assessmentId) as
    | {
        architect_approval: string | null;
        architect_approval_reason: string | null;
        architect_approval_recorded_at: string | null;
      }
    | undefined;

  db.prepare(`DELETE FROM recommendations WHERE assessment_id = ?`).run(assessmentId);

  db.prepare(`
    INSERT INTO recommendations (assessment_id, platform_recommendation, rationale, confidence_score, risks, alternatives, architect_approval, architect_approval_reason, architect_approval_recorded_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    assessmentId,
    result.displayName,
    result.rationale,
    result.confidenceScore,
    result.risks,
    result.alternatives,
    existing?.architect_approval ?? null,
    existing?.architect_approval_reason ?? null,
    existing?.architect_approval_recorded_at ?? null,
    now
  );

  db.prepare(`
    UPDATE assessments SET status = 'completed', completed_at = ?, updated_at = ? WHERE id = ?
  `).run(now, now, assessmentId);
}