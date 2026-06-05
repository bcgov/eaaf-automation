import { NextResponse } from "next/server";
import db from "@/lib/db/db";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const assessmentId = url.searchParams.get("assessmentId");

  if (!assessmentId) {
    return NextResponse.json({ error: "assessmentId parameter required" }, { status: 400 });
  }

  const responses = db
    .prepare(
      `SELECT q.question_key, r.response_text
       FROM responses r
       JOIN questions q ON r.question_id = q.id
       WHERE r.assessment_id = ?`
    )
    .all(assessmentId);

  const result: Record<string, string> = {};
  for (const row of responses) {
    result[(row as any).question_key] = (row as any).response_text;
  }

  return NextResponse.json(result);
}
