import { NextResponse } from "next/server";
import db from "@/lib/db/db";
import { runJurisdictionScan } from "@/lib/jurisdiction/engine";
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

  // Use only Assessment Overview fields (no architecture responses, no recommendation)
  const inputs = {
    assessmentName: assessment.name,
    businessProblem: assessment.business_context ?? assessment.business_goals ?? "",
    drivers: assessment.business_drivers ?? "",
    requirements: assessment.business_requirement ?? "",
    currentState: "",
    proposedSolution: "",
  };

  try {
    const result = await runJurisdictionScan(inputs);
    saveAiCache(assessmentId, "jurisdiction_scan", result);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[JurisdictionScan Route] Error:", error);
    const message =
      error instanceof Error ? error.message : "Jurisdiction scan failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
