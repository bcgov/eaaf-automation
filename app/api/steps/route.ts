import { NextResponse } from "next/server";
import db from "@/lib/db/db";

export async function GET() {
  const steps = db
    .prepare(`SELECT id, key, name, sequence FROM assessment_steps ORDER BY sequence`)
    .all();

  return NextResponse.json(steps);
}
