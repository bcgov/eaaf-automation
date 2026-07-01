import { NextResponse } from "next/server";
import { generateRecommendation, saveRecommendation, RecommendationResult } from "@/lib/deterministic/engine";
import { assembleRecommendationDocument } from "@/lib/deterministic/recommendation-document-assembler";
import { generateStrategicPlatformFitData } from "@/lib/deterministic/static-strategic-platform-fit-data";
import { findSimilarAssessments } from "@/lib/similarity/engine";
import { buildScoringSignalExplanations } from "@/lib/deterministic/scoring-signal-explanation-metadata";
import {
  buildInstitutionalKnowledgeConfidence,
  buildInstitutionalKnowledgeCoverage,
  detectInstitutionalConfidenceConflictingIndicators,
} from "@/lib/deterministic/confidence-institutional-knowledge-report";
import {
  buildSimilarityAdvisoryConfidence,
  buildSimilarityHistoricalAlignment,
} from "@/lib/deterministic/confidence-similarity-report";
import db from "@/lib/db/db";
import { getAiCache } from "@/lib/db/aiCache";
import { saveReportCache, getReportCache } from "@/lib/db/reportCache";
import { tunnelReadOnly } from "@/lib/access-control";

const STEP_ORDER = [
  "ARCHITECTURE",
  "CLOUD_ASSESSMENT",
  "PLATFORM_ASSESSMENT",
  "OPERATIONAL_CONSIDERATIONS",
  "FINAL_RECOMMENDATION",
];

type ComputeResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error: string; httpStatus: number };

