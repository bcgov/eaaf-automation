import db from "@/lib/db/db";
import { generateRecommendation, Platform, PlatformScore } from "@/lib/deterministic/engine";
import { generateEmbedding, generateEmbeddings, cosineSimilarity as embeddingCosineSimilarity } from "@/lib/similarity/embeddings";

// Ordered list of platforms — consistent ordering is required for fallback vector maths
const PLATFORMS: Platform[] = ["Salesforce", "ServiceNow", "MicrosoftPowerPlatform", "CustomBuild"];

export interface SimilarAssessment {
  assessmentId: number;
  assessmentName: string;
  platformRecommendation: string;
  confidenceScore: number;
  businessContext: string;
  businessGoal: string;
  businessDriver: string;
  businessRequirement: string;
  similarityScore: number; // 0-100
  similarityMethod: "architectural-category";
  comparison: {
    scoreByCategory: Array<{
      category: string;
      weight: number;
      score: number;
      matchedRationale: string[];
      differentiators: string[];
      reductionDrivers: string[];
    }>;
    overallScoreDerivation: string;
    similarityInterpretation: string;
    matched: {
      businessContext: string[];
      primaryGoal: string[];
      businessAlignment: string[];
      businessRequirements: string[];
      architecturalConstraints: string[];
      operationalRequirements: string[];
      platformAssessmentResponses: string[];
    };
    notMatched: {
      majorDifferences: string[];
      uniqueRequirements: string[];
      priorityDifferences: string[];
      capabilityDifferences: string[];
    };
    whyScoreNotHigher: {
      summary: string;
      topContributors: string[];
    };
    assessmentResponseComparison: {
      similarQuestionThemes: string[];
      differentQuestionThemes: string[];
      similarResponseThemes: string[];
      differentResponseThemes: string[];
    };
    platformOutcomeComparison: {
      historicalDecisionBasis: string;
      applicabilityToCurrent: string;
      deterministicDecisionContext: string;
      strongestContributingFactors: string[];
    };
  };
}

interface HistoryRow {
  id: number;
  assessment_id: number;
  snapshot_json: string;
  created_at: string;
}

interface SnapshotData {
  assessmentName: string;
  businessContext?: string;
  businessGoal?: string;
  businessDriver?: string;
  businessRequirement?: string;
  platformScores?: PlatformScore[];
  platformRecommendation: string;
  confidenceScore: number;
  rationale?: string;
}

interface AssessmentContextRow {
  business_context?: string;
  business_goals?: string;
  business_drivers?: string;
  business_requirement?: string;
}

interface AssessmentResponseRow {
  question_key: string;
  response_text: string;
}

interface SimpleContext {
  businessContext: string;
  businessGoal: string;
  businessDriver: string;
  businessRequirement: string;
}

interface CategoryDefinition {
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
}

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "into", "their", "there", "about", "have", "will", "were",
  "been", "must", "need", "needs", "should", "could", "would", "also", "across", "under", "within", "while", "where",
  "which", "when", "what", "than", "then", "into", "onto", "over", "only", "very", "much", "more", "less", "such",
  "through", "across", "using", "used", "being", "based", "including", "includes", "include", "each", "many", "some",
  "high", "low", "medium", "government", "bc", "platform", "assessment", "business", "requirement", "requirements",
]);

const CATEGORY_MODEL: CategoryDefinition[] = [
  {
    key: "architecturalCapabilities",
    label: "Architectural capabilities",
    weight: 15,
  },
  {
    key: "businessAlignment",
    label: "Business alignment",
    weight: 20,
  },
  {
    key: "operatingModel",
    label: "Operating model",
    weight: 15,
  },
  {
    key: "workflowCharacteristics",
    label: "Workflow characteristics",
    weight: 15,
  },
  {
    key: "integrationPatterns",
    label: "Integration patterns",
    weight: 12,
  },
  {
    key: "securityRequirements",
    label: "Security requirements",
    weight: 10,
  },
  {
    key: "governanceRequirements",
    label: "Governance requirements",
    weight: 8,
  },
  {
    key: "platformSelectionFactors",
    label: "Platform selection factors",
    weight: 5,
  },
];

interface StoredEmbeddingPayload {
  version: 1;
  provider: "local-sentence-transformers";
  model: "all-MiniLM-L6-v2";
  contextEmbedding: number[];
  summaryEmbedding: number[];
  responseEmbeddings: Array<{ questionKey: string; embedding: number[] }>;
}

// ─── Vector helpers for score-based fallback ──────────────────────────────────

function toVector(platformScores: PlatformScore[]): number[] {
  const scoreMap: Record<string, number> = {};
  for (const ps of platformScores) {
    scoreMap[ps.platform] = ps.score;
  }
  return PLATFORMS.map((p) => scoreMap[p] ?? 0);
}

// ─── Signal threshold ────────────────────────────────────────────────────────

const SIGNAL_THRESHOLD = 20;

