import { EAAF_RULES, formatRuleTemplate, Platform } from "@/lib/deterministic/rules";

/**
 * Converts a question key like CLOUD_SAAS_001 into a readable label like "Cloud Saas".
 * Strips any trailing numeric segment and title-cases the remaining parts.
 */
function formatQuestionKey(key: string): string {
  const parts = key.split("_");
  const last = parts[parts.length - 1];
  const nameParts = /^\d+$/.test(last) ? parts.slice(0, -1) : parts;
  return nameParts.map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(" ");
}

/**
 * Derives a human-readable stage name from the question key prefix.
 * Falls back to the JSON default when no prefix matches.
 */
function deriveStageFromKey(key: string, defaultStageName: string): string {
  const upper = key.toUpperCase();
  if (upper.startsWith("ARCH")) return "Architecture";
  if (upper.startsWith("CLOUD")) return "Cloud Assessment";
  if (upper.startsWith("PLAT")) return "Platform Assessment";
  if (upper.startsWith("OPS") || upper.startsWith("OPER")) return "Operations";
  if (upper.startsWith("META") || upper.startsWith("BUSI") || upper.startsWith("CONTEXT")) return "Assessment Metadata";
  return defaultStageName;
}

export interface ScoringSignal {
  signalName: string;
  stageName: string;
  factorName: string;
  concept?: string;
  responseEvidence: string;
  architecturalInterpretation: string;
  whyItMatters: string;
  platformRationale: Array<{
    platform: Platform;
    points: number;
    reasoning: string;
  }>;
}

function platformLabel(platform: Platform): string {
  return platform === "MicrosoftPowerPlatform" ? "Microsoft Power Platform" : platform;
}

export function buildScoringSignalExplanations(
  scoringHits: Array<{
    questionKey: string;
    responseSnippet: string;
    keywordMatched: string;
    platformPoints: Partial<Record<Platform, number>>;
    concept?: string;
    description?: string;
    ruleWhyItMatters?: string;
  }>
): ScoringSignal[] {
  const defaults = EAAF_RULES.explanations.default;

  return scoringHits.map((hit) => {
    const meta = EAAF_RULES.explanations.signalMetadata[hit.questionKey];

    const platformRationale = (Object.entries(hit.platformPoints) as [Platform, number][])
      .filter(([, pts]) => typeof pts === "number")
      .map(([p, pts]) => {
        const platformTemplate = meta?.platformReasoning?.[p];
        const reasoning = platformTemplate
          ? formatRuleTemplate(platformTemplate, { points: pts, platformLabel: platformLabel(p) })
          : formatRuleTemplate(defaults.platformReasoningTemplate, {
              platformLabel: platformLabel(p),
              points: pts,
              signedPoints: `${pts > 0 ? "+" : ""}${pts}`,
            });

        return {
          platform: p,
          points: pts,
          reasoning,
        };
      });

    return {
      signalName: meta?.signalName ?? formatQuestionKey(hit.questionKey),
      stageName: meta?.stageName ?? deriveStageFromKey(hit.questionKey, defaults.stageName),
      factorName: meta?.factorName ?? formatQuestionKey(hit.questionKey),
      concept: hit.concept,
      responseEvidence: hit.responseSnippet,
      architecturalInterpretation: formatRuleTemplate(
        meta?.interpretationTemplate ?? defaults.interpretationTemplate,
        { keyword: hit.keywordMatched, snippet: hit.responseSnippet }
      ),
      whyItMatters: hit.ruleWhyItMatters ?? meta?.whyItMatters ?? defaults.whyItMatters,
      platformRationale,
    };
  });
}
