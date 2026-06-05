const Database = require("better-sqlite3");
const db = new Database("data/app.db");

const rows = db.prepare(`
  SELECT
    a.id AS assessment_id,
    a.name AS assessment_name,
    a.status,
    a.current_step_id AS current_step,
    q.step_key,
    q.question_key,
    q.question_text,
    COALESCE(r.response_text, '(no answer)') AS answer
  FROM assessments a
  CROSS JOIN questions q
  LEFT JOIN responses r
    ON r.assessment_id = a.id AND r.question_id = q.id
  ORDER BY a.id, q.step_key, q.sequence
`).all();

if (rows.length === 0) {
  console.log("No data found.");
  process.exit(0);
}

console.table(rows);
