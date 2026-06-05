import db from "@/lib/db/db";

// ─── Platform types ────────────────────────────────────────────────────────────

export type Platform = "Salesforce" | "ServiceNow" | "MicrosoftPowerPlatform" | "CustomBuild";

export interface PlatformScore {
  platform: Platform;
  score: number; // 0-100
  reasons: string[];
}

export interface RecommendationResult {
  platform: Platform;
  displayName: string;
  confidenceScore: number;
  rationale: string;
  risks: string;
  alternatives: string;
  platformScores: PlatformScore[];
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
      keywords: ["not primary", "minimal", "pro developer"],
      scores: { Salesforce: 3, ServiceNow: 4 },
    },
  ],
  PLAT_INT_001: [
    {
      keywords: ["deep integration", "empi", "enterprise", "registry", "finance", "bi-directional"],
      scores: { Salesforce: 9, ServiceNow: 6, MicrosoftPowerPlatform: 4 },
    },
    {
      keywords: ["minimal integration", "simple", "few systems"],
      scores: { MicrosoftPowerPlatform: 6, ServiceNow: 5, Salesforce: 3 },
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
};

// ─── Platform display metadata ───────────────────────────────────────────────

const PLATFORM_DISPLAY: Record<Platform, string> = {
  Salesforce: "Salesforce (CRM + Case Management)",
  ServiceNow: "ServiceNow (ITSM + Workflow)",
  MicrosoftPowerPlatform: "Microsoft Power Platform + Dynamics 365",
  CustomBuild: "Custom Build",
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
    "ServiceNow for ITSM-heavy workloads; Microsoft Power Platform + Dynamics 365 for lower cost; Custom build for unique capability gaps",
  ServiceNow:
    "Salesforce for CRM/case-centric use cases; Microsoft Dynamics 365 for lighter workflow needs",
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
  reasons: Record<Platform, string[]>
): void {
  const rules = SCORING_RULES[questionKey];
  if (!rules) return;

  const lowerResponse = responseText.toLowerCase();

  for (const rule of rules) {
    const matched = rule.keywords.some((kw) => lowerResponse.includes(kw));
    if (matched) {
      for (const [platform, points] of Object.entries(rule.scores) as [Platform, number][]) {
        scores[platform] = (scores[platform] ?? 0) + points;
        if (points > 0) {
          reasons[platform] = reasons[platform] ?? [];
          reasons[platform].push(
            `${questionKey} response signals "${rule.keywords[0]}" (${points > 0 ? "+" : ""}${points}pts)`
          );
        }
      }
    }
  }
}

function normaliseScores(raw: Record<Platform, number>): Record<Platform, number> {
  const min = Math.min(...Object.values(raw));
  // Shift everything so minimum is 0 (no negative totals)
  const shifted: Record<Platform, number> = {} as any;
  for (const [p, v] of Object.entries(raw) as [Platform, number][]) {
    shifted[p] = Math.max(0, v - Math.min(0, min));
  }

  const max = Math.max(...Object.values(shifted));
  if (max === 0) {
    // No signals — return equal scores
    const platforms = Object.keys(shifted) as Platform[];
    const equal = Math.round(100 / platforms.length);
    const result: Record<Platform, number> = {} as any;
    for (const p of platforms) result[p] = equal;
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
  const topReasons = (reasons[winner] ?? []).slice(0, 5);

  const crm = responses["PLAT_CRM_001"] ?? "";
  const integration = responses["PLAT_INT_001"] ?? "";
  const cloud = responses["CLOUD_SAAS_001"] ?? "";

  const parts: string[] = [
    `Based on analysis of ${Object.keys(responses).length} assessment responses, ${PLATFORM_DISPLAY[winner]} is the recommended platform (confidence: ${winnerScore}%).`,
  ];

  if (crm) parts.push(`Use-case fit: "${crm.substring(0, 120)}${crm.length > 120 ? "..." : ""}"`);
  if (integration) parts.push(`Integration need: "${integration.substring(0, 120)}${integration.length > 120 ? "..." : ""}"`);
  if (cloud) parts.push(`Cloud suitability: "${cloud.substring(0, 120)}${cloud.length > 120 ? "..." : ""}"`);

  if (topReasons.length > 0) {
    parts.push(`Key scoring signals: ${topReasons.join("; ")}.`);
  }

  return parts.join(" ");
}

// ─── Main exported function ───────────────────────────────────────────────────

export function generateRecommendation(assessmentId: number): RecommendationResult {
  // Fetch all responses for this assessment
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

  // Initialise raw scores for each platform
  const platforms: Platform[] = ["Salesforce", "ServiceNow", "MicrosoftPowerPlatform", "CustomBuild"];
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

  // Score every response
  for (const [questionKey, responseText] of Object.entries(responses)) {
    if (responseText) {
      scoreResponse(questionKey, responseText, rawScores, reasons);
    }
  }

  // Normalise to 0-100
  const normScores = normaliseScores(rawScores);

  // Find the winner
  const winner = (Object.entries(normScores) as [Platform, number][]).reduce(
    (best, [p, s]) => (s > best[1] ? [p, s] : best),
    ["Salesforce", 0] as [Platform, number]
  )[0];

  const winnerScore = normScores[winner];

  // Build sorted platform scores for display
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
  };
}

// ─── Persist recommendation to DB ────────────────────────────────────────────

export function saveRecommendation(assessmentId: number, result: RecommendationResult): void {
  const now = new Date().toISOString();

  // Upsert — delete existing and re-insert so we always have latest
  db.prepare(`DELETE FROM recommendations WHERE assessment_id = ?`).run(assessmentId);

  db.prepare(`
    INSERT INTO recommendations (assessment_id, platform_recommendation, rationale, confidence_score, risks, alternatives, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    assessmentId,
    result.displayName,
    result.rationale,
    result.confidenceScore,
    result.risks,
    result.alternatives,
    now
  );

  // Mark assessment as completed
  db.prepare(`
    UPDATE assessments SET status = 'completed', completed_at = ?, updated_at = ? WHERE id = ?
  `).run(now, now, assessmentId);
}
