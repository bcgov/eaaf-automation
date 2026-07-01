import { NextResponse } from "next/server";
import db from "@/lib/db/db";
import { tunnelReadOnly } from "@/lib/access-control";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const assessmentId = parseInt(id);
  const block = tunnelReadOnly(req, assessmentId);
  if (block) return block;
  const body = await req.json().catch(() => ({} as { approval?: string; reason?: string | null }));
  const approval = body.approval === "agree" || body.approval === "disagree" ? body.approval : null;
  const reason = typeof body.reason === "string" && body.reason.trim().length > 0 ? body.reason.trim() : null;

  if (!approval) {
    return NextResponse.json({ error: "Valid approval is required" }, { status: 400 });
  }

  const recommendation = db
    .prepare(`SELECT id FROM recommendations WHERE assessment_id = ?`)
    .get(assessmentId) as { id: number } | undefined;

  if (!recommendation) {
    return NextResponse.json({ error: "Recommendation not found" }, { status: 404 });
  }

  const recordedAt = new Date().toISOString();
  db.prepare(
    `UPDATE recommendations
     SET architect_approval = ?, architect_approval_reason = ?, architect_approval_recorded_at = ?
     WHERE assessment_id = ?`
  ).run(approval, reason, recordedAt, assessmentId);

  // Assessment is only marked complete when the architect records their decision
  db.prepare(
    `UPDATE assessments SET status = 'completed', completed_at = ?, updated_at = ? WHERE id = ?`
  ).run(recordedAt, recordedAt, assessmentId);

  return NextResponse.json({
    architectApproval: approval,
    architectApprovalReason: reason,
    architectApprovalRecordedAt: recordedAt,
  });
}