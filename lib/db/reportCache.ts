/**
 * Report cache — persists the full computed FullRec for each assessment.
 *
 * One row per assessment (UNIQUE on assessment_id). Saving always overwrites.
 * Distinct from assessment_ai_cache which stores AI scan results only
 * (jurisdiction_scan, innovative_solutions).
 */
import db from "./db";

const CREATE_SQL = `
  CREATE TABLE IF NOT EXISTS assessment_report_cache (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    assessment_id INTEGER NOT NULL UNIQUE,
    report_json   TEXT    NOT NULL,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assessment_id) REFERENCES assessments(id)
  )
`;

let ensured = false;
function ensureTable() {
  if (!ensured) {
    db.exec(CREATE_SQL);
    ensured = true;
  }
}

export function saveReportCache(assessmentId: number, data: unknown): void {
  ensureTable();
  db.prepare(
    `INSERT OR REPLACE INTO assessment_report_cache (assessment_id, report_json)
     VALUES (?, ?)`
  ).run(assessmentId, JSON.stringify(data));
}

export function getReportCache<T = Record<string, unknown>>(
  assessmentId: number
): { data: T; created_at: string } | null {
  ensureTable();
  const row = db
    .prepare(
      `SELECT report_json, created_at FROM assessment_report_cache WHERE assessment_id = ?`
    )
    .get(assessmentId) as { report_json: string; created_at: string } | undefined;
  if (!row) return null;
  return { data: JSON.parse(row.report_json) as T, created_at: row.created_at };
}

export function deleteReportCache(assessmentId: number): void {
  ensureTable();
  db.prepare(`DELETE FROM assessment_report_cache WHERE assessment_id = ?`).run(assessmentId);
}
