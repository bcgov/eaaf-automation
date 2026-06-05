import { NextResponse } from "next/server";
import db from "@/lib/db/db";
import { goToPreviousStep, type StepKey } from "@/lib/workflow/step-navigation";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const assessmentId = parseInt(id);

  const assessment = db
    .prepare(`SELECT id, current_step_id FROM assessments WHERE id = ?`)
    .get(assessmentId) as { id: number; current_step_id: string } | undefined;

  if (!assessment) {
    return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
  }

  const prevStep = goToPreviousStep(assessmentId, assessment.current_step_id as StepKey);

  if (!prevStep) {
    return NextResponse.json({ error: "No previous step available" }, { status: 400 });
  }

  return NextResponse.json({ success: true, prevStep });
}