export function isSignalSufficient(assessmentId: number): boolean {
  const result = generateRecommendation(assessmentId);
  const vector = toVector(result.platformScores);
  return vector.reduce((s, v) => s + v, 0) >= SIGNAL_THRESHOLD;
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.length > 0 && value.every((n) => typeof n === "number" && Number.isFinite(n));
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenize(value: string | null | undefined): string[] {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function jaccardSimilarity(a: string, b: string): number {
  const tokensA = new Set(tokenize(a));
  const tokensB = new Set(tokenize(b));
  if (tokensA.size === 0 && tokensB.size === 0) return 1;
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) intersection += 1;
  }
  const union = tokensA.size + tokensB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Build semantic context for a specific category to enable AI semantic similarity comparison.
 * Includes all assessment metadata and responses, labeled with the category dimension.
 * The embedding model will extract semantically relevant content for that category.
 */
function buildSemanticCategoryContext(category: CategoryDefinition, assessment: SimpleContext, responses: AssessmentResponseRow[]): string {
  const parts: string[] = [];

  // Add assessment context metadata
  if (assessment.businessContext) parts.push(`Context: ${assessment.businessContext}`);
  if (assessment.businessGoal) parts.push(`Goal: ${assessment.businessGoal}`);
  if (assessment.businessDriver) parts.push(`Drivers: ${assessment.businessDriver}`);
  if (assessment.businessRequirement) parts.push(`Requirements: ${assessment.businessRequirement}`);

  // Add category label as semantic hint to guide embedding model focus
  parts.push(`Category: ${category.label}`);

  // Add all assessment responses - embedding model extracts relevant ones semantically
  for (const response of responses) {
    if (response.response_text.length > 0) parts.push(response.response_text);
  }

  return parts.filter((p) => p.length > 0).join("\n");
}

/**
 * Compute semantic similarity of two assessments within a specific category dimension.
 * Uses embedding-based semantic comparison rather than keyword overlap.
 */
async function computeSemanticCategorySimilarity(
  category: CategoryDefinition,
  currentAssessment: SimpleContext,
  historicalAssessment: SimpleContext,
  currentResponses: AssessmentResponseRow[],
  historicalResponses: AssessmentResponseRow[]
): Promise<{ score: number; matchedRationale: string[]; differentiators: string[]; reductionDrivers: string[] }> {
  try {
    // Build semantic context for category
    const currentContext = buildSemanticCategoryContext(category, currentAssessment, currentResponses);
    const historicalContext = buildSemanticCategoryContext(category, historicalAssessment, historicalResponses);

    // Generate embeddings for category-specific semantic contexts
    const currentEmbedding = await generateEmbedding(currentContext);
    const historicalEmbedding = await generateEmbedding(historicalContext);

    // Compute cosine similarity (range 0-1, where 1 is identical)
    const similarity = embeddingCosineSimilarity(currentEmbedding, historicalEmbedding);
    const score = clampScore(Math.round(similarity * 100));

    // Generate rationale based on semantic similarity score
    const matchedRationale = score >= 70 ? [categoryMatchNarrative(category.label)] : [];
    const differentiators = score < 85 ? [categoryDifferenceNarrative(category.label)] : [];
    const reductionDrivers = score < 85 ? [categoryReductionNarrative(category.label)] : [];

    return { score, matchedRationale, differentiators, reductionDrivers };
  } catch (error) {
    // Fallback: if embedding fails, return neutral score
    return { score: 50, matchedRationale: [], differentiators: [`${category.label} semantic comparison unavailable`], reductionDrivers: [] };
  }
}

function clampScore(value: number): number {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value);
}

function getAssessmentContext(assessmentId: number): SimpleContext {
  const row = db
    .prepare(
      `SELECT business_context, business_goals, business_drivers, business_requirement
       FROM assessments WHERE id = ?`
    )
    .get(assessmentId) as AssessmentContextRow | undefined;

  return {
    businessContext: row?.business_context ?? "",
    businessGoal: row?.business_goals ?? "",
    businessDriver: row?.business_drivers ?? "",
    businessRequirement: row?.business_requirement ?? "",
  };
}

function getAssessmentResponses(assessmentId: number): AssessmentResponseRow[] {
  return db
    .prepare(
      `SELECT q.question_key, COALESCE(r.response_text, '') as response_text
       FROM responses r
       JOIN questions q ON q.id = r.question_id
       WHERE r.assessment_id = ?
       ORDER BY q.sequence`
    )
    .all(assessmentId) as AssessmentResponseRow[];
}

function getHistoricalRationale(assessmentId: number): string {
  const row = db
    .prepare(`SELECT rationale FROM recommendations WHERE assessment_id = ? ORDER BY id DESC LIMIT 1`)
    .get(assessmentId) as { rationale: string } | undefined;
  return row?.rationale ?? "Historical recommendation rationale was not recorded in detail.";
}

function stripReasonPrefix(reason: string): string {
  return reason
    .replace(/^[A-Z0-9_]+\s+response\s+signals\s+/i, "")
    .replace(/\s*\([+-]\d+pts\)\s*$/i, "")
    .trim();
}

