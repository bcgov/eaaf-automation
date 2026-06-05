import { NextResponse } from "next/server";
import db from "@/lib/db/db";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const step = url.searchParams.get("step");

  if (!step) {
    return NextResponse.json({ error: "step parameter required" }, { status: 400 });
  }

  const questions = db
    .prepare(
      `SELECT id, question_key, question_text, factor, help_text, input_type, sequence
       FROM questions WHERE step_key = ? ORDER BY sequence`
    )
    .all(step);

  return NextResponse.json(questions);
}
