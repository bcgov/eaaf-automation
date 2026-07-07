import rawQuestions from "@/rules/eaaf-questions.json";
import type { StepKey } from "@/types/assessment";

// ── Types ────────────────────────────────────────────────────────────────────

export interface QuestionStep {
  key: StepKey;
  name: string;
  sequence: number;
  description: string;
}

export interface QuestionFactor {
  id: string;
  stepKey: StepKey;
  factorKey: string;
  name: string;
  description: string;
  displayOrder: number;
}

export interface QuestionSubFactor {
  id: string;
  factorId: string;
  subFactorKey: string;
  name: string;
  description: string;
  displayOrder: number;
}

export interface QuestionDef {
  questionKey: string;
  stepKey: StepKey;
  factor: string;
  questionText: string;
  inputType: string;
  sequence: number;
  factorId: string;
  subFactorId: string;
}

export interface EaafQuestions {
  steps: QuestionStep[];
  factors: QuestionFactor[];
  subFactors: QuestionSubFactor[];
  questions: QuestionDef[];
}

// ── Validation ───────────────────────────────────────────────────────────────

function validate(raw: unknown): EaafQuestions {
  if (!raw || typeof raw !== "object") {
    throw new Error("eaaf-questions.json: must be a JSON object");
  }
  const r = raw as Record<string, unknown>;

  for (const key of ["steps", "factors", "subFactors", "questions"] as const) {
    if (!Array.isArray(r[key])) {
      throw new Error(`eaaf-questions.json: "${key}" must be an array`);
    }
  }

  const steps = r["steps"] as QuestionStep[];
  const factors = r["factors"] as QuestionFactor[];
  const subFactors = r["subFactors"] as QuestionSubFactor[];
  const questions = r["questions"] as QuestionDef[];

  if (steps.length === 0)     throw new Error("eaaf-questions.json: steps array is empty");
  if (questions.length === 0) throw new Error("eaaf-questions.json: questions array is empty");

  // Every question must have the required fields and a resolvable stepKey
  const stepKeys = new Set(steps.map((s) => s.key));
  for (const q of questions) {
    if (!q.questionKey) throw new Error(`eaaf-questions.json: question missing questionKey`);
    if (!q.stepKey)     throw new Error(`eaaf-questions.json: question "${q.questionKey}" missing stepKey`);
    if (!q.questionText) throw new Error(`eaaf-questions.json: question "${q.questionKey}" missing questionText`);
    if (!stepKeys.has(q.stepKey)) {
      throw new Error(`eaaf-questions.json: question "${q.questionKey}" has unknown stepKey "${q.stepKey}"`);
    }
  }

  // Duplicate questionKey check
  const seen = new Set<string>();
  for (const q of questions) {
    if (seen.has(q.questionKey)) {
      throw new Error(`eaaf-questions.json: duplicate questionKey "${q.questionKey}"`);
    }
    seen.add(q.questionKey);
  }

  return { steps, factors, subFactors, questions };
}

// ── Exports ───────────────────────────────────────────────────────────────────

// Loaded and validated once at module import time (same as eaaf-rules.json).
// Node.js module cache ensures the file is read only once per process.
export const EAAF_QUESTIONS: EaafQuestions = validate(rawQuestions);

/** All questions for a given step, ordered by sequence. */
export function getQuestionsForStep(stepKey: StepKey): QuestionDef[] {
  return EAAF_QUESTIONS.questions
    .filter((q) => q.stepKey === stepKey)
    .sort((a, b) => a.sequence - b.sequence);
}

/** All steps ordered by sequence. */
export function getSteps(): QuestionStep[] {
  return [...EAAF_QUESTIONS.steps].sort((a, b) => a.sequence - b.sequence);
}

/** Look up a single question definition by key. Returns undefined if not found. */
export function getQuestion(questionKey: string): QuestionDef | undefined {
  return EAAF_QUESTIONS.questions.find((q) => q.questionKey === questionKey);
}
