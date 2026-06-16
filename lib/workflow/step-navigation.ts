import db from "@/lib/db/db";

export type StepKey =
  | "ARCHITECTURE"
  | "CLOUD_ASSESSMENT"
  | "PLATFORM_ASSESSMENT"
  | "OPERATIONAL_CONSIDERATIONS"
  | "FINAL_RECOMMENDATION";

const STEP_ORDER: StepKey[] = [
  "ARCHITECTURE",
  "CLOUD_ASSESSMENT",
  "PLATFORM_ASSESSMENT",
  "OPERATIONAL_CONSIDERATIONS",
  "FINAL_RECOMMENDATION",
];

export const getStepIndex = (stepKey: StepKey): number => {
  return STEP_ORDER.indexOf(stepKey);
};

export const getNextStep = (currentStepKey: StepKey): StepKey | null => {
  const currentIndex = getStepIndex(currentStepKey);
  if (currentIndex === -1 || currentIndex >= STEP_ORDER.length - 1) {
    return null;
  }
  return STEP_ORDER[currentIndex + 1];
};

export const getPreviousStep = (currentStepKey: StepKey): StepKey | null => {
  const currentIndex = getStepIndex(currentStepKey);
  if (currentIndex <= 0) {
    return null;
  }
  return STEP_ORDER[currentIndex - 1];
};

export const getStepById = (stepId: number) => {
  return db
    .prepare(`SELECT id, key, name, sequence, description FROM assessment_steps WHERE id = ?`)
    .get(stepId) as { id: number; key: StepKey; name: string; sequence: number; description: string } | undefined;
};

export const getStepByKey = (stepKey: StepKey) => {
  return db
    .prepare(`SELECT id, key, name, sequence, description FROM assessment_steps WHERE key = ?`)
    .get(stepKey) as { id: number; key: StepKey; name: string; sequence: number; description: string } | undefined;
};

export const getQuestionsForStep = (stepKey: StepKey) => {
  return db
    .prepare(
      `SELECT id, question_key, question_text, factor, help_text, input_type, sequence
       FROM questions WHERE step_key = ? ORDER BY sequence`
    )
    .all(stepKey) as Array<{
    id: number;
    question_key: string;
    question_text: string;
    factor: string;
    help_text: string | null;
    input_type: string;
    sequence: number;
  }>;
};

export const getResponsesForAssessment = (assessmentId: number) => {
  return db
    .prepare(
      `SELECT q.question_key, r.response_text, r.question_id
       FROM responses r
       JOIN questions q ON r.question_id = q.id
       WHERE r.assessment_id = ?`
    )
    .all(assessmentId) as Array<{ question_key: string; response_text: string; question_id: number }>;
};

export const getAssessmentWithStep = (assessmentId: number) => {
  return db
    .prepare(
      `SELECT id, name, status, current_step_id FROM assessments WHERE id = ?`
    )
    .get(assessmentId) as { id: number; name: string; status: string; current_step_id: string } | undefined;
};

export const advanceToNextStep = (assessmentId: number, currentStepKey: StepKey | null): StepKey | null => {
  const resolvedStep = currentStepKey ?? STEP_ORDER[0];
  const nextStep = getNextStep(resolvedStep);
  if (!nextStep) {
    return null;
  }

  const now = new Date().toISOString();
  db.prepare(`UPDATE assessments SET current_step_id = ?, updated_at = ? WHERE id = ?`).run(
    nextStep,
    now,
    assessmentId
  );

  return nextStep;
};

export const goToPreviousStep = (assessmentId: number, currentStepKey: StepKey): StepKey | null => {
  const prevStep = getPreviousStep(currentStepKey);
  if (!prevStep) {
    return null;
  }

  const now = new Date().toISOString();
  db.prepare(`UPDATE assessments SET current_step_id = ?, updated_at = ? WHERE id = ?`).run(
    prevStep,
    now,
    assessmentId
  );

  return prevStep;
};

export const getAllSteps = () => {
  return db
    .prepare(`SELECT id, key, name, sequence FROM assessment_steps ORDER BY sequence`)
    .all() as Array<{ id: number; key: StepKey; name: string; sequence: number }>;
};
