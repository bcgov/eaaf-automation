import { NextResponse } from "next/server";
import db from "@/lib/db/db";
import { runInnovativeSolutions } from "@/lib/innovative/engine";
import { isJurisdictionScanConfigured } from "@/lib/jurisdiction/config";
import { saveAiCache } from "@/lib/db/aiCache";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const assessmentId = parseInt(id);

  if (!isJurisdictionScanConfigured()) {
    return NextResponse.json(
      {
        error:
          "AI is not configured. Add JURISDICTION_AI_PROVIDER, JURISDICTION_AI_ENDPOINT, " +
          "JURISDICTION_AI_KEY, and JURISDICTION_AI_MODEL to your .env.local.",
      },
      { status: 503 }
    );
  }

  const assessment = db
    .prepare(
      `SELECT id, name, business_context, business_goals, business_drivers, business_requirement
       FROM assessments WHERE id = ?`
    )
    .get(assessmentId) as
    | {
        id: number;
        name: string;
        business_context: string | null;
        business_goals: string | null;
        business_drivers: string | null;
        business_requirement: string | null;
      }
    | undefined;

  if (!assessment) {
    return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
  }

  // Pull the stored platform recommendation as the "proposed solution" if available
  const rec = db
    .prepare(
      `SELECT platform_recommendation, rationale FROM recommendations
       WHERE assessment_id = ? ORDER BY created_at DESC LIMIT 1`
    )
    .get(assessmentId) as
    | { platform_recommendation: string; rationale: string | null }
    | undefined;

  const proposedSolution = rec
    ? `${rec.platform_recommendation}${rec.rationale ? ` — ${rec.rationale}` : ""}`
    : "";

  const inputs = {
    assessmentName: assessment.name,
    businessProblem: assessment.business_context ?? assessment.business_goals ?? "",
    drivers: assessment.business_drivers ?? "",
    requirements: assessment.business_requirement ?? "",
    proposedSolution,
  };

  try {
    const result = await runInnovativeSolutions(inputs);
    saveAiCache(assessmentId, "innovative_solutions", result);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[InnovativeSolutions Route] Error:", error);
    const message =
      error instanceof Error ? error.message : "Innovative solutions generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
