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
    "Similarity advisory confidence reflects the quality and completeness of available context, historical assessment similarity, and response coverage available to the advisory layer. It does not represent the reliability of the platform recommendation itself.";

  return { score, label, basis, factors };
}
