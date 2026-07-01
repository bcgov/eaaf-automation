const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const repoRoot = path.resolve(__dirname, "..");
const dbPath = path.join(repoRoot, "data", "app.db");
const outputPath = path.join(repoRoot, "seed-data", "assessments-seed.local.json");

const db = new Database(dbPath, { readonly: true });

const assessments = db
  .prepare(
    `SELECT id, name, status, current_step_id, business_context, business_goals, business_drivers, business_requirement
     FROM assessments
     ORDER BY id`
  )
  .all();

const getResponses = db.prepare(
  `SELECT q.question_key AS questionKey, COALESCE(r.response_text, '') AS response
   FROM responses r
   JOIN questions q ON q.id = r.question_id
   WHERE r.assessment_id = ?
   ORDER BY q.sequence`
);

const getLatestRecommendation = db.prepare(
  `SELECT platform_recommendation, rationale, confidence_score, risks, alternatives,
          architect_approval, architect_approval_reason, architect_approval_recorded_at
   FROM recommendations
   WHERE assessment_id = ?
   ORDER BY datetime(created_at) DESC, id DESC
   LIMIT 1`
);

const payload = assessments.map((a) => {
  const rec = getLatestRecommendation.get(a.id) || null;
  return {
    assessmentName: a.name || `Assessment ${a.id}`,
    status: a.status || "in_progress",
    currentStepId: a.current_step_id || null,
    businessContext: a.business_context || "",
    businessGoal: a.business_goals || "",
    businessGoals: a.business_goals || "",
    businessDriver: a.business_drivers || "",
    businessDrivers: a.business_drivers || "",
    businessRequirement: a.business_requirement || "",
    sampleResponses: getResponses.all(a.id),
    recommendation: rec
      ? {
          platformRecommendation: rec.platform_recommendation || "",
          rationale: rec.rationale || "",
          confidenceScore: rec.confidence_score ?? null,
          risks: rec.risks || "",
          alternatives: rec.alternatives || "",
          architectApproval: rec.architect_approval || null,
          architectApprovalReason: rec.architect_approval_reason || null,
          architectApprovalRecordedAt: rec.architect_approval_recorded_at || null,
        }
      : null,
  };
});

fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
db.close();

console.log(`Exported ${payload.length} assessments to ${outputPath}`);