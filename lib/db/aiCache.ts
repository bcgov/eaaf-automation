/**
 * Lazy-created cache table for AI-generated content (jurisdiction scan,
 * innovative solutions, assembled document). Uses INSERT OR REPLACE so the
 * latest run always wins per (assessment_id, cache_type) pair.
 */
import db from "./db";

const CREATE_SQL = `
  CREATE TABLE IF NOT EXISTS assessment_ai_cache (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    assessment_id INTEGER NOT NULL,
    cache_type    TEXT    NOT NULL,
    result_json   TEXT    NOT NULL,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(assessment_id, cache_type)
  )
`;

let ensured = false;
function ensureTable() {
  if (!ensured) {
    db.exec(CREATE_SQL);
    ensured = true;
  }
}

export function saveAiCache(assessmentId: number, cacheType: string, data: unknown): void {
  ensureTable();
  db.prepare(
    `INSERT OR REPLACE INTO assessment_ai_cache (assessment_id, cache_type, result_json) VALUES (?, ?, ?)`
  ).run(assessmentId, cacheType, JSON.stringify(data));
}

export function getAiCache<T>(
  assessmentId: number,
  cacheType: string
): { data: T; created_at: string } | null {
  ensureTable();
  const row = db
    .prepare(
      `SELECT result_json, created_at FROM assessment_ai_cache WHERE assessment_id = ? AND cache_type = ?`
    )
    .get(assessmentId, cacheType) as { result_json: string; created_at: string } | undefined;
  if (!row) return null;
  return { data: JSON.parse(row.result_json) as T, created_at: row.created_at };
}
