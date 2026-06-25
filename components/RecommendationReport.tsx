"use client";

import { useEffect, useState } from "react";
import styles from "./RecommendationReport.module.css";
import JurisdictionScan from "./JurisdictionScan";
import InnovativeSolutions from "./InnovativeSolutions";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

type Platform = "Salesforce" | "ServiceNow" | "MicrosoftPowerPlatform" | "CustomBuild";

interface PlatformScore { platform: Platform; score: number; reasons: string[]; }
interface ScoringHit { questionKey: string; responseSnippet: string; keywordMatched: string; platformPoints: Partial<Record<Platform, number>>; }
interface EnrichedSignal {
  signalName: string;
  stageName: string;
  factorName: string;
  responseEvidence: string;
  architecturalInterpretation: string;
  whyItMatters: string;
  platformRationale: Array<{ platform: Platform; points: number; reasoning: string }>;
}
interface StepData {
  stepKey: string; stepName: string;
  factors: Array<{ id: string; name: string; description: string; subFactors: Array<{ name: string; description: string }> }>;
  questionsAndResponses: Array<{ question_key: string; question_text: string; response_text: string }>;
  answeredCount: number; totalQuestions: number;
}
interface SimilarItem {
  name: string;
  platform: string;
  similarityScore: number;
  similarityMethod: string;
  businessContext: string;
  businessGoal: string;
  businessDriver: string;
  businessRequirement: string;
  topMatchedThemes: string[];
  comparison?: {
    scoreByCategory: Array<{
      category: string;
      weight: number;
      score: number | null;
      status: "available" | "unavailable";
      matchedRationale: string[];
      differentiators: string[];
      reductionDrivers: string[];
    }>;
    overallScoreDerivation: string;
    similarityInterpretation: string;
    matched: Record<string, string[]>;
    notMatched: Record<string, string[]>;
    whyScoreNotHigher: { summary: string; topContributors: string[] };
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
interface ConfidenceBreakdown { totalQuestions: number; totalAnswered: number; completenessPercent: number; rulesMatched: number; historicalMatchesFound: number; conflictingIndicators: string[]; }
interface ConfidenceResult { score: number; label: string; basis: string; factors: string[]; }
interface KnowledgeCoverage { level: "High" | "Medium" | "Low"; explanation: string; factors: string[]; }
interface AiTransparency {
  deterministicDecisionSteps: string[];
  historicalPrecedentRetrievalSteps: string[];
  aiInputs: string[] | null;
  aiGeneratedContent: string[];
  aiUnavailable: boolean;
  noAiStatement: string | null;
}
interface HistoricalAlignment {
  matchCount: number;
  nearestMatchScore: number | null;
  lowestMatchScore: number | null;
  retrievalMethod: string;
  nonDecisionalNote: string;
}
interface PlatformFitAssessment {
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
interface AiStrategicAssessment {
  platformEvaluations: Partial<Record<Platform, PlatformFitAssessment>>;
  recommendedPlatform: Platform;
  recommendationBasis: string;
  strategicConsiderations: string[];
  riskWarnings: string[];
  opportunityWindows: string[];
}
interface AssessmentMeta { name: string; businessContext: string; businessGoals: string; businessDrivers: string; businessRequirement: string; assessmentDate: string; status: string; }
interface StoredRecommendationSummary {
  platform_recommendation: string;
  rationale: string;
  confidence_score: number;
  risks: string;
  alternatives: string;
  created_at: string;
  responsesChangedSince: boolean;
  architect_approval?: "agree" | "disagree" | null;
  architect_approval_reason?: string | null;
  architect_approval_recorded_at?: string | null;
}
interface FullRec {
  platform: Platform; displayName: string; confidenceScore: number; rationale: string; risks: string; alternatives: string;
  deterministicDecisionAuthority?: string;
  deterministicSuitabilityScore?: number;
  architectApproval?: "agree" | "disagree" | null;
  architectApprovalReason?: string | null;
  architectApprovalRecordedAt?: string | null;
  platformScores: PlatformScore[]; scoringHits: ScoringHit[]; enrichedSignals: EnrichedSignal[];
  assessmentMeta: AssessmentMeta; stepsWithData: StepData[]; historicalPrecedentMatches: SimilarItem[];
  confidenceBreakdown: ConfidenceBreakdown;
  institutionalConfidence: ConfidenceResult;
  historicalAlignment: HistoricalAlignment;
  aiAdvisoryConfidence: ConfidenceResult | null;
  aiTransparency: AiTransparency;
  aiStrategicAssessment: AiStrategicAssessment | null;
  assembledDocument?: { summary: string; platformAnalysis: string; nextSteps: string; disclaimer: string } | null;
}
interface Props {
  assessmentId: number;
  existingRecommendation?: FullRec | StoredRecommendationSummary | null;
}

const PLATFORM_DISPLAY: Record<Platform, string> = {
  Salesforce: "Salesforce (CRM + Case Management)",
  ServiceNow: "ServiceNow (ITSM + Workflow)",
  MicrosoftPowerPlatform: "Microsoft Power Platform",
  CustomBuild: "Custom Build",
};
const PLATFORM_STRENGTHS: Record<Platform, string[]> = {
  Salesforce: ["Market-leading CRM and case management capabilities", "Deep enterprise integration ecosystem (MuleSoft, APIs)", "Mature BC Government and Canadian public sector deployment history", "Robust RBAC, audit logging, and data governance controls", "Strong support for complex case lifecycle management"],
  ServiceNow: ["Best-in-class ITSM and workflow automation", "Proven for service desk, incident, and change management", "Strong operational governance and SLA management", "Enterprise-grade audit trail and compliance reporting", "Broad Canadian public sector adoption for IT operations"],
  MicrosoftPowerPlatform: ["Included within existing BC Government M365 E3/E5 licences", "Rapid low-code application development for business teams", "Native integration with Teams, SharePoint, and Azure AD", "Familiar tooling for ministry staff already using M365", "Power Automate for lightweight workflow orchestration"],
  CustomBuild: ["Full control over functionality, data model, and architecture", "No vendor lock-in or licensing dependency", "Can be tailored precisely to unique regulatory requirements", "Full ownership of IP and source code"],
};
const PLATFORM_WEAKNESSES: Record<Platform, string[]> = {
  Salesforce: ["High per-user licensing cost at scale", "Requires dedicated Salesforce admin and developer skills", "Complex integration with legacy provincial systems", "Vendor dependency for roadmap and pricing changes"],
  ServiceNow: ["Limited CRM depth for case-centric workflows", "Significant implementation effort and specialist team required", "High licensing cost for non-ITSM use cases", "Overkill for lightweight or non-ITSM business problems"],
  MicrosoftPowerPlatform: ["Governance challenges with citizen development at scale", "Limited enterprise integration without premium connectors", "Less suited for complex case lifecycle management", "Long-term viability requires architectural CoE oversight"],
  CustomBuild: ["High development cost and long delivery timeline", "Long-term maintenance burden falls on the ministry", "Significant talent dependency", "No vendor roadmap, security patching, or product evolution"],
};
const PLATFORM_ORDER: Platform[] = ["Salesforce", "ServiceNow", "MicrosoftPowerPlatform", "CustomBuild"];

function normalizePlatformLabel(label: string): string {
  if (!label) return label;
  return label
    .replace("Microsoft Power Platform + Dynamics 365", "Microsoft Power Platform")
    .replace("Microsoft Dynamics 365", "Microsoft Power Platform");
}

function confCls(label: string, s: Record<string, string>) {
  if (label === "High") return s.confHigh;
  if (label === "Medium") return s.confMedium;
  return s.confLow;
}
function barCls(score: number, s: Record<string, string>) {
  if (score >= 75) return s.barHigh;
  if (score >= 50) return s.barMedium;
  return s.barLow;
}
function kcCls(level: string, s: Record<string, string>) {
  if (level === "High") return s.kcHigh;
  if (level === "Medium") return s.kcMedium;
  return s.kcLow;
}

function SubSection({ title, badge, defaultOpen = false, children }: { title: string; badge?: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`${styles.subSection} ${open ? styles.subSectionOpen : ""}`}>
      <button type="button" className={styles.subSectionHeader} onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span className={styles.subSectionTitle}>{title}</span>
        {badge && <span className={styles.subSectionBadge}>{badge}</span>}
        <span className={styles.subSectionChevron}>{open ? "▲" : "▼"}</span>
      </button>
      <div className={`${styles.subSectionBodyWrap} ${open ? styles.openBody : styles.closedBody}`}>
        <div className={styles.subSectionBody}>{children}</div>
      </div>
    </div>
  );
}

function Section({ title, badge, defaultOpen = false, children }: { title: string; badge?: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`${styles.section} ${open ? styles.sectionOpen : ""}`}>
      <button type="button" className={styles.sectionHeader} onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span className={styles.sectionTitle}>{title}</span>
        {badge && <span className={styles.sectionBadge}>{badge}</span>}
        <span className={styles.sectionChevron}>{open ? "▲" : "▼"}</span>
      </button>
      <div className={`${styles.sectionBodyWrap} ${open ? styles.openBody : styles.closedBody}`}>
        <div className={styles.sectionBody}>{children}</div>
      </div>
    </div>
  );
}

function isFullRecommendation(data: unknown): data is FullRec {
  if (!data || typeof data !== "object") return false;
  const candidate = data as FullRec;
  return Array.isArray(candidate.platformScores) && !!candidate.assessmentMeta;
}

export default function RecommendationReport({ assessmentId, existingRecommendation }: Props) {
  const [rec, setRec] = useState<FullRec | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showExecutiveSummary, setShowExecutiveSummary] = useState(false);
  const [architectApproval, setArchitectApproval] = useState<"agree" | "disagree" | "">("");
  const [architectApprovalReason, setArchitectApprovalReason] = useState("");
  const [approvalSaving, setApprovalSaving] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState<string | null>(null);

