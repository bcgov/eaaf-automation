import { NextResponse } from "next/server";
import db from "@/lib/db/db";

export async function POST() {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO assessments (name, status, current_step_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(`Assessment ${now}`, "in_progress", "ARCHITECTURE", now, now);

  const assessment = db.prepare(`SELECT * FROM assessments WHERE rowid = last_insert_rowid()`).get() as { id: number };

  return NextResponse.json({ id: assessment.id });
}
