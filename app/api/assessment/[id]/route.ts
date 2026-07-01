import { NextResponse } from "next/server";
import db from "@/lib/db/db";
import { UpdateAssessmentRequest } from "@/types/assessment";
import { tunnelReadOnly } from "@/lib/access-control";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const assessmentId = parseInt(id);

  const assessment = db
    .prepare(`
      SELECT id, name, description, status, current_step_id, 
             business_context, business_goals, business_drivers,
              business_requirement,
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
  const block = tunnelReadOnly(req, assessmentId);
  if (block) return block;
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
  if (body.current_step_id !== undefined) {
    updateFields.push("current_step_id = ?");
    updateValues.push(body.current_step_id);
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
              business_requirement,
             created_at, updated_at, completed_at
      FROM assessments WHERE id = ?
    `)
    .get(assessmentId);

  return NextResponse.json(updated);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const assessmentId = parseInt(id);

  if (Number.isNaN(assessmentId)) {
    return NextResponse.json({ error: "Invalid assessment id" }, { status: 400 });
  }

  // Completed assessments are read-only through external/tunnel access
  const block = tunnelReadOnly(req, assessmentId);
  if (block) return block;

  const assessment = db
    .prepare(`SELECT id FROM assessments WHERE id = ?`)
    .get(assessmentId) as { id: number } | undefined;

  if (!assessment) {
    return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
  }

  // Delete all child records before removing the assessment.
  // Use a transaction to avoid partial cleanup if any statement fails.
  const deleteAssessment = db.transaction((idToDelete: number) => {
    db.prepare(`DELETE FROM responses WHERE assessment_id = ?`).run(idToDelete);
    db.prepare(`DELETE FROM recommendations WHERE assessment_id = ?`).run(idToDelete);
    db.prepare(`DELETE FROM assessment_step_state WHERE assessment_id = ?`).run(idToDelete);
    db.prepare(`DELETE FROM assessment_history WHERE assessment_id = ?`).run(idToDelete);
    db.prepare(`DELETE FROM assessment_embeddings WHERE assessment_id = ?`).run(idToDelete);
    db.prepare(`DELETE FROM assessments WHERE id = ?`).run(idToDelete);
  });

  deleteAssessment(assessmentId);

  return NextResponse.json({ deleted: true, id: assessmentId });
}
