import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { generateRecommendation } from "../lib/deterministic/engine";

type HistoricalAssessment = {
  assessmentName: string;
  status: string;
  currentStepId: string;
  businessContext: string;
  businessGoal: string;
  businessGoals: string;
  businessDriver: string;
  businessDrivers: string;
  businessRequirement: string;
  sampleResponses: Array<{ questionKey: string; response: string }>;
  recommendation: {
    platformRecommendation: string;
    rationale: string;
    confidenceScore: number;
    risks: string;
    alternatives: string;
    architectApproval?: string | null;
    architectApprovalReason?: string | null;
    architectApprovalRecordedAt?: string | null;
  } | null;
};

const seedHistoricalAssessments = () => {
  const dbPath = path.join(process.cwd(), "data", "app.db");
  const db = new Database(dbPath);

  console.log("🌱 Seeding assessment data pack (TPL + non-TPL)...\n");

  // Load combined assessments seed data
  const seedFilePath = process.env.EAAF_ASSESSMENTS_SEED_FILE
    ? path.resolve(process.cwd(), process.env.EAAF_ASSESSMENTS_SEED_FILE)
    : process.env.HISTORICAL_ASSESSMENTS_SEED_FILE
    ? path.resolve(process.cwd(), process.env.HISTORICAL_ASSESSMENTS_SEED_FILE)
    : path.join(process.cwd(), "seed-data", "assessments-seed.local.json");
  if (!fs.existsSync(seedFilePath)) {
    console.error(`❌ Seed file not found: ${seedFilePath}`);
    console.error("   Create seed-data/assessments-seed.local.json from seed-data/assessments-seed.example.json");
    process.exit(1);
  }

  const assessmentsData: HistoricalAssessment[] = JSON.parse(fs.readFileSync(seedFilePath, "utf-8"));
  const now = new Date().toISOString();

  for (const seedData of assessmentsData) {
    // Check if assessment already exists
    const existing = db.prepare(`SELECT id FROM assessments WHERE name = ?`).get(seedData.assessmentName);
    if (existing) {
      console.log(`⏭️  Skipping "${seedData.assessmentName}" (already exists)`);
      continue;
    }

    console.log(`📝 Creating: ${seedData.assessmentName}`);

    // Create assessment
    db.prepare(`
      INSERT INTO assessments (name, status, current_step_id, business_context, business_goals, business_drivers, business_requirement, created_at, updated_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      seedData.assessmentName,
      seedData.status,
      seedData.currentStepId,
      seedData.businessContext,
      seedData.businessGoals || seedData.businessGoal,
      seedData.businessDrivers || seedData.businessDriver,
      seedData.businessRequirement,
      now,
      now,
      seedData.status === "completed" ? now : null
    );

    const assessment = db.prepare(`SELECT id FROM assessments WHERE name = ?`).get(seedData.assessmentName) as {
      id: number;
    };
    const assessmentId = assessment.id;

    // Insert responses
    let responseCount = 0;
    for (const sample of seedData.sampleResponses) {
      const question = db
        .prepare(`SELECT id, step_id FROM questions WHERE question_key = ?`)
        .get(sample.questionKey) as {
        id: number;
        step_id: number;
      } | undefined;

      if (question) {
        db.prepare(`
          INSERT INTO responses (assessment_id, question_id, step_id, response_text, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(assessmentId, question.id, question.step_id, sample.response, now, now);
        responseCount++;
      }
    }

    // Insert recommendation
    if (seedData.recommendation) {
      db.prepare(`
        INSERT INTO recommendations (assessment_id, platform_recommendation, rationale, confidence_score, risks, alternatives, architect_approval, architect_approval_reason, architect_approval_recorded_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        assessmentId,
        seedData.recommendation.platformRecommendation,
        seedData.recommendation.rationale,
        seedData.recommendation.confidenceScore,
        seedData.recommendation.risks,
        seedData.recommendation.alternatives,
        seedData.recommendation.architectApproval ?? null,
        seedData.recommendation.architectApprovalReason ?? null,
        seedData.recommendation.architectApprovalRecordedAt ?? null,
        now
      );

      // Generate platform scores and create history snapshot
      const computedResult = generateRecommendation(assessmentId);
      const snapshotJson = JSON.stringify({
        assessmentName: seedData.assessmentName,
        businessContext: seedData.businessContext,
        businessGoal: seedData.businessGoal,
        businessDriver: seedData.businessDriver,
        businessRequirement: seedData.businessRequirement,
        platformScores: computedResult.platformScores,
        platformRecommendation: seedData.recommendation.platformRecommendation,
        confidenceScore: seedData.recommendation.confidenceScore,
      });

      db.prepare(`
        INSERT INTO assessment_history (assessment_id, snapshot_json, created_at)
        VALUES (?, ?, ?)
      `).run(assessmentId, snapshotJson, now);
    }

    console.log(
      `   ✓ ID: ${assessmentId} | ${responseCount} responses${seedData.recommendation ? ` | Recommends: ${seedData.recommendation.platformRecommendation}` : ""}`
    );
  }

  console.log("\n✅ Assessment data seeding complete!");
  console.log("📊 TPL and non-TPL records were loaded from a single combined seed file.\n");

  db.close();
};

seedHistoricalAssessments();
