import { NextResponse } from "next/server";
import db from "@/lib/db/db";
import { CreateAssessmentRequest } from "@/types/assessment";

export async function POST(request: Request) {
  const body: CreateAssessmentRequest = await request.json();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO assessments (
      name, 
      description,
      status, 
      current_step_id, 
      business_context,
      business_goals,
      business_drivers,
      business_requirement,
      business_goal,
      business_driver,
      created_at, 
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    body.name || `Assessment ${now}`,
    body.description || null,
    "draft",
    "ARCHITECTURE",
    body.business_context || null,
    body.business_goals || null,
    body.business_drivers || null,
    body.business_requirement || null,
    body.business_goal || null,
    body.business_driver || null,
    now,
    now
  );

  const assessment = db.prepare(`SELECT id FROM assessments WHERE rowid = last_insert_rowid()`).get() as { id: number };

  return NextResponse.json({ id: assessment.id });
}
