import { NextResponse } from "next/server";
import { getQuestionsForStep } from "@/lib/config/questions";
import type { StepKey } from "@/types/assessment";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const step = url.searchParams.get("step");

  if (!step) {
    return NextResponse.json({ error: "step parameter required" }, { status: 400 });
  }

  const questions = getQuestionsForStep(step as StepKey).map((q) => ({
    id:            q.sequence,
    question_key:  q.questionKey,
    question_text: q.questionText,
    factor:        q.factor,
    help_text:     null,
    input_type:    q.inputType,
    sequence:      q.sequence,
  }));

  return NextResponse.json(questions);
}
