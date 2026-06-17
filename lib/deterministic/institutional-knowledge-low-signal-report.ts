import { Platform, PLATFORM_DISPLAY } from "@/lib/deterministic/engine";

// Static Canadian public sector platform knowledge used when assessment signal
// is too sparse for a decisive similarity-supported recommendation.
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

export const INSTITUTIONAL_KNOWLEDGE_PLATFORM_PROFILES: InstitutionalKnowledgePlatformProfile[] = [
  {
    platform: "Salesforce",
    displayName: PLATFORM_DISPLAY["Salesforce"],
    pros: [
      "Industry-leading CRM and case management out of the box",
      "Salesforce Government Cloud available in Canadian data regions",
      "Deep ecosystem of certified partners with public sector experience",
      "Health Cloud and Public Sector Solutions purpose-built for government",
      "Strong EMPI and enterprise integration via MuleSoft",
      "Proven in multiple BC Government and Canadian federal programs",
    ],
    cons: [
      "High per-user licensing cost, especially at scale",
      "Requires Salesforce-certified admin and developer skills",
      "Complex custom integrations can drive significant delivery cost",
      "Vendor lock-in to Salesforce roadmap and pricing",
    ],
    bestFitFor: "Case management, citizen engagement portals, CRM-heavy programs, EMPI-integrated health workflows",
    canadianContext:
      "Salesforce is widely adopted across BC Government (e.g., SDPR, HLTH) and federal agencies (CRA, IRCC pilots). " +
      "Government Cloud Canada region satisfies PROTECTED B data residency requirements. " +
      "Provincial procurement vehicles (COTS agreements) reduce acquisition friction.",
  },
  {
    platform: "ServiceNow",
    displayName: PLATFORM_DISPLAY["ServiceNow"],
    pros: [
      "Best-in-class ITSM, service management, and operational workflow",
      "Strong audit trail and compliance tooling",
      "Now Platform is highly configurable for government workflow automation",
      "Available through Canadian government procurement vehicles",
      "Robust reporting and SLA management",
    ],
    cons: [
      "Limited native CRM depth - not designed for citizen-facing case management",
      "Significant implementation effort and specialist skills required",
      "Higher cost relative to value when CRM is the primary need",
      "Less ecosystem depth for health and social services use cases",
    ],
    bestFitFor: "IT service management, internal operational workflows, HR service delivery, enterprise asset management",
    canadianContext:
      "ServiceNow is the dominant ITSM platform in BC Government (used by OCIO, shared services). " +
      "Strong fit for IT and enterprise ops use cases. " +
      "Less common for citizen-facing or case management workloads in Canadian public sector.",
  },
  {
    platform: "MicrosoftPowerPlatform",
    displayName: PLATFORM_DISPLAY["MicrosoftPowerPlatform"],
    pros: [
      "Existing Microsoft 365 licences reduce incremental cost",
      "Power Apps and Power Automate enable rapid low-code delivery",
      "Power Platform provides lightweight case and workflow capabilities",
      "Azure Government Cloud available in Canadian data regions",
      "Strong citizen developer ecosystem - business teams can self-serve",
    ],
    cons: [
      "Governance challenges at scale - citizen development can create shadow IT",
      "Premium connectors required for enterprise integration add cost",
      "Less mature than Salesforce for complex case management",
      "Platform fragmentation risk across Power Apps, Dynamics, and Azure services",
    ],
    bestFitFor: "Rapid application delivery, internal staff tools, low-code process automation, lightweight case management, survey and forms workloads",
    canadianContext:
      "BC Government holds an enterprise M365 agreement covering all ministries - Teams, SharePoint, and M365 Copilot are already deployed. " +
      "Power Platform (Power Apps, Power Automate, Power BI) is included within most existing M365 E3/E5 licence tiers at no significant incremental cost. " +
      "For internal staff-facing tools, surveys, forms, and lightweight workflow, Power Platform is the lowest-cost path because the licence is already paid. " +
      "Complex CRM/case workloads may require additional licensing but can remain cheaper than Salesforce at typical BC Gov scale. " +
      "OCIO actively encourages Power Platform adoption for internal productivity use cases under the M365 investment strategy.",
  },
  {
    platform: "CustomBuild",
    displayName: PLATFORM_DISPLAY["CustomBuild"],
    pros: [
      "Full control over data model, UX, and integration design",
      "No vendor lock-in or per-user licensing cost",
      "Can be purpose-built for unique or highly regulated requirements",
      "Intellectual property remains with the organisation",
    ],
    cons: [
      "Highest total cost of ownership: development, testing, ops, security patching",
      "Longest time to value - typically 2-3x slower than SaaS adoption",
      "Requires sustained internal or partner development capacity",
      "No vendor roadmap - all capability investment falls on the organisation",
      "OCIO cloud-first and SaaS-first directives require explicit justification",
    ],
    bestFitFor: "Highly specialised or differentiating capabilities with no SaaS equivalent; where IP ownership is a strategic requirement",
    canadianContext:
      "BC Government OCIO directives require custom build to be the last resort after SaaS alternatives are exhausted. " +
      "Custom build is rarely recommended for standard case management or workflow workloads in the provincial context.",
  },
];