interface AssessmentProfile {
  externalCitizenFacing: boolean;
  internalServiceDelivery: boolean;
  regulatoryCaseManagement: boolean;
  itsmOperations: boolean;
  workflowOrchestration: boolean;
  enterpriseIntegration: boolean;
  identityAndAccess: boolean;
  auditAndCompliance: boolean;
  commercialOverCustom: boolean;
  sharedServiceModel: boolean;
  modernizationDriver: boolean;
  efficiencyDriver: boolean;
  consolidationDriver: boolean;
}

function containsAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(normalizeText(term)));
}

function buildAssessmentProfile(context: SimpleContext, responses: AssessmentResponseRow[]): AssessmentProfile {
  const corpus = normalizeText(
    [context.businessContext, context.businessGoal, context.businessDriver, context.businessRequirement, ...responses.map((r) => r.response_text)]
      .filter(Boolean)
      .join(" ")
  );

  return {
    externalCitizenFacing: containsAny(corpus, ["citizen", "public", "applicant", "self service", "external portal", "community"]),
    internalServiceDelivery: containsAny(corpus, ["internal", "service desk", "itsm", "incident", "change management", "it operations"]),
    regulatoryCaseManagement: containsAny(corpus, ["regulatory", "licensing", "permit", "case management", "compliance lifecycle"]),
    itsmOperations: containsAny(corpus, ["itsm", "incident", "change", "problem", "service request", "sla"]),
    workflowOrchestration: containsAny(corpus, ["workflow", "approval", "orchestration", "routing", "escalation", "multi step"]),
    enterpriseIntegration: containsAny(corpus, ["integration", "api", "connector", "legacy", "middleware", "cmdb", "identity"]),
    identityAndAccess: containsAny(corpus, ["sso", "identity", "mfa", "rbac", "access control", "ldap", "entra", "azure ad"]),
    auditAndCompliance: containsAny(corpus, ["audit", "compliance", "privacy", "security", "soc", "pia", "residency", "sovereignty"]),
    commercialOverCustom: containsAny(corpus, ["saas", "commercial", "platform", "custom build not", "vendor"]),
    sharedServiceModel: containsAny(corpus, ["shared service", "ministry", "enterprise", "cross ministry", "operating model"]),
    modernizationDriver: containsAny(corpus, ["modernization", "digital", "transform", "future"]),
    efficiencyDriver: containsAny(corpus, ["efficiency", "productivity", "time to value", "faster", "agility"]),
    consolidationDriver: containsAny(corpus, ["consolidation", "standardize", "single platform", "rationalize"]),
  };
}

function buildConcreteMatches(current: AssessmentProfile, historical: AssessmentProfile): string[] {
  const matches: string[] = [];
  if (current.identityAndAccess && historical.identityAndAccess) {
    matches.push("Both assessments required enterprise identity integration and role-based access control.");
  }
  if (current.auditAndCompliance && historical.auditAndCompliance) {
    matches.push("Both assessments required auditability and compliance controls.");
  }
  if (current.workflowOrchestration && historical.workflowOrchestration) {
    matches.push("Both assessments involved workflow-driven business processes with defined approval paths.");
  }
  if (current.enterpriseIntegration && historical.enterpriseIntegration) {
    matches.push("Both assessments required integration with enterprise systems and shared platforms.");
  }
  if (current.commercialOverCustom && historical.commercialOverCustom) {
    matches.push("Both assessments evaluated commercial platforms over custom development for delivery.");
  }
  if (current.sharedServiceModel && historical.sharedServiceModel) {
    matches.push("Both assessments assumed an enterprise operating model with shared-service implications.");
  }
  return matches;
}

function buildConcreteDifferences(current: AssessmentProfile, historical: AssessmentProfile): string[] {
  const diffs: string[] = [];
  if (historical.externalCitizenFacing && !current.externalCitizenFacing) {
    diffs.push("Historical assessment focused on external citizen-facing services, while the current assessment is not citizen-facing.");
  }
  if (current.internalServiceDelivery && !historical.internalServiceDelivery) {
    diffs.push("Current assessment focuses on internal IT service delivery and operational support outcomes.");
  }
  if (historical.regulatoryCaseManagement && !current.regulatoryCaseManagement) {
    diffs.push("Historical assessment emphasized regulatory case and licensing lifecycle management.");
  }
  if (current.itsmOperations && !historical.itsmOperations) {
    diffs.push("Current assessment emphasizes ITSM processes including incident and change management.");
  }
  if (historical.modernizationDriver && !current.modernizationDriver) {
    diffs.push("Historical assessment prioritized modernization of regulatory service delivery.");
  }
  if ((current.efficiencyDriver || current.consolidationDriver) && !(historical.efficiencyDriver || historical.consolidationDriver)) {
    diffs.push("Current assessment prioritizes operational efficiency and service consolidation drivers.");
  }
  return diffs;
}

