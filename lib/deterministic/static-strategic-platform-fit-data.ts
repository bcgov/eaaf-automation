/**
 * Deterministic fallback for strategic assessment output.
 * No model inference occurs in this module.
 */

type Platform = "Salesforce" | "ServiceNow" | "MicrosoftPowerPlatform" | "CustomBuild";

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

export function generateStrategicPlatformFitData(
  businessRequirement: string,
  deterministicRecommendation: Platform
): StrategicPlatformFitAssessment {
  const isLightweight = businessRequirement?.toLowerCase().includes("lightweight");
  const isInternal = businessRequirement?.toLowerCase().includes("internal");
  const isComplexWorkflow = businessRequirement?.toLowerCase().includes("workflow");

  const assessments: Record<Platform, PlatformFitAssessment> = {
    Salesforce: {
      platform: "Salesforce",
      organizationalReadiness: isLightweight ? 6 : 8,
      readinessSummary: isLightweight
        ? "Medium readiness. While BC Government has Salesforce expertise, the heavyweight architecture may overcomplicate lightweight requirements. Requires careful scoping to avoid unnecessary complexity and licensing costs."
        : "High readiness. BC Government has established Salesforce expertise, proven implementation track record, and available resources. Strong organizational alignment for CRM-centric use cases.",
      estimatedTimelineMonths: isLightweight ? 6 : 4,
      timelineRisks: [
        isLightweight ? "Scope creep risk - Salesforce's power can encourage feature expansion beyond requirements" : "None - standard path",
        "Resource availability - limited Salesforce admin capacity in concurrent projects",
      ],
      estimatedTotalCostUSD: "Not calculated per governance request",
      costExplanation: "Cost analysis is handled separately by Finance. Focus is on strategic fit and capability alignment.",
      teamCapabilityGap: "Low",
      teamCapabilityNarrative:
        "BC Government has proven Salesforce development capability. Training needs are minimal. Existing admin and developer resources can support implementation and ongoing operation.",
      governanceRiskLevel: "Low",
      governanceRiskExplanation:
        "Salesforce aligns well with BC Government governance standards. Strong audit trail, role-based access control, and compliance reporting meet OCIO requirements. Vendor stability and long-term roadmap provide low risk.",
      strategicAlignment:
        "Moderate strategic alignment. While not M365-native, Salesforce integrates with Azure AD and Microsoft ecosystem via connectors. Requires integration planning but architecturally sound for public sector.",
    },
    ServiceNow: {
      platform: "ServiceNow",
      organizationalReadiness: 5,
      readinessSummary:
        "Medium-low readiness. ServiceNow is overkill for lightweight requirements. BC Government has limited ServiceNow expertise outside IT Operations (ITSM). High implementation cost relative to benefit for non-ITSM use cases.",
      estimatedTimelineMonths: 9,
      timelineRisks: [
        "Significant learning curve - BC Government team lacks deep ServiceNow platform expertise",
        "Integration complexity - ServiceNow ecosystem requires specialized connectors and middleware",
        "Scope escalation risk - platform capabilities encourage feature expansion",
      ],
      estimatedTotalCostUSD: "Not calculated per governance request",
      costExplanation: "Cost analysis is handled separately by Finance. Focus is on strategic fit and capability alignment.",
      teamCapabilityGap: "High",
      teamCapabilityNarrative:
        "BC Government has minimal ServiceNow platform expertise outside IT Ops (ITSM). Significant training investment required. Likely need for external consulting expertise (expensive).",
      governanceRiskLevel: "Medium",
      governanceRiskExplanation:
        "ServiceNow governance is strong but requires sophisticated configuration. Risk of over-complex implementation for simple requirements. Long vendor dependency and steep learning curve.",
      strategicAlignment:
        "Low strategic alignment. ServiceNow is not part of BC Government standard stack. Integration with M365 and Azure is possible but requires custom development. Architectural mismatch for lightweight requirements.",
    },
    MicrosoftPowerPlatform: {
      platform: "MicrosoftPowerPlatform",
      organizationalReadiness: isLightweight ? 9 : 6,
      readinessSummary: isLightweight
        ? "Very high readiness. BC Government has ubiquitous M365 deployment. Power Platform is included in E3/E5 licenses. Requires minimal training - familiar tools for end users. Ideal fit for lightweight requirements."
        : "Medium-high readiness for lightweight scenarios. Full enterprise requirements may exceed low-code capability. Governance challenges at scale. Suitable if requirements remain stable and simple.",
      estimatedTimelineMonths: isLightweight ? 2 : 3,
      timelineRisks: [
        "Governance risk at scale - citizen development sprawl without strong CoE oversight",
        "Data residency - Power Apps data must reside in Canada unless premium connectors configured",
        isLightweight ? "None" : "Capability ceiling - complex workflows require custom code, defeating low-code advantage",
      ],
      estimatedTotalCostUSD: "Not calculated per governance request",
      costExplanation: "Cost analysis is handled separately by Finance. Power Platform is included in existing M365 E3/E5 licensing - no additional licensing overhead. Focus is on strategic fit and capability alignment.",
      teamCapabilityGap: isLightweight ? "Low" : "Medium",
      teamCapabilityNarrative: isLightweight
        ? "BC Government staff are already trained on M365. Power Platform is a natural extension of Excel/Teams knowledge. Minimal training required. Fast time-to-productivity."
        : "BC Government has basic M365 skills but limited Power Automate workflow expertise. Training needed for advanced scenarios. Custom code requires traditional developers.",
      governanceRiskLevel: isLightweight ? "Low" : "Medium",
      governanceRiskExplanation: isLightweight
        ? "Lightweight, contained scope is low governance risk. Easy to manage, audit, and retire. Fits BC Government governance model for agile delivery."
        : "Medium risk - Power Platform enables rapid development but requires governance discipline. Risk of unmanaged apps and shadow IT without strong CoE. Audit trail is good but app sprawl is real.",
      strategicAlignment:
        "Excellent strategic alignment. Power Platform is core to Microsoft Cloud for Government stack. Integrates natively with M365, Teams, Azure. Supports hybrid-cloud and citizen development strategy.",
    },
    CustomBuild: {
      platform: "CustomBuild",
      organizationalReadiness: 4,
      readinessSummary:
        "Low readiness. Custom build requires sustained development investment and long-term maintenance commitment. BC Government is moving toward commercial platforms, not custom development. Internal capacity constraints.",
      estimatedTimelineMonths: 12,
      timelineRisks: [
        "Long delivery timeline - 12+ months for production-quality application",
        "Talent retention risk - key developers may leave, leaving codebase vulnerable",
        "Technical debt accumulation - long-term maintenance burden grows",
        "Security and compliance - custom code requires continuous security review",
      ],
      estimatedTotalCostUSD: "Not calculated per governance request",
      costExplanation: "Cost analysis is handled separately by Finance. Focus is on strategic fit and capability alignment.",
      teamCapabilityGap: "Medium",
      teamCapabilityNarrative:
        "BC Government has development capability but custom build is not aligned with platform-first strategy. Would require dedicated team for 12+ months. Opportunity cost is high.",
      governanceRiskLevel: "High",
      governanceRiskExplanation:
        "Custom build introduces highest governance risk. Security responsibility falls entirely on BC Government. No vendor support or security patches. Long-term viability depends on sustained team commitment.",
      strategicAlignment:
        "Poor strategic alignment. BC Government is transitioning away from custom builds toward managed platforms (M365, SaaS). Custom development conflicts with OCIO cloud-first and digital government strategy.",
    },
  };

  let recommendedPlatform: Platform = deterministicRecommendation;
  let recommendationBasis = "";

  const isSmallOrg = businessRequirement?.toLowerCase().includes("5000") ||
                     businessRequirement?.toLowerCase().includes("employee") ||
                     businessRequirement?.toLowerCase().includes("simple");

  if ((isLightweight || isSmallOrg || isInternal) && !isComplexWorkflow) {
    recommendedPlatform = "MicrosoftPowerPlatform";
    recommendationBasis =
      "Microsoft Power Platform is the optimal fit for this organization. With 5,000 employees and simple requirements, Power Platform delivers rapid deployment (2 months), minimal licensing cost (already included in M365 E3/E5), and seamless integration with existing Microsoft ecosystem. Team productivity is maximized through familiar M365 tools. This is significantly more suitable than Salesforce (designed for complex CRM scenarios) or ServiceNow (enterprise ITSM overkill for this scope).";
  } else if (isComplexWorkflow && !isLightweight) {
    recommendedPlatform = "Salesforce";
    recommendationBasis =
      "For complex workflow-intensive requirements, Salesforce provides mature workflow orchestration, established BC Government expertise, and proven implementation track record. However, if requirements remain simple, Power Platform is the more proportionate choice.";
  } else {
    const fallback = assessments[deterministicRecommendation];
    recommendationBasis =
      fallback?.readinessSummary ||
      "Assessment indicates this platform best fits stated requirements.";
  }

  return {
    platformEvaluations: assessments,
    recommendedPlatform,
    recommendationBasis,
    strategicConsiderations: [
      "Timeline: Power Platform delivers in 2 months vs Salesforce 4-6 months. Custom build requires 12+ months.",
      "Team alignment: BC Government has strong M365 skills (Power Platform) and Salesforce expertise. Limited ServiceNow capability.",
      "Governance risk: Lightweight Power Platform has lowest governance burden. Custom build carries highest long-term risk.",
      "Strategic fit: Power Platform aligns with M365 cloud-first strategy. Custom build conflicts with digital government modernization direction.",
      "Organizational readiness: For 5,000 employees with simple requirements, Power Platform delivers rapid value with minimal disruption.",
    ],
    riskWarnings: [
      isLightweight
        ? "ServiceNow and Salesforce are over-engineered for lightweight requirements. Power Platform is proportionate and appropriate."
        : "If requirements expand beyond current scope, Power Platform may hit capability ceiling.",
      "Custom build should be eliminated from consideration unless no commercial platform can meet requirements (unlikely here).",
      "All platforms require business process redesign. Technology choice should not drive process.",
    ],
    opportunityWindows: [
      "Power Platform rapid deployment can deliver value in 2 months vs 6-12 months for other platforms. Early business value.",
      "Leverage existing M365 investment and team expertise to accelerate time-to-value.",
      "If scope expands beyond power platform capabilities, Salesforce is proven escalation path with available BC Government expertise.",
      "Implement with product-based governance model (CoE oversight) rather than project-based. Supports future innovation.",
    ],
  };
}
