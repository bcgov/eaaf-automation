PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS assessments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'in_progress', 'completed', 'archived')),
  current_step_id TEXT,
  business_context TEXT,
  business_goals TEXT,
  business_drivers TEXT,
  business_requirement TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);

CREATE TABLE IF NOT EXISTS assessment_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS "Factor" (
  id TEXT PRIMARY KEY,
  stepKey TEXT NOT NULL,
  factorKey TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  displayOrder INTEGER,
  FOREIGN KEY (stepKey) REFERENCES assessment_steps(key)
);

CREATE TABLE IF NOT EXISTS "SubFactor" (
  id TEXT PRIMARY KEY,
  factorId TEXT NOT NULL,
  subFactorKey TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  displayOrder INTEGER,
  FOREIGN KEY (factorId) REFERENCES "Factor"(id)
);

CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  step_id INTEGER NOT NULL,
  question_key TEXT UNIQUE NOT NULL,
  factor TEXT NOT NULL,
  question_text TEXT NOT NULL,
  help_text TEXT,
  input_type TEXT DEFAULT 'free_text',
  sequence INTEGER NOT NULL,
  step_key TEXT,
  response_type TEXT,
  factorId TEXT,
  subFactorId TEXT,
  FOREIGN KEY (step_id) REFERENCES assessment_steps(id),
  FOREIGN KEY (step_key) REFERENCES assessment_steps(key),
  FOREIGN KEY (factorId) REFERENCES "Factor"(id),
  FOREIGN KEY (subFactorId) REFERENCES "SubFactor"(id)
);

CREATE TABLE IF NOT EXISTS responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assessment_id INTEGER NOT NULL,
  question_id INTEGER NOT NULL,
  step_id INTEGER NOT NULL,
  response_text TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (assessment_id) REFERENCES assessments(id),
  FOREIGN KEY (question_id) REFERENCES questions(id),
  FOREIGN KEY (step_id) REFERENCES assessment_steps(id)
);

CREATE TABLE IF NOT EXISTS assessment_step_state (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assessment_id INTEGER NOT NULL,
  step_id INTEGER NOT NULL,
  status TEXT DEFAULT 'not_started' CHECK(status IN ('not_started', 'in_progress', 'completed')),
  started_at DATETIME,
  completed_at DATETIME,
  FOREIGN KEY (assessment_id) REFERENCES assessments(id),
  FOREIGN KEY (step_id) REFERENCES assessment_steps(id),
  UNIQUE(assessment_id, step_id)
);

CREATE TABLE IF NOT EXISTS recommendations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assessment_id INTEGER NOT NULL,
  platform_recommendation TEXT NOT NULL,
  rationale TEXT,
  confidence_score INTEGER CHECK(confidence_score >= 0 AND confidence_score <= 100),
  risks TEXT,
  alternatives TEXT,
  architect_approval TEXT,
  architect_approval_reason TEXT,
  architect_approval_recorded_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (assessment_id) REFERENCES assessments(id)
);

CREATE TABLE IF NOT EXISTS assessment_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assessment_id INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (assessment_id) REFERENCES assessments(id)
);

CREATE TABLE IF NOT EXISTS assessment_embeddings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assessment_id INTEGER NOT NULL UNIQUE,
  context_embedding TEXT NOT NULL,
  embedding_model TEXT DEFAULT 'all-MiniLM-L6-v2',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (assessment_id) REFERENCES assessments(id)
);

CREATE INDEX IF NOT EXISTS idx_factor_stepKey ON "Factor"(stepKey);
CREATE INDEX IF NOT EXISTS idx_subfactor_factorId ON "SubFactor"(factorId);
CREATE INDEX IF NOT EXISTS idx_questions_factorId ON questions(factorId);
CREATE INDEX IF NOT EXISTS idx_questions_subFactorId ON questions(subFactorId);