function historicalPlatformRationale(platform: string, fallback: string): string {
  const normalized = normalizeText(platform);
  if (normalized.includes("salesforce")) {
    return "Salesforce was selected because the historical assessment emphasized complex case management, citizen-facing interactions, multi-step approval workflows, and regulatory lifecycle management, all of which align strongly with Salesforce capabilities.";
  }
  if (normalized.includes("servicenow")) {
    return "ServiceNow was selected because the historical assessment emphasized IT service management, workflow-intensive operations, incident and change control, and enterprise operational governance.";
  }
  if (normalized.includes("power") || normalized.includes("microsoft")) {
    return "Microsoft Power Platform was selected because the historical assessment emphasized rapid delivery, M365 ecosystem alignment, and low-code workflow enablement within existing operational capability constraints.";
  }
  if (normalized.includes("custom")) {
    return "Custom build was selected because the historical assessment identified specialized capability requirements that were judged to need tailored implementation over commercial platform fit.";
  }
  return fallback && fallback.length > 0
    ? fallback
    : "The historical platform was selected based on architectural fit, operating model constraints, and delivery risk considerations documented at the time.";
}

function humanPlatformName(platform: Platform | string): string {
  const normalized = normalizeText(String(platform));
  if (normalized.includes("salesforce")) return "Salesforce";
  if (normalized.includes("servicenow")) return "ServiceNow";
  if (normalized.includes("microsoftpowerplatform") || normalized.includes("power platform") || normalized.includes("microsoft")) {
    return "Microsoft Power Platform";
  }
  if (normalized.includes("custom")) return "Custom Build";
  return String(platform);
}

function categoryMatchNarrative(category: string): string {
  const map: Record<string, string> = {
    "Architectural capabilities": "Both assessments require comparable enterprise architecture capability depth for the core use case.",
    "Business alignment": "Both assessments align on context, requirements, and strategic drivers that shape platform suitability.",
    "Operating model": "Both assessments assume a comparable operating model, delivery ownership pattern, and support structure.",
    "Workflow characteristics": "Both assessments require similar workflow complexity, multi-step process orchestration, and control points.",
    "Integration patterns": "Both assessments require comparable integration patterns across enterprise systems and shared platforms.",
    "Security requirements": "Both assessments require similar security controls, auditability, and policy-aligned assurance levels.",
    "Governance requirements": "Both assessments operate under similar governance, compliance, and architectural oversight expectations.",
    "Platform selection factors": "Both assessments emphasize similar platform decision factors such as fit, maintainability, and delivery feasibility.",
  };
  return map[category] ?? "Both assessments show substantive alignment in this decision category.";
}

function categoryDifferenceNarrative(category: string): string {
  const map: Record<string, string> = {
    "Architectural capabilities": "The historical and current assessments require different capability profiles, changing platform fit and delivery considerations.",
    "Business alignment": "Context, requirements, and strategic drivers differ, reducing direct precedent transferability.",
    "Operating model": "Delivery and support model assumptions differ, affecting operational viability of the same platform decision.",
    "Workflow characteristics": "Workflow depth, orchestration complexity, or process structure differs in ways that affect platform suitability.",
    "Integration patterns": "Integration scope and dependency profile differ, affecting architectural risk and implementation effort.",
    "Security requirements": "Security and assurance expectations are not fully equivalent between the two assessments.",
    "Governance requirements": "Governance and compliance posture differs, reducing direct applicability of the prior decision.",
    "Platform selection factors": "Platform selection drivers are weighted differently in the current assessment compared with historical precedent.",
  };
  return map[category] ?? "Material differences in this category reduce direct precedent applicability.";
}

function categoryReductionNarrative(category: string): string {
  const map: Record<string, string> = {
    "Architectural capabilities": "Capability fit diverged in this category, which reduced similarity confidence.",
    "Business alignment": "Differences in context, requirements, and drivers reduced direct precedent relevance.",
    "Operating model": "Operating model differences reduced practical transferability of the historical decision.",
    "Workflow characteristics": "Workflow differences lowered confidence that the same platform choice is equally appropriate.",
    "Integration patterns": "Integration pattern differences increased divergence from historical precedent.",
    "Security requirements": "Security requirement variance reduced confidence in direct precedent reuse.",
    "Governance requirements": "Governance and compliance variance reduced precedent applicability.",
    "Platform selection factors": "Differences in platform decision priorities reduced score alignment.",
  };
  return map[category] ?? "Differences in this category reduced the final similarity score.";
}

function categoryAlignmentEvidence(category: string): string {
  const map: Record<string, string> = {
    "Architectural capabilities": "Architectural capability expectations are aligned, with both assessments requiring comparable solution capabilities for their target operating outcomes.",
    "Business alignment": "Business alignment is strong across context, requirements, and strategic drivers.",
    "Operating model": "Operating model assumptions are aligned, including ownership boundaries and shared-service implications.",
    "Workflow characteristics": "Workflow characteristics are aligned, including process orchestration complexity and approval flow expectations.",
    "Integration patterns": "Integration intent is aligned, with both assessments expecting comparable enterprise integration dependencies.",
    "Security requirements": "Security expectations are aligned, including identity, access, and auditability requirements.",
    "Governance requirements": "Governance expectations are aligned, including policy conformance and compliance posture.",
    "Platform selection factors": "Platform intent is aligned, with both assessments emphasizing similar decision priorities for platform fit.",
  };
  return map[category] ?? `${category} remained materially aligned between the two assessments.`;
}

