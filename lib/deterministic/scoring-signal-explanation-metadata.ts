import { EAAF_RULES, formatRuleTemplate, Platform } from "@/lib/deterministic/rules";

export interface ScoringSignal {
  signalName: string;
  stageName: string;
  factorName: string;
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
      signalName: meta?.signalName ?? `${defaults.signalName} - ${hit.questionKey}`,
      stageName: meta?.stageName ?? defaults.stageName,
      factorName: meta?.factorName ?? defaults.factorName,
      responseEvidence: hit.responseSnippet,
      architecturalInterpretation: formatRuleTemplate(
        meta?.interpretationTemplate ?? defaults.interpretationTemplate,
        { keyword: hit.keywordMatched, snippet: hit.responseSnippet }
      ),
      whyItMatters: meta?.whyItMatters ?? defaults.whyItMatters,
      platformRationale,
    };
  });
}
