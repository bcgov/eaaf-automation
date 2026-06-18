import { EAAF_RULES } from "@/lib/deterministic/rules";

export interface SimilarityConfidenceAssessmentContext {
  name: string;
  platform: string;
  similarityScore: number;
  similarityMethod: string;
  businessContext: string;
  businessGoal: string;
}

export function buildSimilarityHistoricalAlignment(
  similarAssessments: SimilarityConfidenceAssessmentContext[]
): {
  matchCount: number;
  nearestMatchScore: number | null;
  lowestMatchScore: number | null;
  retrievalMethod: string;
  nonDecisionalNote: string;
} {
  const cfg = EAAF_RULES.confidence.similarity.historicalAlignment;
  if (similarAssessments.length === 0) {
    return {
      matchCount: 0,
      nearestMatchScore: null,
      lowestMatchScore: null,
      retrievalMethod: cfg.retrievalMethod,
      nonDecisionalNote: cfg.noHistoricalNote,
    };
  }

  const sorted = [...similarAssessments].sort((a, b) => b.similarityScore - a.similarityScore);
  return {
    matchCount: sorted.length,
    nearestMatchScore: sorted[0].similarityScore,
    lowestMatchScore: sorted[sorted.length - 1].similarityScore,
    retrievalMethod: cfg.retrievalMethod,
    nonDecisionalNote: cfg.nonDecisionalNote,
  };
}

export function buildSimilarityAdvisoryConfidence(
  historicalMatches: number,
  completeness: number,
  businessContext: string
): {
  score: number;
  label: string;
  basis: string;
  factors: string[];
} {
  const cfg = EAAF_RULES.confidence.similarity.advisoryConfidence;
  const factors: string[] = [];
  let score = cfg.base;

  if (businessContext && businessContext.length > cfg.businessContext.richLen) {
    score += cfg.businessContext.richDelta;
    factors.push("Rich business context provided - AI advisory has strong context for analysis");
  } else if (businessContext && businessContext.length > cfg.businessContext.basicLen) {
    score += cfg.businessContext.basicDelta;
    factors.push("Basic business context provided");
  } else {
    score += cfg.businessContext.lowDelta;
    factors.push("Limited business context - AI advisory is based primarily on response patterns");
  }

  if (historicalMatches >= 2) {
    score += cfg.historicalMatches.twoPlusDelta;
    factors.push(`${historicalMatches} similar assessments available for pattern comparison`);
  } else if (historicalMatches === 1) {
    score += cfg.historicalMatches.oneDelta;
    factors.push("1 historical assessment available for pattern reference");
  } else {
    score += cfg.historicalMatches.noneDelta;
    factors.push("No similar historical assessments - AI advisory cannot draw on precedent");
  }

  if (completeness >= cfg.completeness.highAtLeast) {
    score += cfg.completeness.highDelta;
    factors.push("High assessment completeness provides strong response context for AI analysis");
  } else if (completeness < cfg.completeness.lowBelow) {
    score += cfg.completeness.lowDelta;
    factors.push(`Low completeness (${completeness}%) limits the quality of AI analysis`);
  }

  score = Math.max(cfg.clamp.min, Math.min(cfg.clamp.max, score));
  const label = score >= cfg.labels.highAtLeast ? "High" : score >= cfg.labels.mediumAtLeast ? "Medium" : "Low";

  return { score, label, basis: cfg.basis, factors };
}
