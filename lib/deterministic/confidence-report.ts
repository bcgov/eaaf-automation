import { generateRecommendation } from "@/lib/deterministic/engine";

type RecommendationResult = ReturnType<typeof generateRecommendation>;

export interface SimilarAssessmentContext {
  name: string;
  platform: string;
  similarityScore: number;
  similarityMethod: string;
  businessContext: string;
  businessGoal: string;
}

export function detectConflictingIndicators(result: RecommendationResult): string[] {
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

export function buildKnowledgeCoverage(
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

export function buildInstitutionalConfidence(
  result: RecommendationResult,
  rulesMatched: number,
  completeness: number
): { score: number; label: string; basis: string; factors: string[] } {
  const factors: string[] = [];
  let adj = result.confidenceScore;

  if (completeness < 50) {
    adj = Math.min(adj, 40);
    factors.push(`Capped at 40% - only ${completeness}% of assessment questions answered`);
  } else if (completeness < 80) {
    adj = Math.min(adj, 65);
    factors.push(`Capped at 65% - ${completeness}% of questions answered (target: 80%+)`);
  } else {
    factors.push(`${completeness}% question coverage supports full confidence range`);
  }

  if (rulesMatched === 0) {
    adj = Math.min(adj, 20);
    factors.push("Capped at 20% - no assessment signals matched in responses");
  } else if (rulesMatched < 3) {
    adj = Math.min(adj, 45);
    factors.push(`Reduced - only ${rulesMatched} scoring signal(s) matched`);
  } else {
    factors.push(`${rulesMatched} scoring signals matched - adequate evidence base`);
  }

  const conflicting = detectConflictingIndicators(result);
  if (conflicting.length > 0) {
    adj = Math.max(0, adj - 10);
    factors.push("Reduced by 10% due to conflicting or competitive platform indicators");
  }

  const label = adj >= 75 ? "High" : adj >= 50 ? "Medium" : "Low";
  const basis =
    "Institutional confidence reflects deterministic evidence quality only: response completeness, matched rule signals, and score separation. Historical precedents and AI narrative are non-decisional context.";

  return { score: Math.round(adj), label, basis, factors };
}

export function buildHistoricalAlignment(
  similarAssessments: SimilarAssessmentContext[]
): {
  matchCount: number;
  nearestMatchScore: number | null;
  lowestMatchScore: number | null;
  retrievalMethod: string;
  nonDecisionalNote: string;
} {
  if (similarAssessments.length === 0) {
    return {
      matchCount: 0,
      nearestMatchScore: null,
      lowestMatchScore: null,
      retrievalMethod: "embedding-cosine-similarity",
      nonDecisionalNote: "No historical precedents were retrieved. This does not affect deterministic platform selection.",
    };
  }

  const sorted = [...similarAssessments].sort((a, b) => b.similarityScore - a.similarityScore);
  return {
    matchCount: sorted.length,
    nearestMatchScore: sorted[0].similarityScore,
    lowestMatchScore: sorted[sorted.length - 1].similarityScore,
    retrievalMethod: "embedding-cosine-similarity",
    nonDecisionalNote: "Historical precedents are retrieval-only context and do not contribute to platform selection.",
  };
}

export function buildAiConfidence(
  historicalMatches: number,
  completeness: number,
  businessContext: string
): {
  score: number;
  label: string;
  basis: string;
  factors: string[];
} {
  const factors: string[] = [];
  let score = 50;

  if (businessContext && businessContext.length > 100) {
    score += 15;
    factors.push("Rich business context provided - AI advisory has strong context for analysis");
  } else if (businessContext && businessContext.length > 20) {
    score += 5;
    factors.push("Basic business context provided");
  } else {
    score -= 10;
    factors.push("Limited business context - AI advisory is based primarily on response patterns");
  }

  if (historicalMatches >= 2) {
    score += 15;
    factors.push(`${historicalMatches} similar assessments available for pattern comparison`);
  } else if (historicalMatches === 1) {
    score += 5;
    factors.push("1 historical assessment available for pattern reference");
  } else {
    score -= 15;
    factors.push("No similar historical assessments - AI advisory cannot draw on precedent");
  }

  if (completeness >= 80) {
    score += 10;
    factors.push("High assessment completeness provides strong response context for AI analysis");
  } else if (completeness < 50) {
    score -= 15;
    factors.push(`Low completeness (${completeness}%) limits the quality of AI analysis`);
  }

  score = Math.max(10, Math.min(90, score));
  const label = score >= 75 ? "High" : score >= 50 ? "Medium" : "Low";
  const basis =
    "AI advisory confidence reflects the quality and completeness of available context, historical assessment similarity, and response coverage available to the AI model. It does not represent the reliability of the platform recommendation itself.";

  return { score, label, basis, factors };
}