type InstitutionalKnowledgeNudgeResult = {
  platform: Platform;
  costRationale: string;
};

function nudgeFromInstitutionalKnowledgeContext(
  businessContext: string,
  businessRequirement: string
): InstitutionalKnowledgeNudgeResult {
  const text = `${businessContext} ${businessRequirement}`.toLowerCase();

  if (
    /employee|staff|internal|survey|form|satisfaction|feedback|lightweight|simple process|small team|low.?code|rapid app/.test(text)
  ) {
    return {
      platform: "MicrosoftPowerPlatform",
      costRationale:
        "BC Government holds an enterprise M365 agreement. Power Platform (Power Apps, Power Automate) " +
        "is included within existing E3/E5 licences at no significant incremental cost. " +
        "For an internal staff-facing use case this is the lowest-cost option - the licence is already paid.",
    };
  }

  if (/itsm|service desk|incident|change management|it service|asset management|operations workflow/.test(text)) {
    return {
      platform: "ServiceNow",
      costRationale:
        "ServiceNow is the approved ITSM platform in BC Government (OCIO shared services). " +
        "Leveraging an existing ServiceNow instance avoids a new platform procurement and reduces per-tenant cost.",
    };
  }

  if (/case management|crm|citizen|patient|intake|lifecycle|eligibility|benefit|portal|public-facing/.test(text)) {
    return {
      platform: "Salesforce",
      costRationale:
        "Salesforce Government Cloud is the most capable platform for citizen-facing CRM and case management workloads. " +
        "Per-user licensing is higher than Power Platform but is justified by the depth of native capability.",
    };
  }

  return {
    platform: "MicrosoftPowerPlatform",
    costRationale:
      "In the absence of a strong use-case signal, Microsoft Power Platform is the lowest-risk default for BC Government. " +
      "The M365 enterprise agreement means Power Platform capacity is available at minimal incremental cost compared to procuring Salesforce or ServiceNow.",
  };
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

  const nudgedRationale =
    `${historyLabel}` +
    `Factoring in the broader Canadian public sector context: ${costRationale} ` +
    `${PLATFORM_DISPLAY[nudged]} is the indicative suggested platform. ` +
    `Overall confidence remains low - complete all five assessment steps with substantive responses to produce a reliable recommendation.`;

  return {
    historySuggestion,
    historyConfidence,
    nudgedRecommendation: nudged,
    nudgedRationale,
    overallConfidence: Math.min(historyConfidence > 0 ? 30 : 20, 35),
    platformProfiles: INSTITUTIONAL_KNOWLEDGE_PLATFORM_PROFILES,
    caveat:
      "Confidence is intentionally capped at low because assessment responses are insufficient. " +
      "Add substantive responses across all five steps to produce a reliable recommendation.",
  };
}
