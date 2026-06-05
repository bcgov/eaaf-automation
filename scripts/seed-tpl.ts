import db from "../lib/db/db";
import { loadJsonSeedFile } from "./seed-data-loader.ts";

type TplResponseSeed = {
  questionKey: string;
  response: string;
};

type TplRecommendationSeed = {
  platformRecommendation: string;
  rationale: string;
  confidenceScore: number;
  risks: string;
  alternatives: string;
};

type TplSeedData = {
  assessmentName: string;
  status: string;
  currentStepId: string;
  businessContext: string;
  businessGoal: string;
  businessGoals: string;
  businessDriver: string;
  businessDrivers: string;
  businessRequirement: string;
  sampleResponses: TplResponseSeed[];
  recommendation: TplRecommendationSeed;
};

const getTplSeedData = () =>
  loadJsonSeedFile<TplSeedData>(
    "EAAF_TPL_SEED_FILE",
    "seed-data/seed-tpl.local.json",
    "seed-data/tpl-seed.example.json",
  );

const seedTPLAssessment = () => {
  console.log("Seeding TPL 2024 historical assessment...");

  const seedData = getTplSeedData();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO assessments (name, status, current_step_id, business_context, business_goal, business_goals, business_driver, business_drivers, business_requirement, created_at, updated_at, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    seedData.assessmentName,
    seedData.status,
    seedData.currentStepId,
    seedData.businessContext,
    seedData.businessGoal,
    seedData.businessGoals,
    seedData.businessDriver,
    seedData.businessDrivers,
    seedData.businessRequirement,
    now,
    now,
    now,
  );

  const assessment = db.prepare(`SELECT id FROM assessments WHERE name = ?`).get(seedData.assessmentName) as {
    id: number;
  };
  const assessmentId = assessment.id;

  console.log(`Created TPL assessment ID: ${assessmentId}`);

  for (const sample of seedData.sampleResponses) {
    const question = db.prepare(`SELECT id, step_id FROM questions WHERE question_key = ?`).get(sample.questionKey) as {
      id: number;
      step_id: number;
    } | undefined;

    if (question) {
      db.prepare(`
        INSERT INTO responses (assessment_id, question_id, step_id, response_text, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(assessmentId, question.id, question.step_id, sample.response, now, now);
    }
  }

  db.prepare(`
    INSERT INTO recommendations (assessment_id, platform_recommendation, rationale, confidence_score, risks, alternatives, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    assessmentId,
    seedData.recommendation.platformRecommendation,
    seedData.recommendation.rationale,
    seedData.recommendation.confidenceScore,
    seedData.recommendation.risks,
    seedData.recommendation.alternatives,
    now,
  );

  console.log(`✓ TPL assessment created with ${seedData.sampleResponses.length} responses and recommendation`);
};

export { seedTPLAssessment };
