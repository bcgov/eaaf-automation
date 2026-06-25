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

const STEP_ORDER = [
  "ARCHITECTURE",
  "CLOUD_ASSESSMENT",
  "PLATFORM_ASSESSMENT",
  "OPERATIONAL_CONSIDERATIONS",
  "FINAL_RECOMMENDATION",
];

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const assessmentId = parseInt(id);

  try {
  const assessment = db
    .prepare(
      `SELECT id, name, status, current_step_id, business_context, business_goals, business_drivers, business_requirement, created_at FROM assessments WHERE id = ?`
    )
    .get(assessmentId) as {
    id: number;
    name: string;
    status: string;
    current_step_id: string | null;
    business_context: string;
    business_goals: string;
    business_drivers: string;
    business_requirement: string;
    created_at: string;
  } | undefined;

  if (!assessment) {
    return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
  }

  // ── Pre-flight: verify assessment has data to score ──────────────────────
  const responseCount = (
    db.prepare(`SELECT COUNT(*) as count FROM responses WHERE assessment_id = ?`).get(assessmentId) as { count: number }
  ).count;

  const hasBusinessContext = !!(
    assessment.business_context ||
    assessment.business_goals ||
    assessment.business_drivers ||
    assessment.business_requirement
  );

  if (responseCount === 0 && !hasBusinessContext) {
    return NextResponse.json(
      { error: "No responses or business context found. Complete the assessment steps before generating a report." },
      { status: 422 }
    );
  }

  // ── Deterministic scoring ────────────────────────────────────────────────
  // eslint-disable-next-line prefer-const
  let result!: RecommendationResult;
  try {
    result = generateRecommendation(assessmentId);
    saveRecommendation(assessmentId, result);
  } catch (e) {
    console.error(`[recommend] Scoring failed for assessment ${assessmentId}:`, e);
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Report generation failed: ${message}` }, { status: 500 });
  }

  // ── Assessment journey: steps with factors, subfactors, questions, responses ──
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

  // ── Confidence breakdown ─────────────────────────────────────────────────
  const totalQuestions = stepsWithData.reduce((s, st) => s + st.totalQuestions, 0);
  const totalAnswered = stepsWithData.reduce((s, st) => s + st.answeredCount, 0);
  const rulesMatched = result.scoringHits.length;
  const completenessPercent = totalQuestions > 0 ? Math.round((totalAnswered / totalQuestions) * 100) : 0;

  // ── Build enriched scoring signals ──────────────────────────────────────
  const enrichedSignals = buildScoringSignalExplanations(result.scoringHits);

  // ── Similar assessments ──────────────────────────────────────────────────
  let similarAssessments: Array<{
    name: string;
    platform: string;
    similarityScore: number;
    similarityMethod: string;
    businessContext: string;
    businessGoal: string;
    businessDriver: string;
    businessRequirement: string;
    topMatchedThemes: string[];
    comparison: unknown;
  }> = [];

  try {
    const similar = await findSimilarAssessments(assessmentId, 3);
    similarAssessments = similar.map((s) => ({
      name: s.assessmentName,
      platform: s.platformRecommendation,
      similarityScore: s.similarityScore,
      similarityMethod: s.similarityMethod,
      businessContext: s.businessContext,
      businessGoal: s.businessGoal,
      businessDriver: s.businessDriver,
      businessRequirement: s.businessRequirement,
      topMatchedThemes: s.topMatchedThemes,
      comparison: s.comparison,
    }));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.includes("EMBEDDING_BACKEND_UNAVAILABLE") || message.includes("LOCAL_EMBEDDING_SERVICE_UNAVAILABLE")) {
      console.error("Similarity search failed because local embedding service is unavailable:", message);
    } else {
      console.warn("Similarity search failed:", message);
    }
  }

  // ── Strategic platform fit data ────────────────────────────────────────────
  const strategicPlatformFit = generateStrategicPlatformFitData(
    assessment.business_requirement,
    result.platform
  );

  // ── Recommendation document assembly ─────────────────────────────────────
  let assembledDocument: { summary: string; platformAnalysis: string; nextSteps: string; disclaimer: string } | null = null;
  try {
    assembledDocument = await assembleRecommendationDocument(
      assessment.name,
      assessment.business_context,
      assessment.business_goals,
      assessment.business_drivers,
      assessment.business_requirement,
      [],
      result.platformScores,
      result,
      similarAssessments.map((s) => ({ name: s.name, similarity: s.similarityScore }))
    );
  } catch (e) {
    console.warn("Recommendation document assembly failed:", e);
    assembledDocument = {
      summary: `This Enterprise Architecture Assessment evaluated ${assessment.name} against BC Government platform standards. The recommended platform is ${result.displayName}, which aligns best with stated business requirements and organizational readiness. Confidence: ${result.confidenceScore}%.`,
      platformAnalysis: result.rationale,
      nextSteps: `Next Steps:\n• Complete business case development with Finance\n• Initiate vendor engagement and licensing negotiations\n• Begin detailed implementation planning with relevant teams`,
      disclaimer: "This assessment provides a governance-ready platform recommendation based on deterministic scoring rules, historical assessment comparison, and BC Government platform standards. All recommendations should be validated by the architecture team before procurement.",
    };
  }

  return NextResponse.json({
    // Core recommendation
    ...result,
    rulesApplied: result.rulesApplied,
    scoreImpacts: result.rulesApplied,
    deterministicDecisionAuthority: "Deterministic Decision Engine",
    deterministicSuitabilityScore: result.confidenceScore,
    // Assessment context
    assessmentMeta: {
      name: assessment.name,
      businessContext: assessment.business_context,
      businessGoals: assessment.business_goals,
      businessDrivers: assessment.business_drivers,
      businessRequirement: assessment.business_requirement,
      assessmentDate: assessment.created_at,
      status: assessment.status,
    },
    // Journey
    stepsWithData,
    // Confidence breakdown
    confidenceBreakdown: {
      totalQuestions,
      totalAnswered,
      completenessPercent,
      rulesMatched,
      historicalMatchesFound: similarAssessments.length,
      conflictingIndicators: detectInstitutionalConfidenceConflictingIndicators(result),
    },
    // Knowledge coverage
    knowledgeCoverage: buildInstitutionalKnowledgeCoverage(similarAssessments.length, rulesMatched, completenessPercent),
    // Split confidence
    institutionalConfidence: buildInstitutionalKnowledgeConfidence(result, rulesMatched, completenessPercent),
    historicalAlignment: buildSimilarityHistoricalAlignment(similarAssessments),
    documentConfidence: buildSimilarityAdvisoryConfidence(similarAssessments.length, completenessPercent, assessment.business_context),
    // Similar assessments
    historicalPrecedentMatches: similarAssessments,
    // Strategic platform fit
    strategicPlatformFit,
    // Scoring transparency
    aiTransparency: {
      deterministicDecisionSteps: [
        `Executed scoring rules across ${totalQuestions} assessment questions`,
        `Matched ${rulesMatched} assessment signals in responses`,
        `Normalised raw platform scores to 0-100 scale using min-max normalisation`,
        `Selected final platform by highest normalised deterministic suitability score`,
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
        `Deterministic platform scores: ${result.platformScores.map(s => `${s.platform}=${s.score}`).join(", ")}`,
      ],
      documentGeneratedContent: assembledDocument
        ? [
            "Executive summary narrative",
            "Platform fit narrative grounded in deterministic output",
            "Implementation next steps narrative",
            "Disclaimer text",
          ]
        : [],
    },
    // Enriched scoring signals
    enrichedSignals,
    // Recommendation document
    assembledDocument,
  });
  } catch (e) {
    console.error(`[recommend] Unhandled error for assessment ${assessmentId}:`, e);
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Report generation failed: ${message}` }, { status: 500 });
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const assessmentId = parseInt(id);

  const recommendation = db
    .prepare(
      `
      SELECT platform_recommendation, rationale, confidence_score, risks, alternatives, architect_approval, architect_approval_reason, architect_approval_recorded_at, created_at
      FROM recommendations WHERE assessment_id = ?
    `
    )
    .get(assessmentId) as (Record<string, unknown> & { created_at: string }) | undefined;

  if (!recommendation) {
    return NextResponse.json({ error: "No recommendation found" }, { status: 404 });
  }

  // Determine whether any scored responses have changed since this recommendation was generated.
  // Only compare responses.updated_at — assessments.updated_at changes on every step navigation
  // and would produce false positives.
  const latestResponseUpdate = db
    .prepare(
      `SELECT MAX(updated_at) as latest FROM responses WHERE assessment_id = ?`
    )
    .get(assessmentId) as { latest: string | null };

  const recTime = new Date(recommendation.created_at).getTime();
  const responseTime = latestResponseUpdate.latest ? new Date(latestResponseUpdate.latest).getTime() : 0;
  const responsesChangedSince = responseTime > recTime;

  return NextResponse.json({ ...recommendation, responsesChangedSince });
}

