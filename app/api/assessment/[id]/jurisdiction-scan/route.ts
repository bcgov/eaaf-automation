import { NextResponse } from "next/server";
import db from "@/lib/db/db";
import { runJurisdictionScan, JurisdictionScanInputs } from "@/lib/jurisdiction/engine";
import { isJurisdictionScanConfigured } from "@/lib/jurisdiction/config";

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
          "Jurisdiction scan is not configured. Add these to your .env.local: " +
          "JURISDICTION_AI_PROVIDER, JURISDICTION_AI_ENDPOINT, JURISDICTION_AI_KEY, JURISDICTION_AI_MODEL",
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

  // Derive current state from Architecture step responses
  const archResponses = db
    .prepare(
      `SELECT q.question_text, r.response_text
       FROM responses r
       JOIN questions q ON r.question_id = q.id
       JOIN assessment_steps s ON q.step_id = s.id
       WHERE r.assessment_id = ?
         AND s.key = 'ARCHITECTURE'
         AND r.response_text IS NOT NULL
         AND TRIM(r.response_text) != ''`
    )
    .all(assessmentId) as Array<{ question_text: string; response_text: string }>;

  // Use most recent recommendation as proposed solution
  const recommendation = db
    .prepare(
      `SELECT platform_recommendation, rationale
       FROM recommendations WHERE assessment_id = ?
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(assessmentId) as
    | { platform_recommendation: string; rationale: string | null }
    | undefined;

  const currentState =
    archResponses.length > 0
      ? archResponses
          .map((r) => `${r.question_text}: ${r.response_text}`)
          .join("\n")
      : "Not captured in assessment";

  const proposedSolution = recommendation
    ? `${recommendation.platform_recommendation}${recommendation.rationale ? ` — ${recommendation.rationale}` : ""}`
    : "Not yet determined";

  // Allow caller to override individual inputs via request body
  let bodyOverrides: Partial<JurisdictionScanInputs> = {};
  try {
    bodyOverrides = await req.json();
  } catch {
    // no body — use defaults
  }

  const inputs: JurisdictionScanInputs = {
    assessmentName: assessment.name,
    businessProblem:
      bodyOverrides.businessProblem ??
      assessment.business_context ??
      assessment.business_goals ??
      "",
    drivers: bodyOverrides.drivers ?? assessment.business_drivers ?? "",
    requirements: bodyOverrides.requirements ?? assessment.business_requirement ?? "",
    currentState: bodyOverrides.currentState ?? currentState,
    proposedSolution: bodyOverrides.proposedSolution ?? proposedSolution,
  };

  try {
    const result = await runJurisdictionScan(inputs);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Jurisdiction scan failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
