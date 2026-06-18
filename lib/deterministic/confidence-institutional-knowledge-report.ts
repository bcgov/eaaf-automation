import { RecommendationResult } from "@/lib/deterministic/engine";
import { EAAF_RULES, formatRuleTemplate } from "@/lib/deterministic/rules";

export function detectInstitutionalConfidenceConflictingIndicators(result: RecommendationResult): string[] {
  const cfg = EAAF_RULES.confidence.institutional;
  const conflicts: string[] = [];
  const scores = result.platformScores;

  if (scores.length >= 2) {
    const diff = scores[0].score - scores[1].score;
    if (diff < cfg.conflictTopDiffThreshold) {
      conflicts.push(formatRuleTemplate(cfg.conflictMessages.topDiff, { diff }));
    }
  }

  if (result.confidenceScore < cfg.lowOverallThreshold) {
    conflicts.push(cfg.conflictMessages.lowOverall);
  }

  return conflicts;
}

export function buildInstitutionalKnowledgeCoverage(
  historicalMatches: number,
  rulesMatched: number,
  completeness: number
): { level: "High" | "Medium" | "Low"; explanation: string; factors: string[] } {
  const cfg = EAAF_RULES.confidence.institutional.coverageScoring;
  const factors: string[] = [];
  let score = 0;

  if (historicalMatches >= cfg.historicalMatches.highAtLeast) {
    score += cfg.historicalMatches.highPoints;
    factors.push(`${historicalMatches} similar historical assessments available for comparison`);
  } else if (historicalMatches === cfg.historicalMatches.oneValue) {
    score += cfg.historicalMatches.onePoints;
    factors.push("Only 1 historical assessment available - limited historical precedent");
  } else {
    factors.push("No similar historical assessments found - recommendation cannot draw on institutional precedent");
  }

  if (rulesMatched >= cfg.rulesMatched.highAtLeast) {
    score += cfg.rulesMatched.highPoints;
    factors.push(`${rulesMatched} assessment signals matched - strong evidence base`);
  } else if (rulesMatched >= cfg.rulesMatched.mediumAtLeast) {
    score += cfg.rulesMatched.mediumPoints;
    factors.push(`${rulesMatched} assessment signals matched - moderate evidence base`);
  } else {
    factors.push(`Only ${rulesMatched} assessment signals matched - limited scoring evidence`);
  }

  if (completeness >= cfg.completeness.highAtLeast) {
    score += cfg.completeness.highPoints;
    factors.push(`${completeness}% of questions answered - comprehensive assessment`);
  } else if (completeness >= cfg.completeness.mediumAtLeast) {
    score += cfg.completeness.mediumPoints;
    factors.push(`${completeness}% of questions answered - partial assessment`);
  } else {
    factors.push(`Only ${completeness}% of questions answered - assessment is incomplete`);
  }

  const level: "High" | "Medium" | "Low" =
    score >= cfg.levelThresholds.highAtLeast ? "High" : score >= cfg.levelThresholds.mediumAtLeast ? "Medium" : "Low";

  const explanation =
    level === "High" ? cfg.explanations.high : level === "Medium" ? cfg.explanations.medium : cfg.explanations.low;

  return { level, explanation, factors };
}

export function buildInstitutionalKnowledgeConfidence(
  result: RecommendationResult,
  rulesMatched: number,
  completeness: number
): { score: number; label: string; basis: string; factors: string[] } {
  const cfg = EAAF_RULES.confidence.institutional.confidenceScoring;
  const factors: string[] = [];
  let adjustedConfidence = result.confidenceScore;

  if (completeness < 50) {
    adjustedConfidence = Math.min(adjustedConfidence, cfg.completenessCaps.below50);
    factors.push(`Capped at ${cfg.completenessCaps.below50}% - only ${completeness}% of assessment questions answered`);
  } else if (completeness < 80) {
    adjustedConfidence = Math.min(adjustedConfidence, cfg.completenessCaps.below80);
    factors.push(`Capped at ${cfg.completenessCaps.below80}% - ${completeness}% of questions answered (target: 80%+)`);
  } else {
    factors.push(`${completeness}% question coverage supports full confidence range`);
  }

  if (rulesMatched === 0) {
    adjustedConfidence = Math.min(adjustedConfidence, cfg.rulesCaps.none);
    factors.push("Capped at 20% - no assessment signals matched in responses");
  } else if (rulesMatched < 3) {
    adjustedConfidence = Math.min(adjustedConfidence, cfg.rulesCaps.below3);
    factors.push(`Reduced - only ${rulesMatched} scoring signal(s) matched`);
  } else {
    factors.push(`${rulesMatched} scoring signals matched - adequate evidence base`);
  }

  const conflictingIndicators = detectInstitutionalConfidenceConflictingIndicators(result);
  if (conflictingIndicators.length > 0) {
    adjustedConfidence = Math.max(0, adjustedConfidence - cfg.conflictPenalty);
    factors.push(`Reduced by ${cfg.conflictPenalty}% due to conflicting or competitive platform indicators`);
  }

  const label =
    adjustedConfidence >= cfg.labels.highAtLeast ? "High" : adjustedConfidence >= cfg.labels.mediumAtLeast ? "Medium" : "Low";

  return { score: Math.round(adjustedConfidence), label, basis: cfg.basis, factors };
}
