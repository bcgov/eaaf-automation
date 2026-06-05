import Database from "better-sqlite3";
import db from "../lib/db/db";
import { loadJsonSeedFile } from "./seed-data-loader.ts";

type HierarchySeedDb = Database.Database;

type StepSeed = {
  key: string;
  name: string;
  sequence: number;
  description: string;
};

type FactorSeed = {
  id: string;
  stepKey: string;
  factorKey: string;
  name: string;
  description: string;
  displayOrder: number;
};

type SubFactorSeed = {
  id: string;
  factorId: string;
  subFactorKey: string;
  name: string;
  description: string;
  displayOrder: number;
};

type QuestionSeed = {
  questionKey: string;
  stepKey: string;
  factor: string;
  questionText: string;
  inputType: string;
  sequence: number;
  factorId: string;
  subFactorId: string;
};

type EaafHierarchySeedData = {
  steps: StepSeed[];
  factors: FactorSeed[];
  subFactors: SubFactorSeed[];
  questions: QuestionSeed[];
};

const getSeedData = () =>
  loadJsonSeedFile<EaafHierarchySeedData>(
    "EAAF_QUESTIONS_SEED_FILE",
    "seed-data/seed-questions.local.json",
    "seed-data/eaaf-seed.example.json",
  );

export const seedEaafHierarchy = (database: HierarchySeedDb) => {
  const { steps, factors, subFactors, questions } = getSeedData();

  const insertStep = database.prepare(`
    INSERT INTO assessment_steps (key, name, sequence, description)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      name = excluded.name,
      sequence = excluded.sequence,
      description = excluded.description
  `);

  for (const step of steps) {
    insertStep.run(step.key, step.name, step.sequence, step.description);
  }

  const insertFactor = database.prepare(`
    INSERT INTO "Factor" (id, stepKey, factorKey, name, description, displayOrder)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(factorKey) DO UPDATE SET
      stepKey = excluded.stepKey,
      name = excluded.name,
      description = excluded.description,
      displayOrder = excluded.displayOrder
  `);

  for (const factor of factors) {
    insertFactor.run(
      factor.id,
      factor.stepKey,
      factor.factorKey,
      factor.name,
      factor.description,
      factor.displayOrder,
    );
  }

  const insertSubFactor = database.prepare(`
    INSERT INTO "SubFactor" (id, factorId, subFactorKey, name, description, displayOrder)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(subFactorKey) DO UPDATE SET
      factorId = excluded.factorId,
      name = excluded.name,
      description = excluded.description,
      displayOrder = excluded.displayOrder
  `);

  for (const subFactor of subFactors) {
    insertSubFactor.run(
      subFactor.id,
      subFactor.factorId,
      subFactor.subFactorKey,
      subFactor.name,
      subFactor.description,
      subFactor.displayOrder,
    );
  }

  const insertQuestion = database.prepare(`
    INSERT INTO questions (
      step_id,
      question_key,
      factor,
      question_text,
      input_type,
      sequence,
      step_key,
      response_type,
      factorId,
      subFactorId
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(question_key) DO UPDATE SET
      step_id = excluded.step_id,
      factor = excluded.factor,
      question_text = excluded.question_text,
      input_type = excluded.input_type,
      sequence = excluded.sequence,
      step_key = excluded.step_key,
      response_type = excluded.response_type,
      factorId = excluded.factorId,
      subFactorId = excluded.subFactorId
  `);

  for (const question of questions) {
    const step = database
      .prepare(`SELECT id FROM assessment_steps WHERE key = ?`)
      .get(question.stepKey) as { id: number } | undefined;

    if (!step) {
      throw new Error(`Unable to resolve step: ${question.stepKey}`);
    }

    insertQuestion.run(
      step.id,
      question.questionKey,
      question.factor,
      question.questionText,
      question.inputType,
      question.sequence,
      question.stepKey,
      question.inputType,
      question.factorId,
      question.subFactorId,
    );
  }

  return {
    stepCount: steps.length,
    factorCount: factors.length,
    subFactorCount: subFactors.length,
    questionCount: questions.length,
  };
};

const runAsScript = () => {
  const result = seedEaafHierarchy(db);
  console.log(
    `Seeded EAAF hierarchy: ${result.stepCount} steps, ${result.factorCount} factors, ${result.subFactorCount} sub-factors, ${result.questionCount} questions`,
  );
};

if (process.argv[1]?.includes("seed-questions.ts")) {
  runAsScript();
}
