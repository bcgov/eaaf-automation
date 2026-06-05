import { NextResponse } from "next/server";
import db from "@/lib/db/db";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const assessmentId = parseInt(params.id);

  const assessment = db
    .prepare(`SELECT id, name, status, current_step_id FROM assessments WHERE id = ?`)
    .get(assessmentId) as { id: number; name: string; status: string; current_step_id: string } | undefined;

  if (!assessment) {
    return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
  }

  return NextResponse.json(assessment);
}
