import { NextResponse } from "next/server";
import db from "@/lib/db/db";
import { UpdateAssessmentRequest } from "@/types/assessment";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const assessmentId = parseInt(id);

  const assessment = db
    .prepare(`
      SELECT id, name, description, status, current_step_id, 
             business_context, business_goals, business_drivers,
             business_requirement, business_goal, business_driver,
             created_at, updated_at, completed_at
      FROM assessments WHERE id = ?
    `)
    .get(assessmentId);

  if (!assessment) {
    return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
  }

  return NextResponse.json(assessment);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const assessmentId = parseInt(id);
  const body: UpdateAssessmentRequest = await req.json();
  const now = new Date().toISOString();

  // Build update query dynamically based on provided fields
  const updateFields: string[] = [];
  const updateValues: any[] = [];

  if (body.name !== undefined) {
    updateFields.push("name = ?");
    updateValues.push(body.name);
  }
  if (body.description !== undefined) {
    updateFields.push("description = ?");
    updateValues.push(body.description);
  }
  if (body.business_context !== undefined) {
    updateFields.push("business_context = ?");
    updateValues.push(body.business_context);
  }
  if (body.business_goals !== undefined) {
    updateFields.push("business_goals = ?");
    updateValues.push(body.business_goals);
  }
  if (body.business_drivers !== undefined) {
    updateFields.push("business_drivers = ?");
    updateValues.push(body.business_drivers);
  }
  if (body.business_requirement !== undefined) {
    updateFields.push("business_requirement = ?");
    updateValues.push(body.business_requirement);
  }
  if (body.business_goal !== undefined) {
    updateFields.push("business_goal = ?");
    updateValues.push(body.business_goal);
  }
  if (body.business_driver !== undefined) {
    updateFields.push("business_driver = ?");
    updateValues.push(body.business_driver);
  }
  if (body.status !== undefined) {
    updateFields.push("status = ?");
    updateValues.push(body.status);
  }

  if (updateFields.length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  updateFields.push("updated_at = ?");
  updateValues.push(now);
  updateValues.push(assessmentId);

  const query = `UPDATE assessments SET ${updateFields.join(", ")} WHERE id = ?`;

  db.prepare(query).run(...updateValues);

  const updated = db
    .prepare(`
      SELECT id, name, description, status, current_step_id, 
             business_context, business_goals, business_drivers,
             business_requirement, business_goal, business_driver,
             created_at, updated_at, completed_at
      FROM assessments WHERE id = ?
    `)
    .get(assessmentId);

  return NextResponse.json(updated);
}
