import { NextResponse } from "next/server";
import db from "@/lib/db/db";

export async function GET() {
  const assessments = db
    .prepare(
      `SELECT 
        a.id, 
        a.name, 
        a.status, 
        a.current_step_id, 
        a.created_at,
        a.business_requirement,
        r.platform_recommendation as recommendation
       FROM assessments a
       LEFT JOIN recommendations r ON a.id = r.assessment_id
       ORDER BY a.created_at DESC`
    )
    .all();

  return NextResponse.json(assessments);
}
