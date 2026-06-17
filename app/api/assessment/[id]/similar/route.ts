import { NextResponse } from "next/server";
import { findSimilarAssessments, isSignalSufficient, SimilarAssessment } from "@/lib/similarity/engine";
import { buildInstitutionalKnowledgeLowSignalReport } from "@/lib/deterministic/institutional-knowledge-low-signal-report";
import db from "@/lib/db/db";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const assessmentId = parseInt(id);

  if (isNaN(assessmentId)) {
    return NextResponse.json({ error: "Invalid assessment ID" }, { status: 400 });
  }

  const assessment = db
    .prepare(`SELECT id, business_context, business_requirement FROM assessments WHERE id = ?`)
    .get(assessmentId) as { id: number; business_context: string; business_requirement: string } | undefined;

  if (!assessment) {
    return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
  }

  // Check whether enough responses exist to compute a meaningful similarity score
  const responseCount = (
    db
      .prepare(`SELECT COUNT(*) as count FROM responses WHERE assessment_id = ?`)
      .get(assessmentId) as { count: number }
  ).count;

  if (responseCount === 0) {
    return NextResponse.json({ type: "empty", similar: [], lowSignalReport: null });
  }

  const sufficient = isSignalSufficient(assessmentId);

  if (!sufficient) {
    // Not enough signal for decisive ranking, but still retrieve semantic precedents for context.
    let similar: SimilarAssessment[] = [];
    try {
      similar = await findSimilarAssessments(assessmentId, 3, { bypassSignalThreshold: true });
    } catch (error) {
      console.error("Error finding similar assessments for low-signal context:", error);
    }

    const lowSignalReport = buildInstitutionalKnowledgeLowSignalReport(
      null,
      0,
      assessment.business_context ?? "",
      assessment.business_requirement ?? ""
    );
    return NextResponse.json({ type: "low_signal", similar, lowSignalReport });
  }

  try {
    const similar = await findSimilarAssessments(assessmentId);
    return NextResponse.json({ type: "similar", similar, lowSignalReport: null });
  } catch (error) {
    console.error("Error finding similar assessments:", error);
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("EMBEDDING_BACKEND_UNAVAILABLE") || message.includes("LOCAL_EMBEDDING_SERVICE_UNAVAILABLE")) {
      return NextResponse.json(
        {
          error: "Local embedding service is unavailable",
          details:
            "Start the offline embeddings service (sentence-transformers all-MiniLM-L6-v2) and retry similarity generation.",
          raw: message,
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: "Failed to find similar assessments", details: message },
      { status: 500 }
    );
  }
}