function categoryDivergenceEvidence(category: string): string {
  const map: Record<string, string> = {
    "Architectural capabilities": "Architectural capability needs diverge, indicating different solution fit expectations between the two assessments.",
    "Business alignment": "Business alignment diverges across context, requirements, or strategic drivers.",
    "Operating model": "Operating model assumptions diverge, indicating different support, ownership, or service delivery expectations.",
    "Workflow characteristics": "Workflow requirements diverge, indicating different process complexity and approval path expectations.",
    "Integration patterns": "Integration patterns diverge, indicating different dependency and interoperability expectations.",
    "Security requirements": "Security expectations diverge, indicating different assurance, control, or risk posture requirements.",
    "Governance requirements": "Governance requirements diverge, indicating different policy and compliance obligations.",
    "Platform selection factors": "Platform decision priorities diverge, indicating different intent for platform suitability and adoption.",
  };
  return map[category] ?? `${category} diverged materially between the two assessments.`;
}

function deriveArchitectThemesFromReasons(reasons: string[]): string[] {
  const themes: string[] = [];
  for (const raw of reasons) {
    const reason = stripReasonPrefix(raw).toLowerCase();
    if ((reason.includes("business") || reason.includes("operational")) && !themes.includes("Business and operational requirements")) {
      themes.push("Business and operational requirements");
    }
    if ((reason.includes("workflow") || reason.includes("orchestration") || reason.includes("approval")) && !themes.includes("Workflow complexity and process orchestration needs")) {
      themes.push("Workflow complexity and process orchestration needs");
    }
    if ((reason.includes("integration") || reason.includes("api") || reason.includes("connector") || reason.includes("legacy")) && !themes.includes("Enterprise integration requirements")) {
      themes.push("Enterprise integration requirements");
    }
    if ((reason.includes("governance") || reason.includes("compliance") || reason.includes("security") || reason.includes("audit") || reason.includes("privacy")) && !themes.includes("Governance and compliance considerations")) {
      themes.push("Governance and compliance considerations");
    }
    if ((reason.includes("capability") || reason.includes("readiness") || reason.includes("support") || reason.includes("shared service") || reason.includes("operating model")) && !themes.includes("Organizational capability and support model")) {
      themes.push("Organizational capability and support model");
    }
  }

  if (themes.length === 0) {
    return [
      "Business and operational requirements",
      "Workflow complexity and process orchestration needs",
      "Enterprise integration requirements",
      "Governance and compliance considerations",
      "Organizational capability and support model",
    ];
  }

  return themes.slice(0, 5);
}

function buildFieldAlignmentNarrative(label: string, currentValue: string, historicalValue: string): { match: string[]; diff: string[]; unique: string[] } {
  const similarity = jaccardSimilarity(currentValue, historicalValue);
  const match: string[] = [];
  const diff: string[] = [];
  const unique: string[] = [];

  if (normalizeText(currentValue) && normalizeText(historicalValue)) {
    if (similarity >= 0.45) {
      match.push(`${label} is directionally aligned between current and historical assessments.`);
    } else {
      diff.push(`${label} differs in scope or priority between current and historical assessments.`);
    }
  }

  if (normalizeText(currentValue) && !normalizeText(historicalValue)) {
    unique.push(`Current assessment defines ${label.toLowerCase()} explicitly while historical assessment did not.`);
  }
  if (!normalizeText(currentValue) && normalizeText(historicalValue)) {
    unique.push(`Historical assessment defined ${label.toLowerCase()} explicitly while current assessment does not.`);
  }

  return { match, diff, unique };
}

