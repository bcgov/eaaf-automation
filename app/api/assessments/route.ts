import { NextResponse } from "next/server";
import db from "@/lib/db/db";

export async function GET() {
  const assessments = db
    .prepare(
      `SELECT id, name, status, current_step_id, created_at FROM assessments ORDER BY created_at DESC`
    )
    .all();

  return NextResponse.json(assessments);
}
