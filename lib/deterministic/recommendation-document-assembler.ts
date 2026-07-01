import { INSTITUTIONAL_KNOWLEDGE_PLATFORM_PROFILES } from "@/lib/deterministic/institutional-knowledge-low-signal-report";
import { RecommendationResult } from "@/lib/deterministic/engine";
import { EAAF_RULES, formatRuleTemplate } from "@/lib/deterministic/rules";

export interface AssembledRecommendation {
  summary: string;
  platformAnalysis: string;
  nextSteps: string;
  disclaimer: string;
}

export async function assembleRecommendationDocument(
  assessmentName: string,
  businessContext: string,
  businessGoal: string,
  businessDriver: string,
  businessRequirement: string,
  stepFindings: Array<{ stepName: string; finding: string }>,
  platformScores: any[],
  recommendation: RecommendationResult,
  similarAssessments?: Array<{ name: string; similarity: number }>
): Promise<AssembledRecommendation> {
  const t = EAAF_RULES.recommendationTemplate;

  const similarContext =
    similarAssessments && similarAssessments.length > 0
      ? similarAssessments.map((s) => `${s.name} (${Math.round(s.similarity)}% similar)`).join(", ")
      : null;

  const platformProfile = INSTITUTIONAL_KNOWLEDGE_PLATFORM_PROFILES.find((p) => p.platform === recommendation.platform);

  const summary = formatRuleTemplate(t.summary, {
    assessmentName,
    displayName: recommendation.displayName,
    confidenceScore: recommendation.confidenceScore,
    similarContextSuffix: similarContext ? ` Similar historical assessments: ${similarContext}.` : "",
  });

  const platformAnalysis = platformProfile
    ? formatRuleTemplate(t.platformAnalysisWithBestFit, {
        displayName: recommendation.displayName,
        rationale: recommendation.rationale,
        bestFitFor: platformProfile.bestFitFor,
      })
    : formatRuleTemplate(t.platformAnalysisFallback, {
        rationale: recommendation.rationale,
      });

  return {
    summary,
    platformAnalysis,
    nextSteps: t.nextSteps,
    disclaimer: t.disclaimer,
  };
}