async function buildDetailedComparison(
  currentAssessment: SimpleContext,
  historicalAssessment: SimpleContext,
  currentResponses: AssessmentResponseRow[],
  historicalResponses: AssessmentResponseRow[],
  baseSimilarityScore: number,
  currentRecommendedPlatform: Platform,
  currentRecommendationReasons: string[],
  historicalPlatform: string,
  historicalRationale: string
): Promise<SimilarAssessment["comparison"]> {
  const currentProfile = buildAssessmentProfile(currentAssessment, currentResponses);
  const historicalProfile = buildAssessmentProfile(historicalAssessment, historicalResponses);

  const contextAnalysis = buildFieldAlignmentNarrative("Business context", currentAssessment.businessContext, historicalAssessment.businessContext);
  const goalAnalysis = buildFieldAlignmentNarrative("Primary goal", currentAssessment.businessGoal, historicalAssessment.businessGoal);
  const driverAnalysis = buildFieldAlignmentNarrative("Business alignment", currentAssessment.businessDriver, historicalAssessment.businessDriver);
  const requirementAnalysis = buildFieldAlignmentNarrative("Business requirements", currentAssessment.businessRequirement, historicalAssessment.businessRequirement);

  // Compute semantic similarity for each category using AI embeddings
  const scoreByCategory = await Promise.all(
    CATEGORY_MODEL.map(async (category) => {
      const { score, matchedRationale, differentiators, reductionDrivers } = await computeSemanticCategorySimilarity(
        category,
        currentAssessment,
        historicalAssessment,
        currentResponses,
        historicalResponses
      );

      return {
        category: category.label,
        weight: category.weight,
        score,
        matchedRationale,
        differentiators,
        reductionDrivers,
        weightedScore: score * category.weight,
      };
    })
  );

  const totalWeight = scoreByCategory.reduce((sum, item) => sum + item.weight, 0);
  const weightedScore = totalWeight > 0 ? Math.round(scoreByCategory.reduce((sum, item) => sum + item.weightedScore, 0) / totalWeight) : baseSimilarityScore;
  const similarityScore = clampScore(Math.round(weightedScore * 0.85 + baseSimilarityScore * 0.15));

  const capabilityCategory = scoreByCategory.find((item) => item.category === "Architectural capabilities");
  const operatingCategory = scoreByCategory.find((item) => item.category === "Operating model");
  const workflowCategory = scoreByCategory.find((item) => item.category === "Workflow characteristics");

  const capabilityDifferences = [
    ...(capabilityCategory?.differentiators ?? []),
    ...(operatingCategory?.differentiators ?? []),
    ...(workflowCategory?.differentiators ?? []),
  ];

  const concreteMatches = buildConcreteMatches(currentProfile, historicalProfile);
  const concreteDifferences = buildConcreteDifferences(currentProfile, historicalProfile);

  const similarQuestionThemes = concreteMatches.slice(0, 6);
  const differentQuestionThemes = concreteDifferences.slice(0, 6);

  const topContributors: string[] = [];
  if (contextAnalysis.diff.length > 0) topContributors.push("Business context differs in meaningful ways.");
  if (goalAnalysis.diff.length > 0) topContributors.push("Primary goals are not fully aligned.");
  if (driverAnalysis.diff.length > 0) topContributors.push("Business alignment and decision priorities differ.");
  if (requirementAnalysis.diff.length > 0) topContributors.push("Business requirements are only partially overlapping.");
  if (concreteDifferences.length > 0) topContributors.push("Architectural and operating intent differs across several precedent dimensions.");
  if (capabilityDifferences.length > 0) topContributors.push("Operational and platform capability emphasis differs between assessments.");
  for (const category of scoreByCategory.filter((item) => item.score < 70).slice(0, 3)) {
    topContributors.push(`${category.category} reduced similarity (score ${category.score}/100).`);
  }

  const normalizedHistoricalPlatform = historicalPlatform
    .replace("Microsoft Power Platform + Dynamics 365", "Microsoft Power Platform")
    .replace("Microsoft Dynamics 365", "Microsoft Power Platform");
  const platformDiffers = normalizeText(normalizedHistoricalPlatform) !== normalizeText(currentRecommendedPlatform);

  const historicalDecisionBasis = historicalPlatformRationale(historicalPlatform, historicalRationale);
  const applicabilityToCurrent = platformDiffers
    ? "Historical decision logic remains partially relevant as precedent, but the current assessment reflects different priorities and constraints in several key areas."
    : "Historical decision rationale remains largely applicable because the current assessment reflects similar priorities, constraints, and delivery conditions.";
  const strongestContributingFactors = deriveArchitectThemesFromReasons(currentRecommendationReasons);
  const deterministicDecisionContext = platformDiffers
    ? `The current assessment emphasized enterprise shared services, operational efficiency, platform capability alignment, and organizational readiness. These factors produced the highest deterministic suitability score for ${humanPlatformName(currentRecommendedPlatform)} based on the configured architecture evaluation rules.`
    : `The deterministic engine again selected ${humanPlatformName(currentRecommendedPlatform)} because the current assessment retained the same dominant architecture, operational, and governance priorities that drove the historical decision.`;

  const summary =
    topContributors.length > 0
      ? `Similarity is ${similarityScore}% rather than 100% primarily because ${topContributors[0].toLowerCase()}`
      : `Similarity is ${similarityScore}% because key context and response patterns align strongly.`;

  const similarityInterpretation =
    similarityScore >= 75
      ? `${similarityScore}% indicates strong precedent relevance. The historical assessment is materially aligned with the current assessment across architecture, delivery model, and platform decision factors, with only moderate contextual differences.`
      : similarityScore >= 50
      ? `${similarityScore}% indicates partial precedent relevance. The historical assessment contains comparable governance, security, workflow, and platform evaluation characteristics. However, differences in business objectives, operational priorities, and platform selection drivers reduce the applicability of the historical recommendation to the current assessment.`
      : `${similarityScore}% indicates limited precedent relevance. Some contextual overlap exists, but major differences in business direction, operating model, and platform decision criteria significantly limit how much the historical recommendation should influence the current assessment.`;

  return {
    scoreByCategory: scoreByCategory.map((item) => ({
      category: item.category,
      weight: item.weight,
      score: item.score,
      matchedRationale: item.matchedRationale,
      differentiators: item.differentiators,
      reductionDrivers: item.reductionDrivers,
    })),
    overallScoreDerivation: `The initial category comparison produced a similarity score of ${weightedScore}%. Additional full-assessment narrative review adjusted confidence, resulting in a final similarity score of ${similarityScore}%.`,
    similarityInterpretation,
    matched: {
      businessContext: [...contextAnalysis.match, ...concreteMatches.slice(0, 2)],
      primaryGoal: goalAnalysis.match,
      businessAlignment: [...contextAnalysis.match, ...driverAnalysis.match, ...requirementAnalysis.match],
      businessRequirements: [...requirementAnalysis.match, ...concreteMatches.slice(2)],
      architecturalConstraints: (scoreByCategory.find((item) => item.category === "Architectural capabilities")?.matchedRationale ?? []),
      operationalRequirements: (scoreByCategory.find((item) => item.category === "Operating model")?.matchedRationale ?? []),
      platformAssessmentResponses: (scoreByCategory.find((item) => item.category === "Platform selection factors")?.matchedRationale ?? []),
    },
    notMatched: {
      majorDifferences: [...contextAnalysis.diff, ...goalAnalysis.diff, ...driverAnalysis.diff, ...requirementAnalysis.diff, ...concreteDifferences],
      uniqueRequirements: [...requirementAnalysis.unique],
      priorityDifferences: [...goalAnalysis.unique, ...driverAnalysis.unique],
      capabilityDifferences,
    },
    whyScoreNotHigher: {
      summary,
      topContributors: topContributors.slice(0, 5),
    },
    assessmentResponseComparison: {
      similarQuestionThemes,
      differentQuestionThemes,
      similarResponseThemes: scoreByCategory
        .filter((item) => item.score >= 70)
        .map((item) => categoryAlignmentEvidence(item.category)),
      differentResponseThemes: scoreByCategory
        .filter((item) => item.score < 70)
        .map((item) => categoryDivergenceEvidence(item.category)),
    },
    platformOutcomeComparison: {
      historicalDecisionBasis,
      applicabilityToCurrent,
      deterministicDecisionContext,
      strongestContributingFactors,
    },
  };
}