async function computeFullReport(
  assessmentId: number,
  saveToDb: boolean
): Promise<ComputeResult> {
  const assessment = db
    .prepare(
      `SELECT id, name, status, current_step_id, business_context, business_goals,
              business_drivers, business_requirement, created_at
       FROM assessments WHERE id = ?`
    )
    .get(assessmentId) as {
      id: number; name: string; status: string; current_step_id: string | null;
      business_context: string; business_goals: string; business_drivers: string;
      business_requirement: string; created_at: string;
    } | undefined;

  if (!assessment) return { ok: false, error: "Assessment not found", httpStatus: 404 };

  const responseCount = (
    db.prepare(`SELECT COUNT(*) as count FROM responses WHERE assessment_id = ?`).get(assessmentId) as { count: number }
  ).count;

  const hasBusinessContext = !!(
    assessment.business_context || assessment.business_goals ||
    assessment.business_drivers || assessment.business_requirement
  );

  if (responseCount === 0 && !hasBusinessContext) {
    return {
      ok: false,
      error: "No responses or business context found. Complete the assessment steps before generating a report.",
      httpStatus: 422,
    };
  }

  let result: RecommendationResult;
  try {
    result = generateRecommendation(assessmentId);
    if (saveToDb) saveRecommendation(assessmentId, result);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Report generation failed: ${message}`, httpStatus: 500 };
  }

  const stepsWithData = STEP_ORDER.filter((k) => k !== "FINAL_RECOMMENDATION").map((stepKey) => {
    const factors = db
      .prepare(`SELECT id, name, description FROM "Factor" WHERE stepKey = ? ORDER BY displayOrder`)
      .all(stepKey) as Array<{ id: string; name: string; description: string }>;
    const factorsWithSubs = factors.map((f) => {
      const subFactors = db
        .prepare(`SELECT name, description FROM "SubFactor" WHERE factorId = ? ORDER BY displayOrder`)
        .all(f.id) as Array<{ name: string; description: string }>;
      return { ...f, subFactors };
    });
    const questionsAndResponses = db
      .prepare(
        `SELECT q.question_key, q.question_text, COALESCE(r.response_text, '') as response_text
         FROM questions q
         LEFT JOIN responses r ON r.question_id = q.id AND r.assessment_id = ?
         WHERE q.step_key = ?
         ORDER BY q.sequence`
      )
      .all(assessmentId, stepKey) as Array<{ question_key: string; question_text: string; response_text: string }>;
    const answeredCount = questionsAndResponses.filter((q) => q.response_text.trim().length > 0).length;
    return {
      stepKey,
      stepName: stepKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      factors: factorsWithSubs,
      questionsAndResponses,
      answeredCount,
      totalQuestions: questionsAndResponses.length,
    };
  });

  const totalQuestions = stepsWithData.reduce((s, st) => s + st.totalQuestions, 0);
  const totalAnswered  = stepsWithData.reduce((s, st) => s + st.answeredCount, 0);
  const rulesMatched   = result.scoringHits.length;
  const completenessPercent = totalQuestions > 0 ? Math.round((totalAnswered / totalQuestions) * 100) : 0;
  const enrichedSignals = buildScoringSignalExplanations(result.scoringHits);

  let similarAssessments: Array<{
    name: string; platform: string; similarityScore: number; similarityMethod: string;
    businessContext: string; businessGoal: string; businessDriver: string;
    businessRequirement: string; topMatchedThemes: string[]; comparison: unknown;
  }> = [];

  try {
    const similar = await findSimilarAssessments(assessmentId, 3);
    similarAssessments = similar.map((s) => ({
      name: s.assessmentName, platform: s.platformRecommendation,
      similarityScore: s.similarityScore, similarityMethod: s.similarityMethod,
      businessContext: s.businessContext, businessGoal: s.businessGoal,
      businessDriver: s.businessDriver, businessRequirement: s.businessRequirement,
      topMatchedThemes: s.topMatchedThemes, comparison: s.comparison,
    }));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.includes("EMBEDDING_BACKEND_UNAVAILABLE") || message.includes("LOCAL_EMBEDDING_SERVICE_UNAVAILABLE")) {
      console.error("Similarity search failed ï¿½ embedding service unavailable:", message);
    } else {
      console.warn("Similarity search failed:", message);
    }
  }

  const strategicPlatformFit = generateStrategicPlatformFitData(assessment.business_requirement, result.platform);

  let assembledDocument: { summary: string; platformAnalysis: string; nextSteps: string; disclaimer: string } | null = null;
  try {
    const latestResponseUpdate = db
      .prepare(`SELECT MAX(updated_at) as latest FROM responses WHERE assessment_id = ?`)
      .get(assessmentId) as { latest: string | null };
    if (latestResponseUpdate) { /* variable used below */ }
    assembledDocument = await assembleRecommendationDocument(
      assessment.name, assessment.business_context, assessment.business_goals,
      assessment.business_drivers, assessment.business_requirement,
      [], result.platformScores, result,
      similarAssessments.map((s) => ({ name: s.name, similarity: s.similarityScore }))
    );
  } catch (e) {
    console.warn("Recommendation document assembly failed:", e);
    assembledDocument = {
      summary: `This Enterprise Architecture Assessment evaluated ${assessment.name} against BC Government platform standards. The recommended platform is ${result.displayName}.`,
      platformAnalysis: result.rationale,
      nextSteps: "Next Steps:\n- Complete business case development with Finance\n- Initiate vendor engagement and licensing negotiations\n- Schedule Architecture Review Board presentation",
      disclaimer: "All recommendations should be validated by the Architecture Review Board before procurement or implementation proceeds.",
    };
  }

  const cachedJurisdictionScan    = getAiCache(assessmentId, "jurisdiction_scan")?.data    ?? null;
  const cachedInnovativeSolutions = getAiCache(assessmentId, "innovative_solutions")?.data ?? null;

  const data: Record<string, unknown> = {
    ...result,
    rulesApplied: result.rulesApplied,
    scoreImpacts: result.rulesApplied,
    deterministicDecisionAuthority: "Deterministic Decision Engine",
    deterministicSuitabilityScore: result.confidenceScore,
    assessmentMeta: {
      name: assessment.name,
      businessContext: assessment.business_context,
      businessGoals: assessment.business_goals,
      businessDrivers: assessment.business_drivers,
      businessRequirement: assessment.business_requirement,
      assessmentDate: assessment.created_at,
      status: assessment.status,
    },
    stepsWithData,
    confidenceBreakdown: {
      totalQuestions, totalAnswered, completenessPercent, rulesMatched,
      historicalMatchesFound: similarAssessments.length,
      conflictingIndicators: detectInstitutionalConfidenceConflictingIndicators(result),
    },
    knowledgeCoverage:          buildInstitutionalKnowledgeCoverage(similarAssessments.length, rulesMatched, completenessPercent),
    institutionalConfidence:    buildInstitutionalKnowledgeConfidence(result, rulesMatched, completenessPercent),
    historicalAlignment:        buildSimilarityHistoricalAlignment(similarAssessments),
    documentConfidence:         buildSimilarityAdvisoryConfidence(similarAssessments.length, completenessPercent, assessment.business_context),
    historicalPrecedentMatches: similarAssessments,
    strategicPlatformFit,
    aiTransparency: {
      deterministicDecisionSteps: [
        `Executed scoring rules across ${totalQuestions} assessment questions`,
        `Matched ${rulesMatched} assessment signals in responses`,
        "Normalised raw platform scores to 0-100 scale using min-max normalisation",
        "Selected final platform by highest normalised deterministic suitability score",
      ],
      historicalPrecedentRetrievalSteps: [
        `Retrieved ${similarAssessments.length} nearest historical assessment${similarAssessments.length !== 1 ? "s" : ""} using embedding cosine similarity`,
        "Historical precedent retrieval is non-decisional and does not alter deterministic platform selection",
      ],
      scoringInputs: [
        `Business context: ${assessment.business_context?.substring(0, 80) ?? "(not provided)"}...`,
        `Business goals: ${assessment.business_goals ?? "(not provided)"}`,
        `Business drivers: ${assessment.business_drivers ?? "(not provided)"}`,
        `${similarAssessments.length} nearest historical precedents provided as contextual reference only (non-decisional)`,
        `Deterministic platform scores: ${result.platformScores.map((s) => `${s.platform}=${s.score}`).join(", ")}`,
      ],
      documentGeneratedContent: assembledDocument
        ? ["Executive summary narrative", "Platform fit narrative", "Next steps", "Disclaimer"]
        : [],
    },
    enrichedSignals,
    assembledDocument,
    cachedJurisdictionScan,
    cachedInnovativeSolutions,
  };

  return { ok: true, data };
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const assessmentId = parseInt(id);
  const block = tunnelReadOnly(req, assessmentId);
  if (block) return block;
  try {
    const result = await computeFullReport(assessmentId, true);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.httpStatus });
    saveReportCache(assessmentId, result.data);
    return NextResponse.json(result.data);
  } catch (e) {
    console.error(`[recommend POST] Unhandled error for assessment ${assessmentId}:`, e);
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Report generation failed: ${message}` }, { status: 500 });
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const assessmentId = parseInt(id);

  const recommendation = db
    .prepare(
      `SELECT platform_recommendation, rationale, confidence_score, risks, alternatives,
              architect_approval, architect_approval_reason, architect_approval_recorded_at, created_at
       FROM recommendations WHERE assessment_id = ?`
    )
    .get(assessmentId) as (Record<string, unknown> & { created_at: string }) | undefined;

  if (!recommendation) {
    return NextResponse.json({ error: "No recommendation found" }, { status: 404 });
  }

  const latestResponseUpdate = db
    .prepare(`SELECT MAX(updated_at) as latest FROM responses WHERE assessment_id = ?`)
    .get(assessmentId) as { latest: string | null };

  const recTime      = new Date(recommendation.created_at).getTime();
  const responseTime = latestResponseUpdate.latest ? new Date(latestResponseUpdate.latest).getTime() : 0;
  const responsesChangedSince = responseTime > recTime;

  if (!responsesChangedSince) {
    let cached = getReportCache(assessmentId);

    if (!cached) {
      try {
        const computeResult = await computeFullReport(assessmentId, false);
        if (computeResult.ok) {
          saveReportCache(assessmentId, computeResult.data);
          cached = { data: computeResult.data, created_at: new Date().toISOString() };
        }
      } catch (e) {
        console.warn("[recommend GET] Cache warm failed:", e);
      }
    }

    if (cached?.data) {
      const fullReport = cached.data as Record<string, unknown>;
      // Always merge live approval state and status — these can change after the cache was written
      const liveAssessment = db.prepare(`SELECT status, completed_at FROM assessments WHERE id = ?`).get(assessmentId) as { status: string; completed_at: string | null } | undefined;
      return NextResponse.json({
        ...fullReport,
        responsesChangedSince: false,
        // Live approval fields — never stale
        architectApproval: recommendation.architect_approval ?? null,
        architectApprovalReason: recommendation.architect_approval_reason ?? null,
        architectApprovalRecordedAt: recommendation.architect_approval_recorded_at ?? null,
        // Live status
        assessmentMeta: { ...(fullReport.assessmentMeta as Record<string, unknown> ?? {}), status: liveAssessment?.status ?? (fullReport.assessmentMeta as Record<string, unknown>)?.status },
        cachedJurisdictionScan:    getAiCache(assessmentId, "jurisdiction_scan")?.data    ?? fullReport.cachedJurisdictionScan    ?? null,
        cachedInnovativeSolutions: getAiCache(assessmentId, "innovative_solutions")?.data ?? fullReport.cachedInnovativeSolutions ?? null,
      });
    }
  }

  return NextResponse.json({
    ...recommendation,
    responsesChangedSince,
    cachedJurisdictionScan:    getAiCache(assessmentId, "jurisdiction_scan")?.data    ?? null,
    cachedInnovativeSolutions: getAiCache(assessmentId, "innovative_solutions")?.data ?? null,
  });
}