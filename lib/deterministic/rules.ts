import rawRules from "@/rules/eaaf-rules.json";

export type Platform = "Salesforce" | "ServiceNow" | "MicrosoftPowerPlatform" | "CustomBuild";

export interface EaafRules {
  platformRules: {
    scoringRules: Record<string, Array<{ keywords: string[]; scores: Partial<Record<Platform, number>> }>>;
    platformDisplay: Record<Platform, string>;
    platformStrengths: Record<Platform, string[]>;
    platformWeaknesses: Record<Platform, string[]>;
    platformRisks: Record<Platform, string>;
    platformAlternatives: Record<Platform, string>;
    rationaleTemplates: {
      intro: string;
      keyEvidencePrefix: string;
      noSignals: string;
    };
  };
  confidence: {
    institutional: {
      conflictTopDiffThreshold: number;
      lowOverallThreshold: number;
      conflictMessages: {
        topDiff: string;
        lowOverall: string;
      };
      coverageScoring: {
        historicalMatches: { highAtLeast: number; oneValue: number; highPoints: number; onePoints: number; nonePoints: number };
        rulesMatched: { highAtLeast: number; mediumAtLeast: number; highPoints: number; mediumPoints: number; lowPoints: number };
        completeness: { highAtLeast: number; mediumAtLeast: number; highPoints: number; mediumPoints: number; lowPoints: number };
        levelThresholds: { highAtLeast: number; mediumAtLeast: number };
        explanations: { high: string; medium: string; low: string };
      };
      confidenceScoring: {
        completenessCaps: { below50: number; below80: number };
        rulesCaps: { none: number; below3: number };
        conflictPenalty: number;
        labels: { highAtLeast: number; mediumAtLeast: number };
        basis: string;
      };
    };
    similarity: {
      historicalAlignment: {
        retrievalMethod: string;
        noHistoricalNote: string;
        nonDecisionalNote: string;
      };
      advisoryConfidence: {
        base: number;
        businessContext: { richLen: number; basicLen: number; richDelta: number; basicDelta: number; lowDelta: number };
        historicalMatches: { twoPlusDelta: number; oneDelta: number; noneDelta: number };
        completeness: { highAtLeast: number; highDelta: number; lowBelow: number; lowDelta: number };
        clamp: { min: number; max: number };
        labels: { highAtLeast: number; mediumAtLeast: number };
        basis: string;
      };
    };
  };
  lowSignal: {
    platformProfiles: Array<{
      platform: Platform;
      displayName: string;
      pros: string[];
      cons: string[];
      bestFitFor: string;
      canadianContext: string;
    }>;
    nudgeRules: Array<{ pattern: string; platform: Platform; costRationale: string }>;
    fallbackNudge: { platform: Platform; costRationale: string };
    rationaleTemplate: string;
    caveat: string;
    overallConfidence: { withHistory: number; withoutHistory: number; maxCap: number };
  };
  explanations: {
    default: {
      signalName: string;
      stageName: string;
      factorName: string;
      interpretationTemplate: string;
      whyItMatters: string;
      platformReasoningTemplate: string;
    };
    signalMetadata: Record<string, {
      signalName: string;
      stageName: string;
      factorName: string;
      interpretationTemplate: string;
      whyItMatters: string;
      platformReasoning: Partial<Record<Platform, string>>;
    }>;
  };
  platformGuidance: {
    keywordHeuristics: {
      lightweight: string[];
      internal: string[];
      complexWorkflow: string[];
      smallOrg: string[];
    };
    platformAssessments: Record<Platform, {
      organizationalReadiness: { lightweight: number; default: number };
      readinessSummary: { lightweight: string; default: string };
      estimatedTimelineMonths: { lightweight: number; default: number };
      timelineRisks: { lightweight: string; default: string }[];
      estimatedTotalCostUSD: string;
      costExplanation: string;
      teamCapabilityGap: { lightweight: "Low" | "Medium" | "High"; default: "Low" | "Medium" | "High" };
      teamCapabilityNarrative: { lightweight: string; default: string };
      governanceRiskLevel: { lightweight: "Low" | "Medium" | "High"; default: "Low" | "Medium" | "High" };
      governanceRiskExplanation: { lightweight: string; default: string };
      strategicAlignment: string;
    }>;
    recommendationBasis: {
      lightweightOrSmallOrInternal: string;
      complexWorkflow: string;
      fallback: string;
    };
    strategicConsiderations: string[];
    riskWarnings: { lightweight: string; default: string; shared: string[] };
    opportunityWindows: string[];
  };
  recommendationTemplate: {
    summary: string;
    platformAnalysisWithBestFit: string;
    platformAnalysisFallback: string;
    nextSteps: string;
    disclaimer: string;
  };
  similarity: {
    signalThreshold: number;
    stopWords: string[];
    categoryModel: Array<{
      key:
        | "architecturalCapabilities"
        | "businessAlignment"
        | "operatingModel"
        | "workflowCharacteristics"
        | "integrationPatterns"
        | "securityRequirements"
        | "governanceRequirements"
        | "platformSelectionFactors";
      label: string;
      weight: number;
    }>;
    circuitBreakerResetMs: number;
    lexicalFallback: {
      serviceUnavailableNote: string;
      precisionReductionNote: string;
      unavailableDiffTemplate: string;
      unavailableReductionTemplate: string;
    };
    narratives: {
      categoryMatch: Record<string, string>;
      categoryDifference: Record<string, string>;
      categoryReduction: Record<string, string>;
      categoryAlignmentEvidence: Record<string, string>;
      categoryDivergenceEvidence: Record<string, string>;
    };
  };
}

export const EAAF_RULES: EaafRules = rawRules as unknown as EaafRules;

export function formatRuleTemplate(template: string, vars: Record<string, string | number | null | undefined>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key) => {
    const value = vars[key];
    return value === null || value === undefined ? "" : String(value);
  });
}