function parseStoredEmbeddingPayload(raw: string): StoredEmbeddingPayload | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (isNumberArray(parsed)) {
      return {
        version: 1,
        provider: "local-sentence-transformers",
        model: "all-MiniLM-L6-v2",
        contextEmbedding: parsed,
        summaryEmbedding: parsed,
        responseEmbeddings: [],
      };
    }

    if (
      parsed &&
      typeof parsed === "object" &&
      isNumberArray((parsed as any).contextEmbedding) &&
      isNumberArray((parsed as any).summaryEmbedding) &&
      Array.isArray((parsed as any).responseEmbeddings)
    ) {
      return parsed as StoredEmbeddingPayload;
    }

    return null;
  } catch {
    return null;
  }
}

function createServiceUnavailableError(assessmentId: number, cause: unknown): Error {
  const message = cause instanceof Error ? cause.message : String(cause);
  return new Error(
    `EMBEDDING_BACKEND_UNAVAILABLE: Local embedding service failed for assessment ${assessmentId}. ${message}`
  );
}

async function buildAssessmentEmbeddingPayload(assessmentId: number): Promise<StoredEmbeddingPayload> {
  const assessment = db
    .prepare(
      `SELECT business_context, business_goals, business_drivers, business_requirement
       FROM assessments
       WHERE id = ?`
    )
    .get(assessmentId) as AssessmentContextRow | undefined;

  if (!assessment) {
    throw new Error(`Assessment ${assessmentId} not found while building embeddings`);
  }

  const responseRows = db
    .prepare(
      `SELECT q.question_key, COALESCE(r.response_text, '') as response_text
       FROM responses r
       JOIN questions q ON q.id = r.question_id
       WHERE r.assessment_id = ?
       ORDER BY q.sequence`
    )
    .all(assessmentId) as AssessmentResponseRow[];

  const nonEmptyResponses = responseRows
    .map((r) => ({ questionKey: r.question_key, responseText: r.response_text.trim() }))
    .filter((r) => r.responseText.length > 0);

  const contextText =
    [assessment.business_context, assessment.business_goals, assessment.business_drivers, assessment.business_requirement]
      .filter(Boolean)
      .join(" ") || "No context provided";

  const summaryText = [
    contextText,
    ...nonEmptyResponses.map((r) => `${r.questionKey}: ${r.responseText}`),
  ].join("\n");

  try {
    const contextEmbedding = await generateEmbedding(contextText);
    const summaryEmbedding = await generateEmbedding(summaryText || contextText);
    const responseVectors = await generateEmbeddings(nonEmptyResponses.map((r) => r.responseText));

    return {
      version: 1,
      provider: "local-sentence-transformers",
      model: "all-MiniLM-L6-v2",
      contextEmbedding,
      summaryEmbedding,
      responseEmbeddings: nonEmptyResponses.map((r, i) => ({
        questionKey: r.questionKey,
        embedding: responseVectors[i] ?? [],
      })),
    };
  } catch (error) {
    throw createServiceUnavailableError(assessmentId, error);
  }
}

// ─── Embedding storage and retrieval ─────────────────────────────────────────

