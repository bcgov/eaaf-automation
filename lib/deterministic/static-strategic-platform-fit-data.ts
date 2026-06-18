import { Platform } from "@/lib/deterministic/engine";
import { EAAF_RULES } from "@/lib/deterministic/rules";

export interface PlatformFitAssessment {
  platform: Platform;
  organizationalReadiness: number;
  readinessSummary: string;
  estimatedTimelineMonths: number;
  timelineRisks: string[];
  estimatedTotalCostUSD: string;
  costExplanation: string;
  teamCapabilityGap: "Low" | "Medium" | "High";
  teamCapabilityNarrative: string;
  governanceRiskLevel: "Low" | "Medium" | "High";
  governanceRiskExplanation: string;
  strategicAlignment: string;
}

export interface StrategicPlatformFitAssessment {
  platformEvaluations: Partial<Record<Platform, PlatformFitAssessment>>;
  recommendedPlatform: Platform;
  recommendationBasis: string;
  strategicConsiderations: string[];
  riskWarnings: string[];
  opportunityWindows: string[];
}

function containsAny(text: string, terms: string[]): boolean {
  const lower = text.toLowerCase();
  return terms.some((t) => lower.includes(t.toLowerCase()));
}

export function generateStrategicPlatformFitData(
  businessRequirement: string,
  deterministicRecommendation: Platform
): StrategicPlatformFitAssessment {
  const cfg = EAAF_RULES.platformGuidance;
  const isLightweight = containsAny(businessRequirement || "", cfg.keywordHeuristics.lightweight);
  const isInternal = containsAny(businessRequirement || "", cfg.keywordHeuristics.internal);
  const isComplexWorkflow = containsAny(businessRequirement || "", cfg.keywordHeuristics.complexWorkflow);
  const isSmallOrg = containsAny(businessRequirement || "", cfg.keywordHeuristics.smallOrg);

  const assessments = Object.entries(cfg.platformAssessments).reduce((acc, [platform, p]) => {
    const useLight = isLightweight;
    acc[platform as Platform] = {
      platform: platform as Platform,
      organizationalReadiness: useLight ? p.organizationalReadiness.lightweight : p.organizationalReadiness.default,
      readinessSummary: useLight ? p.readinessSummary.lightweight : p.readinessSummary.default,
      estimatedTimelineMonths: useLight ? p.estimatedTimelineMonths.lightweight : p.estimatedTimelineMonths.default,
      timelineRisks: p.timelineRisks.map((r) => (useLight ? r.lightweight : r.default)),
      estimatedTotalCostUSD: p.estimatedTotalCostUSD,
      costExplanation: p.costExplanation,
      teamCapabilityGap: useLight ? p.teamCapabilityGap.lightweight : p.teamCapabilityGap.default,
      teamCapabilityNarrative: useLight ? p.teamCapabilityNarrative.lightweight : p.teamCapabilityNarrative.default,
      governanceRiskLevel: useLight ? p.governanceRiskLevel.lightweight : p.governanceRiskLevel.default,
      governanceRiskExplanation: useLight ? p.governanceRiskExplanation.lightweight : p.governanceRiskExplanation.default,
      strategicAlignment: p.strategicAlignment,
    };
    return acc;
  }, {} as Record<Platform, PlatformFitAssessment>);

  let recommendedPlatform: Platform = deterministicRecommendation;
  let recommendationBasis = cfg.recommendationBasis.fallback;

  if ((isLightweight || isSmallOrg || isInternal) && !isComplexWorkflow) {
    recommendedPlatform = "MicrosoftPowerPlatform";
    recommendationBasis = cfg.recommendationBasis.lightweightOrSmallOrInternal;
  } else if (isComplexWorkflow && !isLightweight) {
    recommendedPlatform = "Salesforce";
    recommendationBasis = cfg.recommendationBasis.complexWorkflow;
  } else {
    const fallback = assessments[deterministicRecommendation];
    recommendationBasis = fallback?.readinessSummary || cfg.recommendationBasis.fallback;
  }

  return {
    platformEvaluations: assessments,
    recommendedPlatform,
    recommendationBasis,
    strategicConsiderations: cfg.strategicConsiderations,
    riskWarnings: [isLightweight ? cfg.riskWarnings.lightweight : cfg.riskWarnings.default, ...cfg.riskWarnings.shared],
    opportunityWindows: cfg.opportunityWindows,
  };
}
