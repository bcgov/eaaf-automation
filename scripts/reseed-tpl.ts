import db from "../lib/db/db";
import { seedTPLAssessment } from "./seed-tpl.ts";

// Delete old assessments and their data
console.log("Cleaning up old assessments...");

const assessmentId = db
  .prepare("SELECT id FROM assessments WHERE name = 'TPL 2024'")
  .get() as { id: number } | undefined;

if (assessmentId) {
  // Delete in order of foreign key dependencies
  db.prepare("DELETE FROM responses WHERE assessment_id = ?").run(assessmentId.id);
  db.prepare("DELETE FROM recommendations WHERE assessment_id = ?").run(assessmentId.id);
  db.prepare("DELETE FROM assessment_step_state WHERE assessment_id = ?").run(assessmentId.id);
  db.prepare("DELETE FROM assessment_history WHERE assessment_id = ?").run(assessmentId.id);
  const deleted = db.prepare("DELETE FROM assessments WHERE id = ?").run(assessmentId.id).changes;
  console.log(`Deleted ${deleted} old TPL assessment and associated data`);
}

// Re-seed TPL with business context
seedTPLAssessment();
