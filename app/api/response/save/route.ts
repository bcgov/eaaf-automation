import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/db";

interface SaveResponseBody {
  assessmentId: number;
  questionKey: string;
  value: string;
}

export async function POST(req: NextRequest) {
  const body: SaveResponseBody = await req.json();
  const { assessmentId, questionKey, value } = body;

  if (!assessmentId || !questionKey || value === undefined) {
    return NextResponse.json({ error: "assessmentId, questionKey, and value are required" }, { status: 400 });
  }

  const question = db.prepare(`
    SELECT id, step_id FROM questions WHERE question_key = ?
  `).get(questionKey) as { id: number; step_id: number } | undefined;

  if (!question) {
    return NextResponse.json({ error: `Question not found: ${questionKey}` }, { status: 404 });
  }

  const now = new Date().toISOString();

  const existing = db.prepare(`
    SELECT id FROM responses WHERE assessment_id = ? AND question_id = ?
  `).get(assessmentId, question.id) as { id: number } | undefined;

  if (existing) {
    db.prepare(`
      UPDATE responses SET response_text = ?, updated_at = ? WHERE id = ?
    `).run(value, now, existing.id);
  } else {
    db.prepare(`
      INSERT INTO responses (assessment_id, question_id, step_id, response_text, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(assessmentId, question.id, question.step_id, value, now, now);
  }

  return NextResponse.json({ success: true });
}
