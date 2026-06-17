import { RecommendationResult } from "@/lib/deterministic/engine";

export function detectInstitutionalConfidenceConflictingIndicators(result: RecommendationResult): string[] {
  const conflicts: string[] = [];
  const scores = result.platformScores;
  if (scores.length >= 2) {
    const diff = scores[0].score - scores[1].score;
    if (diff < 10) {
      conflicts.push(`Top two platforms are within ${diff} points - recommendation is competitive, not decisive`);
    }
  }
  if (result.confidenceScore < 50) {
    conflicts.push("Overall confidence is below 50% - insufficient responses to draw a reliable conclusion");
  }
  return conflicts;
}

export function buildInstitutionalKnowledgeCoverage(
  historicalMatches: number,
  rulesMatched: number,
  completeness: number
): { level: "High" | "Medium" | "Low"; explanation: string; factors: string[] } {
  const factors: string[] = [];
  let score = 0;

  if (historicalMatches >= 2) {
    score += 3;
    factors.push(`${historicalMatches} similar historical assessments available for comparison`);
  } else if (historicalMatches === 1) {
    score += 1;
    factors.push("Only 1 historical assessment available - limited historical precedent");
  } else {
    factors.push("No similar historical assessments found - recommendation cannot draw on institutional precedent");
  }

  if (rulesMatched >= 10) {
    score += 3;
    factors.push(`${rulesMatched} assessment signals matched - strong evidence base`);
  } else if (rulesMatched >= 5) {
    score += 2;
    factors.push(`${rulesMatched} assessment signals matched - moderate evidence base`);
  } else {
    factors.push(`Only ${rulesMatched} assessment signals matched - limited scoring evidence`);
  }

  if (completeness >= 80) {
    score += 2;
    factors.push(`${completeness}% of questions answered - comprehensive assessment`);
  } else if (completeness >= 50) {
    score += 1;
    factors.push(`${completeness}% of questions answered - partial assessment`);
  } else {
    factors.push(`Only ${completeness}% of questions answered - assessment is incomplete`);
  }

  const level: "High" | "Medium" | "Low" = score >= 6 ? "High" : score >= 3 ? "Medium" : "Low";
  const explanation =
    level === "High"
      ? "Strong evidence context. Deterministic platform selection is supported by comprehensive responses and rich historical precedent context."
      : level === "Medium"
      ? "Moderate evidence context. Deterministic platform selection remains primary, with partial response coverage or limited historical precedent context."
      : "Limited evidence context. Deterministic platform selection remains primary, but limited responses or sparse precedent context reduce confidence.";

  return { level, explanation, factors };
}

export function buildInstitutionalKnowledgeConfidence(
  result: RecommendationResult,
  rulesMatched: number,
  completeness: number
): { score: number; label: string; basis: string; factors: string[] } {
  const factors: string[] = [];
  let adjustedConfidence = result.confidenceScore;

  if (completeness < 50) {
    adjustedConfidence = Math.min(adjustedConfidence, 40);
    factors.push(`Capped at 40% - only ${completeness}% of assessment questions answered`);
  } else if (completeness < 80) {
    adjustedConfidence = Math.min(adjustedConfidence, 65);
    factors.push(`Capped at 65% - ${completeness}% of questions answered (target: 80%+)`);
  } else {
    factors.push(`${completeness}% question coverage supports full confidence range`);
  }

  if (rulesMatched === 0) {
    adjustedConfidence = Math.min(adjustedConfidence, 20);
    factors.push("Capped at 20% - no assessment signals matched in responses");
  } else if (rulesMatched < 3) {
    adjustedConfidence = Math.min(adjustedConfidence, 45);
    factors.push(`Reduced - only ${rulesMatched} scoring signal(s) matched`);
  } else {
    factors.push(`${rulesMatched} scoring signals matched - adequate evidence base`);
  }

  const conflictingIndicators = detectInstitutionalConfidenceConflictingIndicators(result);
  if (conflictingIndicators.length > 0) {
    adjustedConfidence = Math.max(0, adjustedConfidence - 10);
    factors.push("Reduced by 10% due to conflicting or competitive platform indicators");
  }

  const label = adjustedConfidence >= 75 ? "High" : adjustedConfidence >= 50 ? "Medium" : "Low";
  const basis =
    "Institutional confidence reflects deterministic evidence quality only: response completeness, matched rule signals, and score separation. Historical precedents and AI narrative are non-decisional context.";

  return { score: Math.round(adjustedConfidence), label, basis, factors };
}