  const loadReport = async (showError: boolean) => {
    setGenerating(true); setError(null);
    try {
      const res = await fetch(`${BASE_PATH}/api/assessment/${assessmentId}/recommend`, { method: "POST" });
      if (!res.ok) {
        let message = "Failed to generate report. Ensure responses have been saved.";
        try {
          const data = await res.json();
          if (data?.error) message = data.error;
        } catch { /* ignore parse errors */ }
        throw new Error(message);
      }
      setRec(await res.json());
    } catch (e) {
      if (showError) {
        setError(e instanceof Error ? e.message : "Failed to generate report. Ensure responses have been saved.");
      }
    }
    finally { setGenerating(false); }
  };

  const generate = async () => {
    await loadReport(true);
  };

  useEffect(() => {
    if (rec || generating) return;
    if (!existingRecommendation) return;
    if (isFullRecommendation(existingRecommendation)) {
      setRec(existingRecommendation);
    } else if (!existingRecommendation.responsesChangedSince) {
      // Nothing changed since last report — auto-generate silently
      loadReport(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingRecommendation, rec, generating]);

  useEffect(() => {
    if (!rec) return;
    const existingApproval = isFullRecommendation(existingRecommendation)
      ? existingRecommendation.architectApproval ?? ""
      : existingRecommendation?.architect_approval ?? "";
    const existingReason = isFullRecommendation(existingRecommendation)
      ? existingRecommendation.architectApprovalReason ?? ""
      : existingRecommendation?.architect_approval_reason ?? "";
    const existingRecordedAt = isFullRecommendation(existingRecommendation)
      ? existingRecommendation.architectApprovalRecordedAt ?? null
      : existingRecommendation?.architect_approval_recorded_at ?? null;

    setArchitectApproval(rec.architectApproval ?? existingApproval);
    setArchitectApprovalReason(rec.architectApprovalReason ?? existingReason);
    setApprovalStatus((rec.architectApprovalRecordedAt ?? existingRecordedAt) ? `Recorded on ${new Date(rec.architectApprovalRecordedAt ?? existingRecordedAt!).toLocaleDateString()}` : null);
  }, [rec, existingRecommendation]);

  const previousRecommendationSummary = existingRecommendation && !isFullRecommendation(existingRecommendation)
    ? existingRecommendation
    : null;

  if (!rec) return (
    <div className={styles.promptScreen}>
      <button onClick={generate} disabled={generating} className={styles.generateBtn}>
        {generating ? "Generating Report..." : "Generate Full Report"}
      </button>
      <div className={styles.promptIcon}>📋</div>
      <h3>Generate Governance Assessment Report</h3>
      <p>Produces a full explainable recommendation report — deterministic scoring, historical assessment comparison, platform evaluation, and confidence analysis — suitable for Architecture Review Board presentation.</p>
      {previousRecommendationSummary && (
        <div className={styles.existingNotice}>
          Previous: <strong>{previousRecommendationSummary.platform_recommendation}</strong> — {previousRecommendationSummary.confidence_score}% confidence on {new Date(previousRecommendationSummary.created_at).toLocaleDateString()}
        </div>
      )}
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );

  const { assessmentMeta, stepsWithData, historicalPrecedentMatches, historicalAlignment, aiTransparency, platformScores, enrichedSignals, institutionalConfidence, confidenceBreakdown } = rec;
  const allSignals = enrichedSignals ?? [];
  const metadataSignals = allSignals.filter((sig) => sig.stageName === "Assessment Metadata");
  const journeySignals = allSignals.filter((sig) => sig.stageName !== "Assessment Metadata");
  const deterministicSuitabilityScore = rec.deterministicSuitabilityScore ?? rec.confidenceScore;
  const sortedPlatformScores = [...platformScores].sort((a, b) => b.score - a.score);
  const archStepResponses = stepsWithData?.find(s => s.stepKey === "ARCHITECTURE")?.questionsAndResponses.filter(q => q.response_text?.trim()) ?? [];
  const hasOtherFactors = !!rec.aiStrategicAssessment;
  const dominantHistorical = (() => {
    if (!historicalPrecedentMatches || historicalPrecedentMatches.length === 0) {
      return "no historical platform trend";
    }
    const counts = historicalPrecedentMatches.reduce<Record<string, number>>((acc, item) => {
      const normalized = normalizePlatformLabel(item.platform);
      acc[normalized] = (acc[normalized] ?? 0) + 1;
      return acc;
    }, {});
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return top ? `${top[0]} (${top[1]} case${top[1] === 1 ? "" : "s"})` : "no historical platform trend";
  })();

  const submitArchitectApproval = async () => {
    if (!architectApproval) {
      setApprovalStatus("Select agree or disagree before saving.");
      return;
    }
    if (architectApproval === "disagree" && !architectApprovalReason.trim()) {
      setApprovalStatus("Please provide a brief reason for disagreement.");
      return;
    }

    setApprovalSaving(true);
    setApprovalStatus(null);
    try {
      const response = await fetch(`${BASE_PATH}/api/assessment/${assessmentId}/recommend/approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approval: architectApproval, reason: architectApprovalReason.trim() || null }),
      });

      if (!response.ok) {
        throw new Error("Failed to save architect approval");
      }

      const updated = await response.json();
      setRec((current) => (current ? { ...current, ...updated } : current));
      setApprovalStatus("Architect approval saved.");
    } catch {
      setApprovalStatus("Unable to save architect approval.");
    } finally {
      setApprovalSaving(false);
    }
  };

  return (
    <div className={styles.report}>
      <div className={styles.reportHeader}>
        <div>
          <h2>Enterprise Architecture Assessment Report</h2>
          <span className={styles.reportSubtitle}>{assessmentMeta?.name} — BC Government EAAF Platform Evaluation</span>
        </div>
        <div style={{ display: "flex", gap: ".5rem", alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={generate} disabled={generating} className={styles.regenerateBtn}>{generating ? "Generating..." : "(Re)generate Full Report"}</button>
          <button onClick={() => setShowExecutiveSummary(v => !v)} className={styles.execSummaryBtn}>{showExecutiveSummary ? "Hide Executive Summary" : "Show Executive Summary"}</button>
          <button onClick={() => window.print()} className={styles.printBtn}>Print Full Report</button>
        </div>
      </div>

      {showExecutiveSummary && (
        <div className={styles.execPanel}>
          <h3 className={styles.execPanelTitle}>Executive Summary</h3>
          <div className={styles.execGrid}>
            <div className={styles.execSection}>
              <div className={styles.execLabel}>Business Problem</div>
              <div className={styles.execValue}>{assessmentMeta?.businessContext || assessmentMeta?.businessGoals || "Not specified"}</div>
            </div>
            <div className={styles.execSection}>
              <div className={styles.execLabel}>Drivers</div>
              <div className={styles.execValue}>{assessmentMeta?.businessDrivers || "Not specified"}</div>
            </div>
            <div className={styles.execSection}>
              <div className={styles.execLabel}>Requirements</div>
              <div className={styles.execValue}>{assessmentMeta?.businessRequirement || "Not specified"}</div>
            </div>
            <div className={styles.execSection}>
              <div className={styles.execLabel}>Current State</div>
              <div className={styles.execValue}>
                {archStepResponses.length === 0 ? (
                  <span>Not captured in assessment.</span>
                ) : (
                  <ul className={styles.execList}>
                    {archStepResponses.slice(0, 5).map((q, i) => (
                      <li key={i}><strong>{q.question_text}:</strong> {q.response_text}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <div className={styles.execSection}>
              <div className={styles.execLabel}>Proposed Solution</div>
              <div className={styles.execValue}>
                <strong>{rec.displayName}</strong>{rec.rationale ? ` — ${rec.rationale}` : ""}
              </div>
            </div>
            <div className={styles.execSection}>
              <div className={styles.execLabel}>Assessment Findings</div>
              <div className={styles.execValue}>
                <div>Recommended: <strong>{rec.displayName}</strong> — {institutionalConfidence?.label ?? "Low"} institutional confidence at <strong>{institutionalConfidence?.score ?? rec.confidenceScore}%</strong></div>
                <div style={{ marginTop: ".35rem" }}>{confidenceBreakdown?.rulesMatched ?? 0} scoring signals from {confidenceBreakdown?.totalAnswered ?? 0}/{confidenceBreakdown?.totalQuestions ?? 0} questions answered</div>
                {(institutionalConfidence?.factors?.length ?? 0) > 0 && (
                  <ul className={styles.execList} style={{ marginTop: ".4rem" }}>
                    {institutionalConfidence!.factors.slice(0, 3).map((f, i) => <li key={i}>{f}</li>)}
                  </ul>
                )}
                <div className={styles.execPlatformRanking}>
                  {sortedPlatformScores.slice(0, 4).map(({ platform: p, score }) => (
                    <span key={p} className={`${styles.execPlatformChip} ${p === rec.platform ? styles.execPlatformWinner : ""}`}>
                      {PLATFORM_DISPLAY[p]}: {score}/100
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={styles.finalRecommendationHero}>
        <h3 className={styles.finalRecommendationTitle}>FINAL RECOMMENDATION: {rec.displayName}</h3>
        <div className={styles.finalRecommendationSummary}>
          <div className={styles.finalRecommendationSummaryItem}>
            <strong>Institutional Knowledge Confidence:</strong> {institutionalConfidence?.label ?? "Low"} at {institutionalConfidence?.score ?? rec.confidenceScore}%
          </div>
          <div className={styles.finalRecommendationSummaryItem}>
            <strong>Historical Evidence:</strong> {historicalPrecedentMatches?.length ?? 0} similar case{(historicalPrecedentMatches?.length ?? 0) === 1 ? "" : "s"}, dominant historical platform used: {dominantHistorical}
          </div>
          <div className={styles.finalRecommendationSummaryItem}>
            <strong>Assessment Signals:</strong> {confidenceBreakdown?.rulesMatched ?? 0} signals received in the assessment journey
          </div>
          <div className={styles.finalRecommendationSummaryItem}>
            <strong>Response Completeness:</strong> {confidenceBreakdown?.totalAnswered ?? 0} out of {confidenceBreakdown?.totalQuestions ?? 0} questions were answered
          </div>
        </div>
      </div>

      {/* 1 — ASSESSMENT OVERVIEW */}
      <Section title="1 — Assessment Overview" badge="Scope and Context" defaultOpen={false}>
        <div className={styles.overviewBlock}>
          <p className={styles.overviewNarrative}>
            This Enterprise Architecture Assessment evaluated platform options for <strong>{assessmentMeta?.name}</strong>.{assessmentMeta?.businessContext ? ` ${assessmentMeta.businessContext}` : ""}
          </p>
          <div className={styles.metaGrid}>
            <div className={styles.metaItem}><span className={styles.metaLabel}>Business Requirement</span><span className={styles.metaValue}>{assessmentMeta?.businessRequirement || "Not specified"}</span></div>
            <div className={styles.metaItem}><span className={styles.metaLabel}>Primary Goal</span><span className={styles.metaValue}>{assessmentMeta?.businessGoals || "Not specified"}</span></div>
            <div className={styles.metaItem}><span className={styles.metaLabel}>Primary Driver</span><span className={styles.metaValue}>{assessmentMeta?.businessDrivers || "Not specified"}</span></div>
            <div className={styles.metaItem}><span className={styles.metaLabel}>Assessment Date</span><span className={styles.metaValue}>{assessmentMeta ? new Date(assessmentMeta.assessmentDate).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" }) : "—"}</span></div>
            <div className={styles.metaItem}><span className={styles.metaLabel}>Assessment Status</span><span className={styles.metaValue}>{assessmentMeta?.status ?? "—"}</span></div>
          </div>
        </div>
      </Section>

      {/* 2 — ASSESSMENT JOURNEY */}
      <Section title="2 — Assessment Journey" badge={`${confidenceBreakdown?.totalAnswered ?? 0} of ${confidenceBreakdown?.totalQuestions ?? 0} questions answered`} defaultOpen={false}>
        <p className={styles.logicIntro}>The following four evaluation stages were completed as part of this assessment. Each stage collected architect responses against defined factors and sub-factors. Findings indicate how each stage influenced the final recommendation.</p>
        {stepsWithData?.map(step => (
          <SubSection key={step.stepKey} title={step.stepName} badge={`${step.answeredCount} of ${step.totalQuestions} answered`} defaultOpen={false}>
            <div className={styles.factorSection}>
              {step.factors.map(f => (
                <div key={f.id} className={styles.factorBlock}>
                  <div className={styles.factorTitle}>{f.name}</div>
                  {f.subFactors.length > 0 && (
                    <div className={styles.subFactorRow}>
                      {f.subFactors.map((sf, i) => <span key={i} className={styles.subFactorPill}>{sf.name}</span>)}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {step.questionsAndResponses.filter(q => q.response_text?.trim()).length > 0 && (
              <div className={styles.responseEvidence}>
                <div className={styles.responseEvidenceLabel}>Responses Collected</div>
                {step.questionsAndResponses.filter(q => q.response_text?.trim()).map(q => (
                  <div key={q.question_key} className={styles.responseRow}>
                    <div className={styles.responseQ}>{q.question_text}</div>
                    <div className={styles.responseA}>{q.response_text}</div>
                  </div>
                ))}
              </div>
            )}
            {step.answeredCount === 0 && (
              <div className={styles.stageSkipped}>No responses collected for this stage — stage was not evaluated.</div>
            )}
          </SubSection>
        ))}
      </Section>

      {/* 3 — ASSESSMENT SIGNALS AND SCORING EVIDENCE */}
      <Section title="3 — Assessment Signals and Scoring Evidence" badge={`${allSignals.length} signal${allSignals.length === 1 ? "" : "s"}`} defaultOpen={false}>
        <p className={styles.logicIntro}>
          Full scoring evidence is shown below. Assessment Metadata signals are listed separately, followed by stage-based assessment signals. Each signal includes response evidence, interpretation, why it matters, and platform impact.
        </p>

        {metadataSignals.length > 0 && (
          <SubSection title="Assessment Metadata Signals" badge={`${metadataSignals.length}`} defaultOpen={false}>
            <p className={styles.sectionExplanation}>These signals come from Business Context, Business Goals, Business Drivers, and Business Requirement fields captured before question-level scoring.</p>
            {metadataSignals.map((sig, i) => (
              <SubSection key={`meta-${i}`} title={sig.signalName} badge={`${sig.stageName} › ${sig.factorName}`} defaultOpen={false}>
                <div className={styles.signalBody}>
                  <div className={styles.signalRow}><div className={styles.signalRowLabel}>Response Evidence</div><div className={styles.signalEvidence}>&quot;{sig.responseEvidence}&quot;</div></div>
                  <div className={styles.signalRow}><div className={styles.signalRowLabel}>Architectural Interpretation</div><div className={styles.signalText}>{sig.architecturalInterpretation}</div></div>
                  <div className={styles.signalRow}><div className={styles.signalRowLabel}>Why This Matters</div><div className={styles.signalText}>{sig.whyItMatters}</div></div>
                  <div className={styles.signalRow}>
                    <div className={styles.signalRowLabel}>Platform Impact</div>
                    <div className={styles.platformImpactList}>
                      {sig.platformRationale.map((pr, j) => (
                        <div key={j} className={`${styles.platformImpactItem} ${pr.points > 0 ? styles.impactPos : styles.impactNeg}`}>
                          <span className={styles.impactPts}>{pr.points > 0 ? `+${pr.points}` : pr.points} pts</span>
                          <span className={styles.impactPlatform}>{pr.platform === "MicrosoftPowerPlatform" ? "Microsoft Power Platform" : pr.platform}</span>
                          <span className={styles.impactReason}>{pr.reasoning}</span>
                        </div>
                      ))}
                      {PLATFORM_ORDER.filter(p => !sig.platformRationale.some(pr => pr.platform === p)).map((platform, j) => {
                        const favored = sig.platformRationale.filter(pr => pr.points > 0).map(pr => pr.platform === "MicrosoftPowerPlatform" ? "Microsoft Power Platform" : pr.platform).join(", ");
                        return (<div key={`mu-${j}`} className={`${styles.platformImpactItem} ${styles.impactNeg}`}><span className={styles.impactPts}>0 pts</span><span className={styles.impactPlatform}>{platform === "MicrosoftPowerPlatform" ? "Microsoft Power Platform" : platform}</span><span className={styles.impactReason}>Not matched for this signal. Response evidence aligned more strongly with {favored || "other platform criteria"}.</span></div>);
                      })}
                    </div>
                  </div>
                </div>
              </SubSection>
            ))}
          </SubSection>
        )}

        {journeySignals.length > 0 ? (
          <SubSection title="Stage-Based Assessment Signals" badge={`${journeySignals.length}`} defaultOpen={false}>
            <p className={styles.sectionExplanation}>These signals are derived from Architecture, Cloud, Platform, and Operational stage responses.</p>
            {journeySignals.map((sig, i) => (
              <SubSection key={i} title={sig.signalName} badge={`${sig.stageName} › ${sig.factorName}`} defaultOpen={false}>
                <div className={styles.signalBody}>
                  <div className={styles.signalRow}><div className={styles.signalRowLabel}>Response Evidence</div><div className={styles.signalEvidence}>&quot;{sig.responseEvidence}&quot;</div></div>
                  <div className={styles.signalRow}><div className={styles.signalRowLabel}>Architectural Interpretation</div><div className={styles.signalText}>{sig.architecturalInterpretation}</div></div>
                  <div className={styles.signalRow}><div className={styles.signalRowLabel}>Why This Matters</div><div className={styles.signalText}>{sig.whyItMatters}</div></div>
                  <div className={styles.signalRow}>
                    <div className={styles.signalRowLabel}>Platform Impact</div>
                    <div className={styles.platformImpactList}>
                      {sig.platformRationale.map((pr, j) => (
                        <div key={j} className={`${styles.platformImpactItem} ${pr.points > 0 ? styles.impactPos : styles.impactNeg}`}>
                          <span className={styles.impactPts}>{pr.points > 0 ? `+${pr.points}` : pr.points} pts</span>
                          <span className={styles.impactPlatform}>{pr.platform === "MicrosoftPowerPlatform" ? "Microsoft Power Platform" : pr.platform}</span>
                          <span className={styles.impactReason}>{pr.reasoning}</span>
                        </div>
                      ))}
                      {PLATFORM_ORDER.filter(p => !sig.platformRationale.some(pr => pr.platform === p)).map((platform, j) => {
                        const favored = sig.platformRationale.filter(pr => pr.points > 0).map(pr => pr.platform === "MicrosoftPowerPlatform" ? "Microsoft Power Platform" : pr.platform).join(", ");
                        return (<div key={`ju-${j}`} className={`${styles.platformImpactItem} ${styles.impactNeg}`}><span className={styles.impactPts}>0 pts</span><span className={styles.impactPlatform}>{platform === "MicrosoftPowerPlatform" ? "Microsoft Power Platform" : platform}</span><span className={styles.impactReason}>Not matched for this signal. Response evidence aligned more strongly with {favored || "other platform criteria"}.</span></div>);
                      })}
                    </div>
                  </div>
                </div>
              </SubSection>
            ))}
          </SubSection>
        ) : (
          <div className={styles.noSignals}>No assessment signals were detected. Ensure substantive responses have been entered for all stages before generating this report.</div>
        )}
      </Section>

      {/* 4 — PLATFORM COMPARISON */}
      <Section title="4 — Platform Evaluation" badge="All platforms assessed" defaultOpen={false}>
        <p className={styles.logicIntro}>All four BC Government approved platforms were evaluated against assessment signals. Suitability scores are normalised to 0–100. Platforms that scored lower are included to demonstrate that all options were considered and why each was not selected.</p>
        <div className={styles.platformGrid}>
          {sortedPlatformScores.map(({ platform: p, score }) => {
            const ps = platformScores.find(s => s.platform === p);
            const isWinner = p === rec.platform;
            return (
              <SubSection key={p} title={`${PLATFORM_DISPLAY[p]}${isWinner ? " — RECOMMENDED" : ""}`} badge={`${score}/100`} defaultOpen={isWinner}>
                <div className={styles.platformCardHeader}>
                  <span className={styles.platformCardName}>{PLATFORM_DISPLAY[p]}</span>
                  {isWinner && <span className={styles.winnerTag}>RECOMMENDED</span>}
                </div>
                <div className={styles.platformScoreRow}>
                  <div className={styles.miniTrack}><div className={`${styles.miniBar} ${barCls(score, styles)}`} style={{ width: `${score}%` }} /></div>
                  <span className={styles.scoreLabel}>Suitability: {score}/100</span>
                </div>
                <div className={styles.swotRow}>
                  <div className={styles.swotBlock}>
                    <span className={styles.swotLabel}>Strengths</span>
                    <ul className={styles.swotList}>{PLATFORM_STRENGTHS[p].map((s, i) => <li key={i}>{s}</li>)}</ul>
                  </div>
                  <div className={styles.swotBlock}>
                    <span className={styles.swotLabel}>Weaknesses</span>
                    <ul className={`${styles.swotList} ${styles.swotWeak}`}>{PLATFORM_WEAKNESSES[p].map((s, i) => <li key={i}>{s}</li>)}</ul>
                  </div>
                </div>
                {(() => {
                  const relevantSignals = enrichedSignals?.filter(sig =>
                    sig.platformRationale.some(pr => pr.platform === p && pr.points > 0)
                  ) ?? [];
                  const missedSignals = enrichedSignals?.filter(sig =>
                    !sig.platformRationale.some(pr => pr.platform === p)
                  ) ?? [];
                  return relevantSignals.length > 0 ? (
                    <div className={styles.platformSignals}>
                      <span className={styles.swotLabel}>Assessment evidence that scored this platform</span>
                      <ul className={styles.signalReasonList}>
                        {relevantSignals.map((sig, i) => {
                          const pr = sig.platformRationale.find(pr => pr.platform === p);
                          return <li key={i}><strong>{sig.signalName}</strong> — {pr ? `+${pr.points} pts` : ""}</li>;
                        })}
                      </ul>
                      {missedSignals.length > 0 && (
                        <>
                          <span className={styles.swotLabel}>Why other signals did not score this platform</span>
                          <ul className={styles.signalReasonList}>
                            {missedSignals.slice(0, 3).map((sig, i) => {
                              const favored = sig.platformRationale
                                .filter((pr) => pr.points > 0)
                                .map((pr) => pr.platform === "MicrosoftPowerPlatform" ? "Microsoft Power Platform" : pr.platform)
                                .join(", ");
                              return <li key={`miss-${i}`}><strong>{sig.signalName}</strong> — no points because this evidence favored {favored || "other platforms"}.</li>;
                            })}
                          </ul>
                        </>
                      )}
                    </div>
                  ) : ps && ps.reasons.length > 0 ? (
                    <div className={styles.platformSignals}>
                      <span className={styles.swotLabel}>Scoring evidence</span>
                      <ul className={styles.signalReasonList}>{ps.reasons.map((r, i) => <li key={i}>{r.replace(/^[A-Z_\d]+ response signals /, "Signal: ").replace(/\s*\([+-]\d+pts\)$/, "")}</li>)}</ul>
                    </div>
                  ) : null;
                })()}
                {!isWinner && <div className={styles.notSelectedNote}>Not selected: {score === 0 ? "No assessment signals aligned with this platform." : `Suitability score (${score}/100) was lower than the recommended platform.`}</div>}
              </SubSection>
            );
          })}
        </div>

        {hasOtherFactors && rec.aiStrategicAssessment && (
          <SubSection title="Other Factors" badge="Context only" defaultOpen={false}>
            <p className={styles.sectionExplanation}>
              The following contextual factors help explain delivery fit after the ranked platform assessment above has already been completed. They do not change the platform ranking or scoring outcome.
            </p>
            <div className={styles.aiPlatformGrid}>
              {sortedPlatformScores.map(({ platform: p }) => {
                const eval_ = rec.aiStrategicAssessment!.platformEvaluations[p];
                if (!eval_) return null;
                const otherFactorsLabel = p === "MicrosoftPowerPlatform" ? "Microsoft Power Platform" : PLATFORM_DISPLAY[p];
                return (
                  <div key={p} className={styles.aiPlatformCard}>
                    <div className={styles.aiCardHeader}>
                      <span className={styles.aiPlatformName}>{otherFactorsLabel}</span>
                      <span className={styles.otherFactorsTag}>Context only</span>
                    </div>

                    <div className={styles.aiCardSection}>
                      <div className={styles.aiCardLabel}>Organizational Readiness</div>
                      <div className={styles.aiReadinessRow}>
                        <div className={styles.aiReadinessBar}>
                          <div className={styles.aiReadinessFill} style={{ width: `${(eval_.organizationalReadiness / 10) * 100}%` }} />
                        </div>
                        <span className={styles.aiReadinessScore}>{eval_.organizationalReadiness}/10</span>
                      </div>
                      <p className={styles.aiCardText}>{eval_.readinessSummary}</p>
                    </div>

                    <div className={styles.aiCardSection}>
                      <div className={styles.aiCardLabel}>Timeline & Delivery</div>
                      <div className={styles.aiTimelineBox}>
                        {eval_.timelineRisks.length > 0 && (
                          <div className={styles.aiTimelineRisks}>
                            {eval_.timelineRisks.map((r, i) => <div key={i} className={styles.aiRiskItem}>⚠ {r}</div>)}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className={styles.aiCardSection}>
                      <div className={styles.aiCardLabel}>Team Capability Gap</div>
                      <div className={`${styles.aiCapabilityBadge} ${eval_.teamCapabilityGap === "Low" ? styles.capLow : eval_.teamCapabilityGap === "Medium" ? styles.capMedium : styles.capHigh}`}>
                        {eval_.teamCapabilityGap}
                      </div>
                      <p className={styles.aiCardText}>{eval_.teamCapabilityNarrative}</p>
                    </div>

                    <div className={styles.aiCardSection}>
                      <div className={styles.aiCardLabel}>Governance & Compliance Risk</div>
                      <div className={`${styles.aiRiskBadge} ${eval_.governanceRiskLevel === "Low" ? styles.riskLow : eval_.governanceRiskLevel === "Medium" ? styles.riskMedium : styles.riskHigh}`}>
                        {eval_.governanceRiskLevel}
                      </div>
                      <p className={styles.aiCardText}>{eval_.governanceRiskExplanation}</p>
                    </div>

                    <div className={styles.aiCardSection}>
                      <div className={styles.aiCardLabel}>Strategic Alignment with BC Government</div>
                      <p className={styles.aiCardText}>{eval_.strategicAlignment}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {rec.aiStrategicAssessment!.riskWarnings.length > 0 && (
              <div className={styles.aiWarnings}>
                <strong>⚠ Risk Warnings</strong>
                <ul>{rec.aiStrategicAssessment!.riskWarnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
              </div>
            )}
          </SubSection>
        )}
      </Section>

      {/* 5 — RULES BASED DECISION ENGINE */}
      <Section title="5 — Rules Based Decision Engine (Institutional Logic)" badge="Primary Decision Authority">
        <div className={styles.rulesBasis}>
          <p className={styles.rulesExplanation}>
            <strong>This section contains the deterministic platform decision made by the Rules Based Decision Engine. This decision is based entirely on predefined architecture rules, factor weights, and scoring logic defined by enterprise architects. This process contains no artificial intelligence, no historical precedent, and no subjective interpretation.</strong>
          </p>
        </div>
        <div className={styles.institutionalCard}>
          <div className={styles.institutionalHeader}>
            <div>
              <span className={styles.institutionalLabel}>Rules Based Decision Engine Output</span>
              <h3 className={styles.institutionalPlatform}>{rec.displayName}</h3>
            </div>
            <div className={`${styles.instConfBadge} ${confCls(institutionalConfidence?.label ?? "Low", styles)}`}>
              {institutionalConfidence?.label ?? "Low"} Confidence — {institutionalConfidence?.score ?? rec.confidenceScore}%
            </div>
          </div>
          <div className={styles.instConfBar}>
            <div className={`${styles.instConfFill} ${barCls(institutionalConfidence?.score ?? 0, styles)}`} style={{ width: `${institutionalConfidence?.score ?? 0}%` }} />
          </div>
          <div className={styles.instBasis}>
            <strong>Deterministic Suitability Score:</strong> {deterministicSuitabilityScore}%
          </div>
          <div className={styles.instBasis}>
            <strong>Institutional Confidence Basis:</strong> {institutionalConfidence?.basis}
          </div>
          <div className={styles.instFactors}>
            {institutionalConfidence?.factors?.map((f, i) => (
              <div key={i} className={styles.instFactor}>
                <span className={styles.instFactorDot} />
                {f}
              </div>
            ))}
          </div>
          <div className={styles.instRationale}>
            <strong>Supporting Rationale</strong>
            <p>{rec.rationale}</p>
          </div>
        </div>
        <div className={styles.rulesBasisDetail}>
          <strong>Decision Process Transparency:</strong>
          <p>The platform selection above was produced by deterministic execution of the following defined processing steps. This process is fully auditable and reproducible.</p>
          {aiTransparency?.deterministicDecisionSteps && aiTransparency.deterministicDecisionSteps.length > 0 && (
            <ul className={styles.transpList}>{aiTransparency.deterministicDecisionSteps.map((s, i) => <li key={i}>{s}</li>)}</ul>
          )}
        </div>
      </Section>

      {/* 6 — HISTORICAL SIMILARITY EVIDENCE */}
      <Section title="6 — Historical Similarity Evidence" badge="Context Only" defaultOpen={false}>
        <div className={styles.historicalSimilaritySection}>
          <p className={styles.sectionExplanation}>
            Historical assessment data from prior architecture evaluations is shown here as context only. It does not alter the deterministic recommendation above.
          </p>
          {historicalPrecedentMatches?.length > 0 ? (
            <div className={styles.historicalSimilarityCards}>
              {historicalPrecedentMatches.map((s, i) => (
                <SubSection key={i} title={s.name} badge={`${s.similarityScore}% similar · ${normalizePlatformLabel(s.platform)}`} defaultOpen={false}>
                  <div className={styles.historicalCardRow}><span className={styles.historicalCardLabel}>Prior Platform Selected:</span><span className={styles.historicalCardValue}>{normalizePlatformLabel(s.platform)}</span></div>
                  <div className={styles.historicalCardRow}><span className={styles.historicalCardLabel}>Business Context:</span><span className={styles.historicalCardValue}>{s.businessContext}</span></div>
                  <div className={styles.historicalCardRow}><span className={styles.historicalCardLabel}>Primary Goal:</span><span className={styles.historicalCardValue}>{s.businessGoal}</span></div>
                  <div className={styles.historicalCardRow}><span className={styles.historicalCardLabel}>Business Alignment:</span><span className={styles.historicalCardValue}>{s.businessDriver}</span></div>
                  <div className={styles.historicalCardRow}><span className={styles.historicalCardLabel}>Business Requirement:</span><span className={styles.historicalCardValue}>{s.businessRequirement}</span></div>
                  {s.topMatchedThemes?.length > 0 && (
                    <SubSection title="Top matched themes" defaultOpen={false}>
                      <ul className={styles.historicalList}>{s.topMatchedThemes.map((item, idx) => <li key={`tm-${idx}`}>{item}</li>)}</ul>
                    </SubSection>
                  )}
                  {s.comparison && (
                    <>
                      <SubSection title="Similarity score derivation by category" defaultOpen={false}>
                        {s.comparison.scoreByCategory.map((item, idx) => (
                          <div key={`cat-${idx}`} className={styles.categoryScoreBlock}>
                            <div className={styles.categoryScoreHeader}>
                              <span className={styles.categoryScoreName}>{item.category}</span>
                              <span className={styles.categoryScoreWeight}>weight {item.weight}%</span>
                              <span className={item.status === "unavailable" ? styles.categoryScoreUnavailable : styles.categoryScoreValue}>
                                {item.status === "unavailable" ? "Unavailable — excluded from weighted score" : `${item.score}/100`}
                              </span>
                            </div>
                            {item.matchedRationale.length > 0 && (
                              <ul className={styles.categoryScoreDetail}>
                                {item.matchedRationale.map((r, i) => (
                                  <li key={`mr-${i}`} className={styles.categoryScoreMatch}>&#10003; {r}</li>
                                ))}
                              </ul>
                            )}
                            {item.differentiators.length > 0 && (
                              <ul className={styles.categoryScoreDetail}>
                                {item.differentiators.map((r, i) => (
                                  <li key={`df-${i}`} className={styles.categoryScoreDiff}>&#8594; {r}</li>
                                ))}
                              </ul>
                            )}
                            {item.reductionDrivers.length > 0 && (
                              <ul className={styles.categoryScoreDetail}>
                                {item.reductionDrivers.map((r, i) => (
                                  <li key={`rd-${i}`} className={styles.categoryScoreReduction}>&#9660; {r}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                      </SubSection>
                      <SubSection title="Interpretation of similarity score" defaultOpen={false}>
                        <p className={styles.sectionExplanation}>{s.comparison.similarityInterpretation}</p>
                        <p className={styles.sectionExplanation}>{s.comparison.overallScoreDerivation}</p>
                      </SubSection>
                      <SubSection title="What specifically matched" defaultOpen={false}>
                        <ul className={styles.historicalList}>{Object.values(s.comparison.matched).flat().filter(Boolean).slice(0, 8).map((item, idx) => <li key={`match-${idx}`}>{item}</li>)}</ul>
                      </SubSection>
                      <SubSection title="What specifically did not match" defaultOpen={false}>
                        <ul className={styles.historicalList}>{Object.values(s.comparison.notMatched).flat().filter(Boolean).slice(0, 8).map((item, idx) => <li key={`diff-${idx}`}>{item}</li>)}</ul>
                      </SubSection>
                      <SubSection title="Why similarity is not higher" defaultOpen={false}>
                        <p className={styles.sectionExplanation}>{s.comparison.whyScoreNotHigher.summary}</p>
                        <ul className={styles.historicalList}>{s.comparison.whyScoreNotHigher.topContributors.map((item, idx) => <li key={`why-${idx}`}>{item}</li>)}</ul>
                      </SubSection>
                    </>
                  )}
                </SubSection>
              ))}
            </div>
          ) : (
            <div className={styles.noHistoricalData}>
              <p>No historical assessments were found with sufficient similarity to this evaluation.</p>
            </div>
          )}
          {historicalAlignment?.nonDecisionalNote && (
            <p className={styles.historicalNondecisional}>{historicalAlignment.nonDecisionalNote}</p>
          )}
        </div>
      </Section>

      {/* 7 — DECISION CONFIDENCE CLASSIFICATION */}
      <Section title="7 — Decision Confidence Classification" badge="Governance Interpretation" defaultOpen={false}>
        <div className={styles.confidenceClassification}>
          <p className={styles.ccIntro}>
            This classification synthesizes the strength of deterministic decision engine output with the depth of historical assessment precedent available. This classification is for governance interpretation and transparency only and does not affect the platform selection above.
          </p>
          
          {(() => {
            const deterministicStrength = institutionalConfidence?.score ?? 50;

            // Historical strength requires both sufficient matches AND platform alignment with current recommendation.
            // Matches pointing to a different platform are contextual evidence only, not supporting precedent.
            const alignedMatches = (historicalPrecedentMatches ?? []).filter((m: SimilarItem) => {
              const hist = normalizePlatformLabel(m.platform).toLowerCase().replace(/\s+/g, "");
              const curr = (rec?.displayName ?? rec?.platform ?? "").toLowerCase().replace(/\s+/g, "");
              return hist === curr || hist.includes(curr.slice(0, 8)) || curr.includes(hist.slice(0, 8));
            });
            const totalMatches = historicalPrecedentMatches?.length ?? 0;
            const historicalStrength = alignedMatches.length >= 2 ? 75
              : alignedMatches.length === 1 ? 40
              : totalMatches >= 2 ? 20   // matches exist but none align — weak
              : totalMatches === 1 ? 10
              : 0;
            const isDeterministicStrong = deterministicStrength >= 60;
            const isHistoricalStrong = historicalStrength >= 60;

            let classification = "";
            let classificationDetail = "";
            let classStyle = "";
            
            if (isDeterministicStrong && isHistoricalStrong) {
              classification = "Strong Deterministic Plus Strong Historical Support";
              classificationDetail = "Deterministic platform selection is supported by both strong internal scoring signals and strong historical assessment precedent. This represents the highest confidence governance case.";
              classStyle = styles.ccStrong;
            } else if (isDeterministicStrong && !isHistoricalStrong) {
              classification = "Strong Deterministic Plus Weak Historical Support";
              classificationDetail = alignedMatches.length === 0 && totalMatches > 0
                ? `Deterministic platform selection is strong and defensible on its own merits. Historical precedent exists but all similar assessments selected a different platform. Historical evidence does not reinforce the current recommendation and should be treated as divergent context rather than supporting precedent.`
                : "Deterministic platform selection is strong and defensible on its own merits. Limited aligned historical precedent is available but does not contradict the deterministic finding.";
              classStyle = styles.ccMediumHigh;
            } else if (!isDeterministicStrong && isHistoricalStrong) {
              classification = "Weak Deterministic Plus Strong Historical Support";
              classificationDetail = "Historical assessment precedent strongly validates the platform direction even though deterministic scoring confidence is moderate. History provides reinforcing context for the decision.";
              classStyle = styles.ccMediumLow;
            } else {
              classification = "Weak Deterministic Plus Weak Historical Support";
              classificationDetail = "Both deterministic confidence and historical precedent are limited. The recommendation should be treated as provisional and requires additional human expert review and validation.";
              classStyle = styles.ccWeak;
            }
            
            return (
              <div className={`${styles.confidenceClassBox} ${classStyle}`}>
                <div className={styles.ccHeader}>
                  <div className={styles.ccTitle}>{classification}</div>
                </div>
                <div className={styles.ccBody}>
                  <p>{classificationDetail}</p>
                  <div className={styles.ccMetrics}>
                    <div className={styles.ccMetric}>
                      <span className={styles.ccMetricLabel}>Deterministic Strength:</span>
                      <span className={styles.ccMetricValue}>{deterministicStrength}% ({isDeterministicStrong ? "Strong" : "Moderate/Weak"})</span>
                    </div>
                    <div className={styles.ccMetric}>
                      <span className={styles.ccMetricLabel}>Historical Precedent:</span>
                      <span className={styles.ccMetricValue}>
                        {totalMatches} similar assessments found — {alignedMatches.length} aligned with current recommendation
                        {totalMatches > 0 && alignedMatches.length === 0 ? " (all historical precedents selected a different platform)" : ""}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
        <div className={styles.govFooter}>
          <strong>Governance Statement</strong>
          <p>
            This report was produced by the BC Government Enterprise Architecture Assessment Framework (EAAF) automated evaluation tool. The platform decision above is made exclusively by the Rules Based Decision Engine using {confidenceBreakdown?.totalAnswered ?? 0} architect responses across {stepsWithData?.length ?? 0} evaluation stages and {confidenceBreakdown?.rulesMatched ?? 0} deterministic scoring signals. Historical precedent and contextual material in this report are supporting context only and do not influence the platform selection. This report is intended to support, not replace, human expert judgment. The assigned Enterprise Architect retains full accountability for the final platform decision and governance submission.
          </p>
        </div>
      </Section>

      {/* 8 — JURISDICTION SCAN */}
      <Section title="8 — Jurisdiction Scan" badge="AI-Assisted" defaultOpen={false}>
        <p className={styles.sectionExplanation}>
          Identifies real-world Canadian public sector implementations most closely aligned with this
          assessment&apos;s business problem, drivers, requirements, current state, and proposed solution.
          Results are generated by an AI model and require independent verification before use
          in governance submissions. Requires <code>JURISDICTION_AI_KEY</code> and <code>JURISDICTION_AI_ENDPOINT</code> in <code>.env.local</code>.
        </p>
        <JurisdictionScan assessmentId={assessmentId} />
      </Section>

      {/* 9 — AI-ASSISTED INNOVATIVE SOLUTIONS */}
      <Section title="9 — AI-Assisted Innovative Solutions" badge="AI-Assisted" defaultOpen={false}>
        <p className={styles.sectionExplanation}>
          Exploratory AI-generated alternatives and architectural variations related to the proposed solution.
          These ideas are intended to broaden architectural thinking and are not recommendations.
          They do not influence the deterministic platform decision.
          Requires <code>JURISDICTION_AI_KEY</code> and <code>JURISDICTION_AI_ENDPOINT</code> in <code>.env.local</code>.
        </p>
        <InnovativeSolutions assessmentId={assessmentId} />
      </Section>

      {/* 10 — FINAL RECOMMENDATION */}
      <Section title="10 — Final Recommendation" badge="Architect Review" defaultOpen={true}>
        <p className={styles.sectionExplanation}>
          Confirm whether you agree with the platform choice above. This approval is recorded for governance review only and does not change the current recommendation or any future scoring logic.
        </p>
        <div className={styles.finalRecommendationBox}>
          <div className={styles.finalRecommendationOptions}>
            <label className={styles.finalRecommendationOption}>
              <input
                type="radio"
                name="architectApproval"
                value="agree"
                checked={architectApproval === "agree"}
                onChange={() => setArchitectApproval("agree")}
              />
              <span>I agree with the recommended platform choice</span>
            </label>
            <label className={styles.finalRecommendationOption}>
              <input
                type="radio"
                name="architectApproval"
                value="disagree"
                checked={architectApproval === "disagree"}
                onChange={() => setArchitectApproval("disagree")}
              />
              <span>I disagree with the recommended platform choice</span>
            </label>
          </div>

          {architectApproval === "disagree" && (
            <div className={styles.finalRecommendationReason}>
              <label className={styles.finalRecommendationLabel} htmlFor="architectApprovalReason">
                Reason for disagreement
              </label>
              <textarea
                id="architectApprovalReason"
                className={styles.finalRecommendationTextarea}
                value={architectApprovalReason}
                onChange={(e) => setArchitectApprovalReason(e.target.value)}
                rows={4}
                placeholder="Explain why you disagree. This note is recorded for review and is not used in scoring."
              />
            </div>
          )}

          <div className={styles.finalRecommendationActions}>
            <button className={styles.finalRecommendationButton} onClick={submitArchitectApproval} disabled={approvalSaving}>
              {approvalSaving ? "Saving..." : "Save Architect Approval"}
            </button>
            {approvalStatus && <span className={styles.finalRecommendationStatus}>{approvalStatus}</span>}
          </div>

          {rec.architectApprovalRecordedAt && (
            <div className={styles.finalRecommendationSaved}>
              <strong>Recorded approval:</strong> {rec.architectApproval === "agree" ? "Agreed" : rec.architectApproval === "disagree" ? "Disagreed" : "Not set"}
              {rec.architectApprovalRecordedAt ? ` on ${new Date(rec.architectApprovalRecordedAt).toLocaleString()}` : ""}
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}
