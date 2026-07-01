import db from "@/lib/db/db";
import { EAAF_RULES, formatRuleTemplate, Platform } from "@/lib/deterministic/rules";

export type { Platform };

export interface PlatformScore {
  platform: Platform;
  score: number;
  reasons: string[];
}

export interface ScoringHit {
  questionKey: string;
  responseSnippet: string;
  keywordMatched: string;
  platformPoints: Partial<Record<Platform, number>>;
  concept?: string;
  description?: string;
  ruleWhyItMatters?: string;
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
  rulesApplied: Array<{
    questionKey: string;
    keywordMatched: string;
    impacts: Partial<Record<Platform, number>>;
  }>;
}

interface Signal {
  keywords: string[];
  scores: Partial<Record<Platform, number>>;
  concept?: string;
  description?: string;
  whyItMatters?: string;
}

const SCORING_RULES = EAAF_RULES.platformRules.scoringRules as Record<string, Signal[]>;

export const PLATFORM_DISPLAY: Record<Platform, string> = EAAF_RULES.platformRules.platformDisplay;
export const PLATFORM_STRENGTHS: Record<Platform, string[]> = EAAF_RULES.platformRules.platformStrengths;
export const PLATFORM_WEAKNESSES: Record<Platform, string[]> = EAAF_RULES.platformRules.platformWeaknesses;

const PLATFORM_RISKS: Record<Platform, string> = EAAF_RULES.platformRules.platformRisks;
const PLATFORM_ALTERNATIVES: Record<Platform, string> = EAAF_RULES.platformRules.platformAlternatives;

function scoreResponse(
  questionKey: string,
  responseText: string,
  scores: Record<Platform, number>,
  reasons: Record<Platform, string[]>,
  hits: ScoringHit[],
  rulesApplied: RecommendationResult["rulesApplied"]
): void {
  const rules = SCORING_RULES[questionKey];
  if (!rules) return;

  const lowerResponse = responseText.toLowerCase();

  for (const rule of rules) {
    const matchedKw = rule.keywords.find((kw) => lowerResponse.includes(kw));
    if (!matchedKw) continue;

    const positivePoints: Partial<Record<Platform, number>> = {};
    const ruleImpacts: Partial<Record<Platform, number>> = {};

    for (const [platform, points] of Object.entries(rule.scores) as [Platform, number][]) {
      scores[platform] = (scores[platform] ?? 0) + points;
      ruleImpacts[platform] = points;
      if (points > 0) {
        positivePoints[platform] = points;
        reasons[platform] = reasons[platform] ?? [];
        // Use the architectural concept name — never expose matched keywords in the rationale
        reasons[platform].push(rule.concept ?? questionKey);
      }
    }

    rulesApplied.push({ questionKey, keywordMatched: matchedKw, impacts: ruleImpacts });

    if (Object.keys(positivePoints).length > 0) {
      hits.push({
        questionKey,
        responseSnippet: responseText.substring(0, 120) + (responseText.length > 120 ? "..." : ""),
        keywordMatched: matchedKw,
        platformPoints: positivePoints,
        concept: rule.concept,
        description: rule.description,
        ruleWhyItMatters: rule.whyItMatters,
      });
    }
  }
}

function normaliseScores(raw: Record<Platform, number>): Record<Platform, number> {
  const min = Math.min(...Object.values(raw));
  const shifted: Record<Platform, number> = {} as Record<Platform, number>;
  for (const [p, v] of Object.entries(raw) as [Platform, number][]) {
    shifted[p] = Math.max(0, v - Math.min(0, min));
  }

  const max = Math.max(...Object.values(shifted));
  if (max === 0) {
    const result: Record<Platform, number> = {} as Record<Platform, number>;
    for (const p of Object.keys(shifted) as Platform[]) result[p] = 0;
    return result;
  }

  const normalised: Record<Platform, number> = {} as Record<Platform, number>;
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
  // Deduplicate concept names and take up to 3
  const topConcepts = [...new Set(reasons[winner] ?? [])].slice(0, 3);
  const templates = EAAF_RULES.platformRules.rationaleTemplates;

  const parts: string[] = [
    formatRuleTemplate(templates.intro, {
      answeredCount,
      winnerDisplay: PLATFORM_DISPLAY[winner],
      winnerScore,
    }),
  ];

  if (topConcepts.length > 0) {
    parts.push(formatRuleTemplate(templates.keyEvidencePrefix, { signalSummary: topConcepts.join("; ") }));
  } else {
    parts.push(templates.noSignals);
  }

  return parts.join(" ");
}

export function generateRecommendation(assessmentId: number): RecommendationResult {
  const assessment = db
    .prepare(
      `SELECT business_context, business_goals, business_drivers, business_requirement
       FROM assessments WHERE id = ?`
    )
    .get(assessmentId) as
    | { business_context: string; business_goals: string; business_drivers: string; business_requirement: string }
    | undefined;

  const rows = db
    .prepare(
      `SELECT q.question_key, r.response_text
       FROM responses r
       JOIN questions q ON r.question_id = q.id
       WHERE r.assessment_id = ?`
    )
    .all(assessmentId) as Array<{ question_key: string; response_text: string }>;

  const responses: Record<string, string> = {};
  for (const row of rows) responses[row.question_key] = row.response_text;

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
  const rulesApplied: RecommendationResult["rulesApplied"] = [];

  if (assessment) {
    const metadataFields = [
      { text: assessment.business_context, label: "Business Context" },
      { text: assessment.business_goals, label: "Business Goals" },
      { text: assessment.business_drivers, label: "Business Drivers" },
      { text: assessment.business_requirement, label: "Business Requirement" },
    ];

    for (const { text, label } of metadataFields) {
      if (text) scoreResponse(`META_${label.replace(/\s+/g, "_")}`, text, rawScores, reasons, scoringHits, rulesApplied);
    }
  }

  for (const [questionKey, responseText] of Object.entries(responses)) {
    if (responseText) scoreResponse(questionKey, responseText, rawScores, reasons, scoringHits, rulesApplied);
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
    rulesApplied,
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
    UPDATE assessments SET updated_at = ? WHERE id = ?
  `).run(now, assessmentId);
}
