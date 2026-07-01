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
  // Q-prefixed numeric keys (Q001, Q009, Q010, etc.) are Architecture stage questions
  if (/^Q\d/i.test(upper)) return "Architecture Assessment";
  if (upper.startsWith("ARCH")) return "Architecture Assessment";
  if (upper.startsWith("CLOUD")) return "Cloud Assessment";
  if (upper.startsWith("PLAT")) return "Platform Assessment";
  if (upper.startsWith("OPS") || upper.startsWith("OPER")) return "Operational Considerations";
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

    // Use the concept name from the rule as the primary signal identifier.
    // This is the human-readable architectural concept, not the internal question key.
    const conceptName =
      hit.concept ?? meta?.signalName ?? formatQuestionKey(hit.questionKey);

    const platformRationale = (Object.entries(hit.platformPoints) as [Platform, number][])
      .filter(([, pts]) => typeof pts === "number")
      .map(([p, pts]) => {
        // Use concept-driven reasoning — never expose matched keywords or scoring mechanics.
        const reasoning = meta?.platformReasoning?.[p]
          ? formatRuleTemplate(meta.platformReasoning[p], {
              points: pts,
              platformLabel: platformLabel(p),
            })
          : pts > 0
          ? `${conceptName} requirements indicate strong alignment with ${platformLabel(p)} capabilities (+${pts} pts).`
          : `${conceptName} requirements indicate reduced alignment with ${platformLabel(p)} for this use case (${pts} pts).`;

        return { platform: p, points: pts, reasoning };
      });

    // Architectural Interpretation: use the rule's concept description (conceptual, keyword-free).
    // Falls back to a clean generated sentence if no description is available.
    const architecturalInterpretation =
      hit.description ??
      (meta?.interpretationTemplate
        ? formatRuleTemplate(meta.interpretationTemplate, {
            keyword: hit.keywordMatched,
            snippet: hit.responseSnippet,
          })
        : `${conceptName} requirements were identified in the assessment responses, contributing to the platform suitability evaluation.`);

    return {
      signalName: conceptName,
      stageName: meta?.stageName ?? deriveStageFromKey(hit.questionKey, defaults.stageName),
      factorName: conceptName,
      concept: hit.concept,
      responseEvidence: hit.responseSnippet,
      architecturalInterpretation,
      whyItMatters: hit.ruleWhyItMatters ?? meta?.whyItMatters ?? defaults.whyItMatters,
      platformRationale,
    };
  });
}
