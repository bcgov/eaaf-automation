/**
 * Signal metadata for human-readable interpretation of scoring hits.
 * Maps question keys to business-language descriptions and per-platform reasoning.
 */

type Platform = "Salesforce" | "ServiceNow" | "MicrosoftPowerPlatform" | "CustomBuild";

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

interface SignalMeta {
  signalName: string;
  stageName: string;
  factorName: string;
  description: (snippet: string, keyword: string) => string;
  architecturalMeaning: string;
  whyItMatters: string;
  platformReasoning: Partial<Record<Platform, (pts: number) => string>>;
}

const SIGNAL_METADATA: Record<string, SignalMeta> = {
  Q001: {
    signalName: "Enterprise Capability Reuse",
    stageName: "Architecture Assessment",
    factorName: "Common Components",
    description: (_s, kw) => `Response indicates the solution can leverage existing enterprise capabilities (signal: "${kw}")`,
    architecturalMeaning: "The solution can reuse existing shared services rather than introducing new components",
    whyItMatters: "Reuse of enterprise capabilities reduces duplication, cost, and risk while increasing alignment with provincial architecture standards",
    platformReasoning: {
      Salesforce: (pts) => `Awarded ${pts} points. Salesforce's AppExchange and MuleSoft integration layer supports reuse of enterprise components including identity, data, and shared services.`,
      ServiceNow: (pts) => `Awarded ${pts} points. ServiceNow integrates with enterprise shared services via standard connectors and aligns with OCIO shared service patterns.`,
      MicrosoftPowerPlatform: (pts) => `Awarded ${pts} points. Power Platform natively connects to M365 and Azure shared services already in use across BC Government.`,
    },
  },
  Q002: {
    signalName: "Shared Services Standard Alignment",
    stageName: "Architecture Assessment",
    factorName: "Common Components",
    description: (_s, kw) => `Response demonstrates alignment with BC Government shared service standards (signal: "${kw}")`,
    architecturalMeaning: "The solution follows the provincial shared services strategy and OCIO architectural standards",
    whyItMatters: "Shared services alignment is an architectural requirement for all new provincial platforms and reduces the risk of non-compliant procurement",
    platformReasoning: {
      Salesforce: (pts) => `Awarded ${pts} points. Salesforce has existing BC Government enterprise agreements and established deployment patterns in the provincial public sector.`,
      ServiceNow: (pts) => `Awarded ${pts} points. ServiceNow is an OCIO-approved platform with established shared service patterns in BC Government.`,
      MicrosoftPowerPlatform: (pts) => `Awarded ${pts} points. Power Platform is included in existing M365 enterprise licences held by BC Government.`,
    },
  },
  Q009: {
    signalName: "Identity and Access Management Requirements",
    stageName: "Architecture Assessment",
    factorName: "Security",
    description: (_s, kw) => `Response identifies enterprise IAM requirements including SSO, MFA, or RBAC controls (signal: "${kw}")`,
    architecturalMeaning: "The solution must integrate with BC Government identity infrastructure such as IDIR, BCSC, or Azure AD",
    whyItMatters: "Mandatory IAM requirements narrow platform selection to enterprise-grade SaaS platforms with established identity integrations and proven BC Government deployment",
    platformReasoning: {
      Salesforce: (pts) => `Awarded ${pts} points. Salesforce has mature SSO, MFA, and RBAC support with established BCSC and Azure AD integration in BC Government.`,
      ServiceNow: (pts) => `Awarded ${pts} points. ServiceNow provides enterprise-grade identity integration with full RBAC and conditional access policy support.`,
      MicrosoftPowerPlatform: (pts) => `Awarded ${pts} points. Power Platform uses Azure AD natively and aligns with BC Government IDIR and conditional access standards.`,
    },
  },
  Q010: {
    signalName: "Mandatory Security Controls",
    stageName: "Architecture Assessment",
    factorName: "Security",
    description: (_s, kw) => `Response identifies mandatory security controls including governance, encryption, or access management requirements (signal: "${kw}")`,
    architecturalMeaning: "The solution must meet BC Government security baseline requirements and potentially sector-specific compliance obligations",
    whyItMatters: "Enterprise security requirements favour established SaaS platforms with proven security certifications, audit capabilities, and government-specific compliance documentation",
    platformReasoning: {
      Salesforce: (pts) => `Awarded ${pts} points. Salesforce holds FedRAMP (Moderate) and SOC 2 Type II certifications with comprehensive audit logging and data governance controls.`,
      ServiceNow: (pts) => `Awarded ${pts} points. ServiceNow provides SIEM integration, governance dashboards, encryption at rest and in transit, and role-based security controls.`,
      MicrosoftPowerPlatform: (pts) => `Awarded ${pts} points. Power Platform inherits Azure security controls including Microsoft Defender, Purview compliance, and ISO 27001 certification.`,
    },
  },
  CLOUD_SAAS_001: {
    signalName: "Commercial SaaS Availability",
    stageName: "Cloud Assessment",
    factorName: "SaaS Suitability",
    description: (_s, kw) => `Response indicates commercial SaaS products are available that satisfy at least 80% of core requirements (signal: "${kw}")`,
    architecturalMeaning: "The problem domain has mature commercial SaaS solutions available — custom development is not necessary to meet requirements",
    whyItMatters: "SaaS availability strongly supports commercial platform adoption over custom build, reducing both initial delivery cost and long-term maintenance burden",
    platformReasoning: {
      Salesforce: (pts) => pts > 0 ? `Awarded ${pts} points. Salesforce is a mature SaaS platform directly applicable to this use case with strong public sector deployment history.` : `Reduced by ${Math.abs(pts)} points. Response indicates SaaS solutions do not meet requirements, reducing Salesforce viability.`,
      ServiceNow: (pts) => pts > 0 ? `Awarded ${pts} points. ServiceNow is a leading enterprise SaaS platform for workflow and service management use cases.` : `Reduced by ${Math.abs(pts)} points. Custom build signals reduce ServiceNow suitability.`,
      MicrosoftPowerPlatform: (pts) => pts > 0 ? `Awarded ${pts} points. Power Platform provides SaaS low-code capability within existing BC Government M365 licences.` : `Reduced by ${Math.abs(pts)} points.`,
      CustomBuild: (pts) => pts > 0 ? `Awarded ${pts} points. Response signals custom build is preferred or required because commercial SaaS products do not meet requirements.` : `No change.`,
    },
  },
  CLOUD_SAAS_002: {
    signalName: "SaaS Capability Gap Assessment",
    stageName: "Cloud Assessment",
    factorName: "SaaS Suitability",
    description: (_s, kw) => `Response identifies gaps or missing capabilities in available SaaS products (signal: "${kw}")`,
    architecturalMeaning: "Identified capability gaps may require platform customisation, additional configuration, or reconsideration of build vs buy decision",
    whyItMatters: "Material capability gaps can shift the recommendation toward custom development or more extensible enterprise platforms",
    platformReasoning: {
      CustomBuild: (pts) => `Awarded ${pts} points. Identified capability gaps favour custom development to address unmet requirements.`,
      Salesforce: (pts) => `Awarded ${pts} points. Minor gaps can be addressed through Salesforce customisation, Flow configuration, and AppExchange solutions.`,
      ServiceNow: (pts) => `Awarded ${pts} points. Minor gaps can be addressed through ServiceNow workflow configuration and custom application development.`,
      MicrosoftPowerPlatform: (pts) => `Awarded ${pts} points. Minor gaps can be addressed through Power Apps low-code extensions and Power Automate workflows.`,
    },
  },
  CLOUD_CONSTRAINT_001: {
    signalName: "Cloud Adoption Constraints",
    stageName: "Cloud Assessment",
    factorName: "SaaS Suitability",
    description: (_s, kw) => `Response identifies constraints affecting SaaS adoption including data sovereignty, residency, or integration blockers (signal: "${kw}")`,
    architecturalMeaning: "Sovereignty, residency, or integration constraints may limit the viability of public cloud SaaS adoption",
    whyItMatters: "Data sovereignty requirements are a primary blocker for SaaS adoption in BC Government and must be resolved before commercial platform selection",
    platformReasoning: {
      Salesforce: (pts) => pts > 0 ? `Awarded ${pts} points. No blocking constraints identified — SaaS adoption including Salesforce is viable.` : `Reduced by ${Math.abs(pts)} points. Data sovereignty or residency constraints reduce Salesforce viability until addressed.`,
      ServiceNow: (pts) => pts > 0 ? `Awarded ${pts} points. No blocking constraints — ServiceNow deployment is viable.` : `Reduced by ${Math.abs(pts)} points. Sovereignty constraints impact ServiceNow viability.`,
      MicrosoftPowerPlatform: (pts) => pts > 0 ? `Awarded ${pts} points. No blocking constraints identified.` : `Reduced by ${Math.abs(pts)} points.`,
      CustomBuild: (pts) => `Awarded ${pts} points. Sovereignty or residency constraints favour on-premise or custom-controlled solutions.`,
    },
  },
  CLOUD_BUILD_001: {
    signalName: "Custom Build Justification",
    stageName: "Cloud Assessment",
    factorName: "Build vs Buy Decision",
    description: (_s, kw) => `Response addresses justification for custom development versus commercial SaaS alternatives (signal: "${kw}")`,
    architecturalMeaning: "The build vs buy decision has been evaluated and documented against available SaaS alternatives",
    whyItMatters: "Custom build requires strong justification in BC Government. Unjustified custom development significantly increases risk, cost, and long-term maintenance obligations",
    platformReasoning: {
      Salesforce: (pts) => pts > 0 ? `Awarded ${pts} points. Custom build not justified — commercial SaaS platforms including Salesforce are appropriate for this use case.` : `Reduced by ${Math.abs(pts)} points. Custom build justified; commercial platforms may not meet differentiating requirements.`,
      ServiceNow: (pts) => pts > 0 ? `Awarded ${pts} points. Custom build not justified — ServiceNow is an appropriate and lower-risk alternative.` : `Reduced by ${Math.abs(pts)} points. Custom build justified.`,
      MicrosoftPowerPlatform: (pts) => pts > 0 ? `Awarded ${pts} points. Custom build not justified — Power Platform provides a viable commercial low-code option.` : `Reduced by ${Math.abs(pts)} points.`,
      CustomBuild: (pts) => pts > 0 ? `Awarded ${pts} points. Custom build is justified by unique or differentiating capability requirements that commercial platforms cannot meet.` : `No change.`,
    },
  },
  CLOUD_BUILD_002: {
    signalName: "Cost and Timeline Comparison",
    stageName: "Cloud Assessment",
    factorName: "Build vs Buy Decision",
    description: (_s, kw) => `Response compares cost and delivery timeline between SaaS and custom build options (signal: "${kw}")`,
    architecturalMeaning: "Cost-benefit analysis supports the SaaS vs custom build recommendation with quantified evidence",
    whyItMatters: "SaaS platforms typically deliver faster time-to-value at lower total cost than equivalent custom development, particularly for first deployments",
    platformReasoning: {
      Salesforce: (pts) => `Awarded ${pts} points. SaaS cost and timeline advantage supports commercial platform selection — Salesforce provides faster delivery with lower initial risk.`,
      ServiceNow: (pts) => `Awarded ${pts} points. SaaS cost advantage supports ServiceNow for rapid delivery of workflow and service management capability.`,
      MicrosoftPowerPlatform: (pts) => `Awarded ${pts} points. Power Platform's low-code development model provides the fastest time-to-value of the evaluated options.`,
      CustomBuild: (pts) => `Awarded ${pts} points. Cost analysis indicates custom development is competitive or preferred in this specific context.`,
    },
  },
  PLAT_CRM_001: {
    signalName: "Primary Use Case — CRM or Workflow",
    stageName: "Platform Assessment",
    factorName: "Business Use Case Fit",
    description: (_s, kw) => `Response identifies the primary platform use case as CRM, case management lifecycle, or ITSM workflow (signal: "${kw}")`,
    architecturalMeaning: "The primary use case is the single most important determinant of platform selection — CRM and ITSM workloads have fundamentally different platform requirements",
    whyItMatters: "CRM and case lifecycle workloads strongly favour Salesforce. ITSM and service management workloads strongly favour ServiceNow. Misalignment here is the most common cause of failed implementations.",
    platformReasoning: {
      Salesforce: (pts) => `Awarded ${pts} points. CRM and case lifecycle management is Salesforce's core competency — strongest possible alignment with this use case category.`,
      ServiceNow: (pts) => `Awarded ${pts} points. ITSM and internal service management is ServiceNow's defining domain — strongest alignment for workflow-driven requirements.`,
      MicrosoftPowerPlatform: (pts) => `Awarded ${pts} points. Microsoft Power Platform supports workflow automation and moderate case handling within this use case.`,
    },
  },
  PLAT_CRM_002: {
    signalName: "Engagement Model — External or Internal Facing",
    stageName: "Platform Assessment",
    factorName: "Business Use Case Fit",
    description: (_s, kw) => `Response indicates whether the solution is citizen/externally-facing or internal staff-facing (signal: "${kw}")`,
    architecturalMeaning: "External citizen-facing engagement patterns favour CRM platforms; internal staff service management favours ITSM platforms",
    whyItMatters: "Engagement model is a key differentiator between Salesforce (citizen and CRM-led) and ServiceNow (staff and ITSM-led). Wrong selection leads to excessive customisation cost.",
    platformReasoning: {
      Salesforce: (pts) => `Awarded ${pts} points. Salesforce Experience Cloud provides citizen portal, self-service, and engagement capabilities for external-facing solutions.`,
      ServiceNow: (pts) => `Awarded ${pts} points. ServiceNow Service Portal is designed for internal staff-facing service desk and request management scenarios.`,
      MicrosoftPowerPlatform: (pts) => `Awarded ${pts} points. Power Pages supports both citizen-facing and internal portal scenarios.`,
    },
  },
  PLAT_WORKFLOW_001: {
    signalName: "Workflow and Process Complexity",
    stageName: "Platform Assessment",
    factorName: "Business Use Case Fit",
    description: (_s, kw) => `Response describes operational workflow requirements including ITSM processes, internal service management, or process orchestration (signal: "${kw}")`,
    architecturalMeaning: "Complex enterprise workflow orchestration favours specialised workflow platforms over CRM-first approaches",
    whyItMatters: "ITSM-grade workflow complexity — approvals, escalations, SLA management, change control — is where ServiceNow significantly outperforms alternatives",
    platformReasoning: {
      ServiceNow: (pts) => `Awarded ${pts} points. ServiceNow is purpose-built for complex enterprise workflow and ITSM orchestration — highest capability for this requirement.`,
      MicrosoftPowerPlatform: (pts) => `Awarded ${pts} points. Power Automate handles moderate workflow automation requirements adequately within M365 context.`,
      Salesforce: (pts) => `Awarded ${pts} points. Salesforce Flow provides workflow capability within CRM context but is not optimised for ITSM-grade orchestration.`,
    },
  },
  PLAT_LOWCODE_001: {
    signalName: "Low-Code Development as Primary Delivery Model",
    stageName: "Platform Assessment",
    factorName: "Business Use Case Fit",
    description: (_s, kw) => `Response indicates whether low-code rapid delivery by business teams is a primary or secondary requirement (signal: "${kw}")`,
    architecturalMeaning: "Low-code as the primary delivery model strongly favours Microsoft Power Platform, which is BC Government's established low-code platform",
    whyItMatters: "If business teams must independently build and maintain solutions, low-code capability is a primary selection factor. Power Platform is already licensed and provisioned across BC Government.",
    platformReasoning: {
      MicrosoftPowerPlatform: (pts) => `Awarded ${pts} points. Power Platform is BC Government's primary approved low-code platform, included in existing M365 E3/E5 licences with no significant incremental cost.`,
      Salesforce: (pts) => `Awarded ${pts} points. Salesforce declarative tools (Flow, App Builder) support business-led development within CRM context.`,
      ServiceNow: (pts) => `Awarded ${pts} points. ServiceNow App Engine provides low-code capability for operational workflow development.`,
    },
  },
  PLAT_INT_001: {
    signalName: "Enterprise Integration Complexity",
    stageName: "Platform Assessment",
    factorName: "Integration Capability",
    description: (_s, kw) => `Response describes enterprise integration requirements including bi-directional data exchange with provincial registries, financial systems, or identity platforms (signal: "${kw}")`,
    architecturalMeaning: "Deep enterprise integration requirements — EMPI, financial registries, identity systems — favour mature integration platforms with established provincial deployment patterns",
    whyItMatters: "Enterprise integration complexity is one of the strongest platform selection differentiators. Salesforce with MuleSoft leads for complex integration scenarios in BC Government.",
    platformReasoning: {
      Salesforce: (pts) => `Awarded ${pts} points. Salesforce with MuleSoft provides enterprise-grade integration to provincial registries, EMPI, financial systems, and identity infrastructure — the highest-rated option for complex integration.`,
      ServiceNow: (pts) => `Awarded ${pts} points. ServiceNow IntegrationHub supports enterprise integrations well but is optimised for ITSM workflow integration rather than complex bi-directional provincial system exchange.`,
      MicrosoftPowerPlatform: (pts) => `Awarded ${pts} points. Power Platform supports integration via 900+ connectors but complex provincial integrations may require premium licensing and custom development.`,
    },
  },
  PLAT_INT_002: {
    signalName: "Integration Performance and Volume Requirements",
    stageName: "Platform Assessment",
    factorName: "Integration Capability",
    description: (_s, kw) => `Response indicates high-volume, real-time, or low-latency integration requirements (signal: "${kw}")`,
    architecturalMeaning: "High-performance integration requirements reduce the viability of lightweight platforms and favour enterprise-grade SaaS platforms with mature API infrastructure",
    whyItMatters: "Real-time and high-volume integration needs introduce performance and reliability constraints that must be validated against the selected platform's API rate limits and SLA commitments",
    platformReasoning: {
      Salesforce: (pts) => `Awarded ${pts} points. Salesforce API infrastructure supports high-volume real-time integration at enterprise scale with published SLA commitments.`,
      ServiceNow: (pts) => `Awarded ${pts} points. ServiceNow IntegrationHub supports real-time integration for operational workflows with configurable performance parameters.`,
      MicrosoftPowerPlatform: (pts) => `Awarded ${pts} points. Power Platform supports real-time integration with Azure services but has API throughput limits that must be assessed.`,
    },
  },
  PLAT_ECO_001: {
    signalName: "Vendor Ecosystem and Governance Maturity",
    stageName: "Platform Assessment",
    factorName: "Ecosystem Maturity",
    description: (_s, kw) => `Response emphasises vendor ecosystem maturity, partner availability, or governance readiness as critical platform selection factors (signal: "${kw}")`,
    architecturalMeaning: "Mature vendor ecosystem and governance frameworks reduce long-term platform risk and support sustainable operations and ongoing platform investment",
    whyItMatters: "Governance readiness, partner availability, and vendor roadmap stability are critical for BC Government enterprise platform decisions that represent multi-year commitments",
    platformReasoning: {
      Salesforce: (pts) => `Awarded ${pts} points. Salesforce has the largest certified partner ecosystem in BC Government with proven public sector governance frameworks and a stable product roadmap.`,
      ServiceNow: (pts) => `Awarded ${pts} points. ServiceNow has strong BC Government presence with a mature partner ecosystem specifically for ITSM and public sector deployments.`,
      MicrosoftPowerPlatform: (pts) => `Awarded ${pts} points. Microsoft maintains deep BC Government enterprise agreements, broad partner availability, and long-term platform investment commitments.`,
    },
  },
  OPS_SUP_001: {
    signalName: "Operational Support Model",
    stageName: "Operational Considerations",
    factorName: "Operational Support Model",
    description: (_s, kw) => `Response describes the planned operational support model including managed services, partner augmentation, or internal team capability (signal: "${kw}")`,
    architecturalMeaning: "The operational support model must align with the selected platform's training, certification, and ongoing operational requirements",
    whyItMatters: "Platforms with strong partner ecosystems and managed service options reduce the risk of internal skill gaps and long-term operational dependency on individual staff",
    platformReasoning: {
      Salesforce: (pts) => `Awarded ${pts} points. Salesforce has a mature partner and managed service ecosystem in BC Government with certified Salesforce administrators and developers available.`,
      ServiceNow: (pts) => `Awarded ${pts} points. ServiceNow specialist partners and managed service providers are available in BC for ongoing platform operations.`,
      MicrosoftPowerPlatform: (pts) => `Awarded ${pts} points. Power Platform can be supported by Microsoft partners or existing internal M365 teams with Power Platform training.`,
      CustomBuild: (pts) => `Awarded ${pts} points. Internal-only support model is feasible for custom-built solutions but requires long-term staffing commitment.`,
    },
  },
  OPS_RISK_001: {
    signalName: "Governance and Compliance Risk Posture",
    stageName: "Operational Considerations",
    factorName: "Governance and Risk",
    description: (_s, kw) => `Response identifies privacy, compliance, or audit requirements as significant operational risk factors (signal: "${kw}")`,
    architecturalMeaning: "Compliance and audit requirements favour platforms with mature governance frameworks, security certifications, and published compliance documentation",
    whyItMatters: "BC Government privacy and compliance obligations under FOIPPA and sector-specific legislation require platforms with established security certifications and verifiable audit capabilities",
    platformReasoning: {
      Salesforce: (pts) => `Awarded ${pts} points. Salesforce meets FedRAMP Moderate and SOC 2 Type II compliance requirements with comprehensive audit logging, data classification, and privacy controls.`,
      ServiceNow: (pts) => `Awarded ${pts} points. ServiceNow provides compliance dashboards, full audit trails, risk management modules, and SOC 2 Type II certification.`,
      MicrosoftPowerPlatform: (pts) => `Awarded ${pts} points. Power Platform inherits Microsoft's compliance portfolio including ISO 27001, SOC 2, and government-specific certifications.`,
    },
  },
  FINAL_REC_001: {
    signalName: "Architect Platform Preference",
    stageName: "Final Recommendation",
    factorName: "Recommendation Synthesis",
    description: (_s, kw) => `Architect's response during final synthesis indicates a platform preference (signal: "${kw}")`,
    architecturalMeaning: "The assigned architect's stated platform preference is recorded as a supporting evidence signal in the recommendation",
    whyItMatters: "Architect judgment based on direct engagement with the business requirement provides contextual evidence that supplements the deterministic scoring",
    platformReasoning: {
      Salesforce: (pts) => `Awarded ${pts} points. Architect's response indicates Salesforce as the preferred platform for this use case.`,
      ServiceNow: (pts) => `Awarded ${pts} points. Architect's response indicates ServiceNow as the preferred platform.`,
      MicrosoftPowerPlatform: (pts) => `Awarded ${pts} points. Architect's response indicates Power Platform as the preferred platform.`,
      CustomBuild: (pts) => `Awarded ${pts} points. Architect's response indicates custom build as the preferred approach.`,
    },
  },
  FINAL_REC_002: {
    signalName: "Recommendation Confidence Statement",
    stageName: "Final Recommendation",
    factorName: "Recommendation Synthesis",
    description: (_s, kw) => `Architect's final synthesis response indicates high confidence in the platform recommendation (signal: "${kw}")`,
    architecturalMeaning: "The architect's stated confidence level reinforces the recommendation signal",
    whyItMatters: "Stated confidence from the assigned architect provides additional qualitative evidence to supplement the quantitative scoring",
    platformReasoning: {
      Salesforce: (pts) => `Awarded ${pts} points. High stated confidence reinforces Salesforce's position across other scoring criteria.`,
      ServiceNow: (pts) => `Awarded ${pts} points. High stated confidence reinforces ServiceNow's position.`,
      MicrosoftPowerPlatform: (pts) => `Awarded ${pts} points. High stated confidence reinforces Power Platform's position.`,
    },
  },
  META_Business_Context: {
    signalName: "Business Context — Platform Signal",
    stageName: "Assessment Metadata",
    factorName: "Business Context",
    description: (_s, kw) => `Business context description contains platform-relevant domain language (signal: "${kw}")`,
    architecturalMeaning: "The stated business context identifies domain characteristics — such as ITSM operations, citizen-facing services, or lightweight internal tooling — that are strong early indicators of platform suitability",
    whyItMatters: "Business context is the primary framing signal for platform selection. Domain-specific language in this field directly narrows the viable platform set before any detailed assessment questions are answered.",
    platformReasoning: {
      ServiceNow: (pts) => `Awarded ${pts} points. Business context describes ITSM, incident management, service desk, or operational workflow domain — ServiceNow's core competency.`,
      Salesforce: (pts) => `Awarded ${pts} points. Business context describes CRM, case management, or citizen-facing engagement domain — Salesforce's core competency.`,
      MicrosoftPowerPlatform: (pts) => `Awarded ${pts} points. Business context describes a lightweight, internal, or low-code use case well-served by Power Platform within existing M365 licensing.`,
    },
  },
  META_Business_Goals: {
    signalName: "Business Goals — Platform Signal",
    stageName: "Assessment Metadata",
    factorName: "Business Goals",
    description: (_s, kw) => `Stated business goals contain platform-relevant outcome language (signal: "${kw}")`,
    architecturalMeaning: "The stated goals identify specific outcome expectations — such as SLA enforcement, incident resolution, or rapid delivery — that indicate which platform is best positioned to deliver value",
    whyItMatters: "Business goals reveal the primary outcome being optimised. Goals focused on operational efficiency, incident management, or SLA compliance point strongly toward ITSM platforms; goals around citizen engagement or case lifecycle point toward CRM platforms.",
    platformReasoning: {
      ServiceNow: (pts) => `Awarded ${pts} points. Goals include incident management, SLA enforcement, or service desk outcomes — directly aligned with ServiceNow's operational workflow capabilities.`,
      Salesforce: (pts) => `Awarded ${pts} points. Goals include case lifecycle management, citizen engagement, or complex workflow outcomes — aligned with Salesforce's CRM capabilities.`,
      MicrosoftPowerPlatform: (pts) => `Awarded ${pts} points. Goals include rapid deployment, low cost, or agile delivery outcomes — well-suited to Power Platform's low-code model within existing M365 licences.`,
    },
  },
  META_Business_Drivers: {
    signalName: "Business Drivers — Platform Signal",
    stageName: "Assessment Metadata",
    factorName: "Business Drivers",
    description: (_s, kw) => `Stated business drivers contain platform-relevant strategic language (signal: "${kw}")`,
    architecturalMeaning: "Business drivers identify the underlying forces — compliance, efficiency, consolidation, or modernisation — motivating the initiative, which constrain viable platform options",
    whyItMatters: "Drivers such as SLA compliance or operational efficiency indicate an ITSM-oriented decision context. Drivers such as cost reduction or speed favour lightweight commercial options. Understanding drivers prevents platform over-engineering.",
    platformReasoning: {
      ServiceNow: (pts) => `Awarded ${pts} points. Drivers include SLA compliance, operational efficiency, or incident management — consistent with a ServiceNow-led operational governance approach.`,
      Salesforce: (pts) => `Awarded ${pts} points. Drivers include enterprise standardisation or complex requirements that align with Salesforce's enterprise capability depth.`,
      MicrosoftPowerPlatform: (pts) => `Awarded ${pts} points. Drivers include speed, cost reduction, or rapid delivery — consistent with Power Platform's time-to-value advantage under existing M365 licensing.`,
    },
  },
  META_Business_Requirement: {
    signalName: "Business Requirement — Platform Signal",
    stageName: "Assessment Metadata",
    factorName: "Business Requirement",
    description: (_s, kw) => `Stated business requirement contains platform-relevant capability language (signal: "${kw}")`,
    architecturalMeaning: "The business requirement statement identifies specific capability needs — such as workflow automation, case management, or ITSM processes — that directly constrain platform suitability",
    whyItMatters: "The business requirement is the most direct statement of what the platform must do. Requirements that reference ITSM, incident management, or SLA management strongly indicate ServiceNow; CRM, case management, or citizen portal requirements indicate Salesforce; lightweight or internal tool requirements indicate Power Platform.",
    platformReasoning: {
      ServiceNow: (pts) => `Awarded ${pts} points. Business requirement explicitly references ITSM, incident management, change control, or SLA management — ServiceNow's primary capability domain.`,
      Salesforce: (pts) => `Awarded ${pts} points. Business requirement references CRM, case management, or complex workflow needs — Salesforce's primary capability domain.`,
      MicrosoftPowerPlatform: (pts) => `Awarded ${pts} points. Business requirement describes a lightweight, internal, or low-code need well-served by Power Platform within existing M365 licensing.`,
    },
  },
};

