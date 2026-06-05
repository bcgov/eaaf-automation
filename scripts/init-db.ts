import db from "../lib/db/db";
import { seedEaafHierarchy } from "./seed-questions.ts";
import { seedTPLAssessment } from "./seed-tpl.ts";

const initializeDatabase = () => {
  console.log("Initializing database...");

  db.exec(`
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
      business_goal TEXT,
      business_driver TEXT,
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
      FOREIGN KEY (factorId) REFERENCES "Factor"(id),
      FOREIGN KEY (subFactorId) REFERENCES "SubFactor"(id),
      FOREIGN KEY (step_id) REFERENCES assessment_steps(id)
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
  `);

  const hasColumn = (tableName: string, columnName: string) => {
    const columns = db
      .prepare(`PRAGMA table_info(${tableName})`)
      .all() as Array<{ name: string }>;
    return columns.some((column) => column.name === columnName);
  };

  if (!hasColumn("questions", "step_key")) {
    db.exec("ALTER TABLE questions ADD COLUMN step_key TEXT");
  }

  if (!hasColumn("questions", "response_type")) {
    db.exec("ALTER TABLE questions ADD COLUMN response_type TEXT");
  }

  if (!hasColumn("questions", "factorId")) {
    db.exec("ALTER TABLE questions ADD COLUMN factorId TEXT");
  }

  if (!hasColumn("questions", "subFactorId")) {
    db.exec("ALTER TABLE questions ADD COLUMN subFactorId TEXT");
  }

  if (!hasColumn("assessments", "business_context")) {
    db.exec("ALTER TABLE assessments ADD COLUMN business_context TEXT");
  }

  if (!hasColumn("assessments", "business_goals")) {
    db.exec("ALTER TABLE assessments ADD COLUMN business_goals TEXT");
  }

  if (!hasColumn("assessments", "business_drivers")) {
    db.exec("ALTER TABLE assessments ADD COLUMN business_drivers TEXT");
  }

  if (!hasColumn("assessments", "business_requirement")) {
    db.exec("ALTER TABLE assessments ADD COLUMN business_requirement TEXT");
  }

  if (!hasColumn("assessments", "business_goal")) {
    db.exec("ALTER TABLE assessments ADD COLUMN business_goal TEXT");
  }

  if (!hasColumn("assessments", "business_driver")) {
    db.exec("ALTER TABLE assessments ADD COLUMN business_driver TEXT");
  }

  // Normalize legacy step keys to new hierarchy step keys
  db.exec(`
    UPDATE assessment_steps
    SET key = 'CLOUD_ASSESSMENT', name = 'Cloud Assessment', sequence = 2
    WHERE key = 'CLOUD'
      AND NOT EXISTS (SELECT 1 FROM assessment_steps s WHERE s.key = 'CLOUD_ASSESSMENT');

    UPDATE assessment_steps
    SET key = 'PLATFORM_ASSESSMENT', name = 'Platform Assessment', sequence = 3
    WHERE key = 'PLATFORM'
      AND NOT EXISTS (SELECT 1 FROM assessment_steps s WHERE s.key = 'PLATFORM_ASSESSMENT');

    UPDATE assessment_steps
    SET key = 'OPERATIONAL_CONSIDERATIONS', name = 'Operational Considerations', sequence = 4
    WHERE key = 'BUSINESS_OPS'
      AND NOT EXISTS (SELECT 1 FROM assessment_steps s WHERE s.key = 'OPERATIONAL_CONSIDERATIONS');

    UPDATE assessments SET current_step_id = 'CLOUD_ASSESSMENT' WHERE current_step_id = 'CLOUD';
    UPDATE assessments SET current_step_id = 'PLATFORM_ASSESSMENT' WHERE current_step_id = 'PLATFORM';
    UPDATE assessments SET current_step_id = 'OPERATIONAL_CONSIDERATIONS' WHERE current_step_id = 'BUSINESS_OPS';
  `);

  const seedResult = seedEaafHierarchy(db);

  console.log("✓ Database tables created successfully");
  console.log(`✓ Seeded ${seedResult.stepCount} assessment steps`);
  console.log(`✓ Seeded ${seedResult.factorCount} factors`);
  console.log(`✓ Seeded ${seedResult.subFactorCount} sub-factors`);
  console.log(`✓ Seeded ${seedResult.questionCount} questions`);

  seedTPLAssessment();
};

initializeDatabase();
