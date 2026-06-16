import { PLATFORM_PROFILES } from "@/lib/deterministic/insufficient-signal-low-signal-report";
import { RecommendationResult } from "@/lib/deterministic/engine";

export interface AssembledRecommendation {
  summary: string;
  platformAnalysis: string;
  nextSteps: string;
  disclaimer: string;
}

/**
 * Assemble a complete recommendation document using all assessment data.
 * Called at the final step after all findings are complete.
 * Deterministic-only implementation. No LLM inference occurs in this module.
 */
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
  const similarContext =
    similarAssessments && similarAssessments.length > 0
      ? similarAssessments.map((s) => `${s.name} (${Math.round(s.similarity)}% similar)`).join(", ")
      : null;

  const platformProfile = PLATFORM_PROFILES.find((p) => p.platform === recommendation.platform);

  return {
    summary: `This Enterprise Architecture Assessment evaluated ${assessmentName} against BC Government platform standards. The recommended platform is ${recommendation.displayName}, which aligns best with stated business requirements and organizational readiness. Confidence: ${recommendation.confidenceScore}%.${similarContext ? ` Similar historical assessments: ${similarContext}.` : ""}`,
    platformAnalysis: platformProfile
      ? `${recommendation.displayName} is recommended because: ${recommendation.rationale} Best fit for: ${platformProfile.bestFitFor}.`
      : recommendation.rationale,
    nextSteps: `Next Steps:\n• Complete business case development with Finance\n• Initiate vendor engagement and licensing negotiations\n• Begin detailed implementation planning with relevant teams`,
    disclaimer:
      "This assessment provides a governance-ready platform recommendation based on deterministic scoring rules, historical assessment comparison, and BC Government platform standards. All recommendations should be validated by the architecture team before procurement.",
  };
}