export function buildScoringSignalExplanations(
  scoringHits: Array<{
    questionKey: string;
    responseSnippet: string;
    keywordMatched: string;
    platformPoints: Partial<Record<Platform, number>>;
  }>
): ScoringSignal[] {
  return scoringHits.map((hit) => {
    const meta = SIGNAL_METADATA[hit.questionKey];
    const platformRationale = (Object.entries(hit.platformPoints) as [Platform, number][])
      .filter(([, pts]) => typeof pts === "number")
      .map(([p, pts]) => {
        const reasonFn = meta?.platformReasoning[p];
        return {
          platform: p,
          points: pts,
          reasoning: reasonFn ? reasonFn(pts) : `${p === "MicrosoftPowerPlatform" ? "Microsoft Power Platform" : p}: ${pts > 0 ? "+" : ""}${pts} points from this assessment signal.`,
        };
      });

    return {
      signalName: meta?.signalName ?? `Assessment Signal — ${hit.questionKey}`,
      stageName: meta?.stageName ?? "Assessment",
      factorName: meta?.factorName ?? "Evaluation Criteria",
      responseEvidence: hit.responseSnippet,
      architecturalInterpretation: meta
        ? meta.description(hit.responseSnippet, hit.keywordMatched)
        : `Evidence detected in response: "${hit.keywordMatched}"`,
      whyItMatters: meta?.whyItMatters ?? "This response contributed to platform suitability scoring.",
      platformRationale,
    };
  });
}