async function getOrCreateEmbedding(
  assessmentId: number
): Promise<StoredEmbeddingPayload> {
  // Try to load existing embedding from DB
  const existing = db
    .prepare(`SELECT context_embedding FROM assessment_embeddings WHERE assessment_id = ?`)
    .get(assessmentId) as { context_embedding: string } | undefined;

  if (existing) {
    const parsed = parseStoredEmbeddingPayload(existing.context_embedding);
    if (parsed) {
      return parsed;
    }
  }

  // Generate and persist structured embeddings
  const payload = await buildAssessmentEmbeddingPayload(assessmentId);

  try {
    db.prepare(
      `INSERT OR REPLACE INTO assessment_embeddings 
       (assessment_id, context_embedding, embedding_model, updated_at)
       VALUES (?, ?, 'all-MiniLM-L6-v2', CURRENT_TIMESTAMP)`
    ).run(assessmentId, JSON.stringify(payload));
  } catch (error) {
    throw new Error(`Failed to store embedding payload for assessment ${assessmentId}: ${String(error)}`);
  }

  return payload;
}

// ─── Main exported function ───────────────────────────────────────────────────

/**
 * Returns the top N historical assessments most similar to the given assessment,
 * using embedding-based semantic similarity on assessment summary.
 *
 * Excludes the assessment itself from results.
 */
export async function findSimilarAssessments(
  assessmentId: number,
  topN = 3,
  options?: { bypassSignalThreshold?: boolean }
): Promise<SimilarAssessment[]> {
  // Generate current assessment's recommendation and context
  const current = generateRecommendation(assessmentId);
  const currentVector = toVector(current.platformScores);

  // Check signal threshold
  const totalSignal = currentVector.reduce((s, v) => s + v, 0);
  if (!options?.bypassSignalThreshold && totalSignal < SIGNAL_THRESHOLD) return [];

  let currentPayload: StoredEmbeddingPayload;
  try {
    currentPayload = await getOrCreateEmbedding(assessmentId);
  } catch (error) {
    throw createServiceUnavailableError(assessmentId, error);
  }

  const currentAssessment = getAssessmentContext(assessmentId);
  const currentResponses = getAssessmentResponses(assessmentId);
  const currentPlatformReasons = current.platformScores.find((score) => score.platform === current.platform)?.reasons ?? [];

  // Load all historical snapshots
  const rows = db
    .prepare(
      `SELECT id, assessment_id, snapshot_json, created_at
       FROM assessment_history
       WHERE assessment_id != ?`
    )
    .all(assessmentId) as HistoryRow[];

  const candidates: Array<{ row: HistoryRow; snapshot: SnapshotData; similarityScore: number }> = [];

  for (const row of rows) {
    let snapshot: SnapshotData;
    try {
      snapshot = JSON.parse(row.snapshot_json) as SnapshotData;
    } catch {
      continue;
    }

    let historyPayload: StoredEmbeddingPayload;
    try {
      historyPayload = await getOrCreateEmbedding(row.assessment_id);
    } catch (error) {
      throw createServiceUnavailableError(row.assessment_id, error);
    }

    const embedSim = embeddingCosineSimilarity(currentPayload.summaryEmbedding, historyPayload.summaryEmbedding);
    const similarityScore = Math.round(embedSim * 100);

    candidates.push({ row, snapshot, similarityScore });
  }

  const topCandidates = candidates.sort((a, b) => b.similarityScore - a.similarityScore).slice(0, topN);

  const results: SimilarAssessment[] = [];
  for (const candidate of topCandidates) {
    const snapshot = candidate.snapshot;
    const historicalContextFromAssessment = getAssessmentContext(candidate.row.assessment_id);
    const historicalResponses = getAssessmentResponses(candidate.row.assessment_id);

    const historicalContext: SimpleContext = {
      businessContext: snapshot.businessContext ?? historicalContextFromAssessment.businessContext,
      businessGoal: snapshot.businessGoal ?? historicalContextFromAssessment.businessGoal,
      businessDriver: snapshot.businessDriver ?? historicalContextFromAssessment.businessDriver,
      businessRequirement: snapshot.businessRequirement ?? historicalContextFromAssessment.businessRequirement,
    };

    const historicalRationale = snapshot.rationale ?? getHistoricalRationale(candidate.row.assessment_id);
    const comparison = await buildDetailedComparison(
      currentAssessment,
      historicalContext,
      currentResponses,
      historicalResponses,
      candidate.similarityScore,
      current.platform,
      currentPlatformReasons,
      snapshot.platformRecommendation,
      historicalRationale
    );

    results.push({
      assessmentId: candidate.row.assessment_id,
      assessmentName: snapshot.assessmentName,
      platformRecommendation: snapshot.platformRecommendation,
      confidenceScore: snapshot.confidenceScore,
      businessContext: historicalContext.businessContext,
      businessGoal: historicalContext.businessGoal,
      businessDriver: historicalContext.businessDriver,
      businessRequirement: historicalContext.businessRequirement,
      similarityScore: Math.round(
        comparison.scoreByCategory.reduce((sum, item) => sum + item.score * item.weight, 0) /
          Math.max(1, comparison.scoreByCategory.reduce((sum, item) => sum + item.weight, 0))
      ),
      similarityMethod: "architectural-category",
      comparison,
    });
  }

  return results;
}
