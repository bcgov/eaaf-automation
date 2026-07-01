import { PLATFORM_DISPLAY, Platform } from "@/lib/deterministic/engine";
import { EAAF_RULES, formatRuleTemplate } from "@/lib/deterministic/rules";

export interface InstitutionalKnowledgePlatformProfile {
  platform: Platform;
  displayName: string;
  pros: string[];
  cons: string[];
  bestFitFor: string;
  canadianContext: string;
}

export interface InstitutionalKnowledgeLowSignalReport {
  historySuggestion: string | null;
  historyConfidence: number;
  nudgedRecommendation: Platform;
  nudgedRationale: string;
  overallConfidence: number;
  platformProfiles: InstitutionalKnowledgePlatformProfile[];
  caveat: string;
}

export const INSTITUTIONAL_KNOWLEDGE_PLATFORM_PROFILES: InstitutionalKnowledgePlatformProfile[] =
  EAAF_RULES.lowSignal.platformProfiles.map((p) => ({
    ...p,
    displayName: p.displayName || PLATFORM_DISPLAY[p.platform],
  }));

function nudgeFromInstitutionalKnowledgeContext(businessContext: string, businessRequirement: string): {
  platform: Platform;
  costRationale: string;
} {
  const text = `${businessContext} ${businessRequirement}`.toLowerCase();
  for (const rule of EAAF_RULES.lowSignal.nudgeRules) {
    const re = new RegExp(rule.pattern, "i");
    if (re.test(text)) {
      return { platform: rule.platform, costRationale: rule.costRationale };
    }
  }
  return EAAF_RULES.lowSignal.fallbackNudge;
}

export function buildInstitutionalKnowledgeLowSignalReport(
  historySuggestion: string | null,
  historyConfidence: number,
  businessContext: string,
  businessRequirement: string
): InstitutionalKnowledgeLowSignalReport {
  const { platform: nudged, costRationale } = nudgeFromInstitutionalKnowledgeContext(
    businessContext,
    businessRequirement
  );

  const historyLabel = historySuggestion
    ? `From history, ${historySuggestion} was recommended at ${historyConfidence}% confidence. `
    : "No sufficiently similar historical assessments exist to draw from. ";

  const nudgedRationale = formatRuleTemplate(EAAF_RULES.lowSignal.rationaleTemplate, {
    historyLabel,
    costRationale,
    platformDisplay: PLATFORM_DISPLAY[nudged],
  });

  return {
    historySuggestion,
    historyConfidence,
    nudgedRecommendation: nudged,
    nudgedRationale,
    overallConfidence: Math.min(
      historyConfidence > 0 ? EAAF_RULES.lowSignal.overallConfidence.withHistory : EAAF_RULES.lowSignal.overallConfidence.withoutHistory,
      EAAF_RULES.lowSignal.overallConfidence.maxCap
    ),
    platformProfiles: INSTITUTIONAL_KNOWLEDGE_PLATFORM_PROFILES,
    caveat: EAAF_RULES.lowSignal.caveat,
  };
}
