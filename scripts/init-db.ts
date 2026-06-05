import db from "../lib/db/db";

const initializeDatabase = () => {
  console.log("Initializing database...");

  db.exec(`
    CREATE TABLE IF NOT EXISTS assessments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'in_progress', 'completed', 'archived')),
      current_step_id INTEGER,
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

    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      step_id INTEGER NOT NULL,
      question_key TEXT UNIQUE NOT NULL,
      factor TEXT NOT NULL,
      question_text TEXT NOT NULL,
      help_text TEXT,
      input_type TEXT DEFAULT 'free_text',
      sequence INTEGER NOT NULL,
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

  // Seed assessment steps
  const steps = [
    { key: "ARCHITECTURE", name: "Architecture Assessment", sequence: 1, desc: "Assess current and target architecture" },
    { key: "CLOUD", name: "Cloud Assessment", sequence: 2, desc: "Evaluate cloud readiness and strategy" },
    { key: "PLATFORM", name: "Platform Assessment", sequence: 3, desc: "Identify required platforms and tools" },
    { key: "BUSINESS_OPS", name: "Business & Operations Assessment", sequence: 4, desc: "Understand business operations and constraints" },
  ];

  for (const step of steps) {
    db.prepare(
      `INSERT OR IGNORE INTO assessment_steps (key, name, sequence, description) VALUES (?, ?, ?, ?)`
    ).run(step.key, step.name, step.sequence, step.desc);
  }

  // Seed questions per step
  const questions = [
    // Architecture
    { stepKey: "ARCHITECTURE", qkey: "Q001", factor: "business_capability_alignment", text: "Does the solution align with an approved business capability?", type: "free_text", seq: 1 },
    { stepKey: "ARCHITECTURE", qkey: "Q002", factor: "architecture_patterns", text: "What architecture patterns does your organization follow?", type: "free_text", seq: 2 },
    // Cloud
    { stepKey: "CLOUD", qkey: "Q003", factor: "cloud_strategy", text: "What is your cloud adoption strategy (cloud-first, hybrid, on-prem)?", type: "free_text", seq: 1 },
    { stepKey: "CLOUD", qkey: "Q004", factor: "data_residency", text: "What are your data residency and compliance requirements?", type: "free_text", seq: 2 },
    // Platform
    { stepKey: "PLATFORM", qkey: "Q005", factor: "case_management", text: "Do you need case management capabilities?", type: "free_text", seq: 1 },
    { stepKey: "PLATFORM", qkey: "Q006", factor: "it_operations", text: "What IT operations functions are critical?", type: "free_text", seq: 2 },
    // Business & Ops
    { stepKey: "BUSINESS_OPS", qkey: "Q007", factor: "user_base", text: "How many concurrent users will the platform support?", type: "free_text", seq: 1 },
    { stepKey: "BUSINESS_OPS", qkey: "Q008", factor: "integration_needs", text: "What systems does this platform need to integrate with?", type: "free_text", seq: 2 },
  ];

  const insertQuestion = db.prepare(`
    INSERT INTO questions (step_id, question_key, factor, question_text, input_type, sequence, step_key, response_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(question_key) DO UPDATE SET
      factor = excluded.factor,
      question_text = excluded.question_text,
      input_type = excluded.input_type,
      sequence = excluded.sequence
  `);

  for (const q of questions) {
    const step = db.prepare(`SELECT id FROM assessment_steps WHERE key = ?`).get(q.stepKey) as { id: number } | undefined;
    if (step) {
      insertQuestion.run(step.id, q.qkey, q.factor, q.text, q.type, q.seq, q.stepKey, q.type);
    }
  }

  console.log("✓ Database tables created successfully");
  console.log(`✓ Seeded ${steps.length} assessment steps`);
  console.log(`✓ Seeded ${questions.length} questions`);
};

initializeDatabase();
