import { NextResponse } from "next/server";
import { generateRecommendation, saveRecommendation } from "@/lib/recommendation/engine";
import db from "@/lib/db/db";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const assessmentId = parseInt(id);

  const assessment = db
    .prepare(`SELECT id, status FROM assessments WHERE id = ?`)
    .get(assessmentId) as { id: number; status: string } | undefined;

  if (!assessment) {
    return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
  }

  const result = generateRecommendation(assessmentId);
  saveRecommendation(assessmentId, result);

  return NextResponse.json(result);
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const assessmentId = parseInt(id);

  const recommendation = db
    .prepare(`
      SELECT platform_recommendation, rationale, confidence_score, risks, alternatives, created_at
      FROM recommendations WHERE assessment_id = ?
    `)
    .get(assessmentId);

  if (!recommendation) {
    return NextResponse.json({ error: "No recommendation found" }, { status: 404 });
  }

  return NextResponse.json(recommendation);
}
