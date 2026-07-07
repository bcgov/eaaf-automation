import db from "../lib/db/db";
import { EAAF_QUESTIONS } from "../lib/config/questions.ts";

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
      FOREIGN KEY (step_key) REFERENCES assessment_steps(key),
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

    CREATE TABLE IF NOT EXISTS assessment_ai_cache (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      assessment_id INTEGER NOT NULL,
      cache_type    TEXT    NOT NULL,
      result_json   TEXT    NOT NULL,
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(assessment_id, cache_type),
      FOREIGN KEY (assessment_id) REFERENCES assessments(id)
    );

    CREATE TABLE IF NOT EXISTS assessment_report_cache (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      assessment_id INTEGER NOT NULL UNIQUE,
      report_json   TEXT    NOT NULL,
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (assessment_id) REFERENCES assessments(id)
    );

    CREATE INDEX IF NOT EXISTS idx_factor_stepKey ON "Factor"(stepKey);
    CREATE INDEX IF NOT EXISTS idx_subfactor_factorId ON "SubFactor"(factorId);
    CREATE INDEX IF NOT EXISTS idx_questions_factorId ON questions(factorId);
    CREATE INDEX IF NOT EXISTS idx_questions_subFactorId ON questions(subFactorId);
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

  // Backfill and remove legacy duplicate singular columns.
  if (hasColumn("assessments", "business_goal") || hasColumn("assessments", "business_driver")) {
    db.exec(`
      UPDATE assessments
      SET business_goals = COALESCE(NULLIF(TRIM(business_goals), ''), business_goal)
      WHERE business_goal IS NOT NULL;

      UPDATE assessments
      SET business_drivers = COALESCE(NULLIF(TRIM(business_drivers), ''), business_driver)
      WHERE business_driver IS NOT NULL;
    `);

    db.exec("PRAGMA foreign_keys = OFF");
    db.exec("BEGIN TRANSACTION");
    try {
      db.exec(`
        CREATE TABLE assessments_new (
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

        INSERT INTO assessments_new (
          id, name, description, status, current_step_id,
          business_context, business_goals, business_drivers, business_requirement,
          created_at, updated_at, completed_at
        )
        SELECT
          id, name, description, status, current_step_id,
          business_context,
          COALESCE(NULLIF(TRIM(business_goals), ''), business_goal),
          COALESCE(NULLIF(TRIM(business_drivers), ''), business_driver),
          business_requirement,
          created_at, updated_at, completed_at
        FROM assessments;

        DROP TABLE assessments;
        ALTER TABLE assessments_new RENAME TO assessments;
      `);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      db.exec("PRAGMA foreign_keys = ON");
      throw error;
    }
    db.exec("PRAGMA foreign_keys = ON");
  }

  if (!hasColumn("recommendations", "architect_approval")) {
    db.exec("ALTER TABLE recommendations ADD COLUMN architect_approval TEXT");
  }

  if (!hasColumn("recommendations", "architect_approval_reason")) {
    db.exec("ALTER TABLE recommendations ADD COLUMN architect_approval_reason TEXT");
  }

  if (!hasColumn("recommendations", "architect_approval_recorded_at")) {
    db.exec("ALTER TABLE recommendations ADD COLUMN architect_approval_recorded_at DATETIME");
  }

  // Migrate full_report and assembled_document from assessment_ai_cache to assessment_report_cache.
  // assessment_ai_cache should only hold AI scan results (jurisdiction_scan, innovative_solutions).
  db.exec(`
    INSERT OR IGNORE INTO assessment_report_cache (assessment_id, report_json, created_at)
    SELECT assessment_id, result_json, created_at
    FROM assessment_ai_cache
    WHERE cache_type = 'full_report';

    DELETE FROM assessment_ai_cache WHERE cache_type IN ('full_report', 'assembled_document');
  `);

  // Completion rule change: assessments are only 'completed' after architect approval.
  // Reset any 'completed' assessment whose recommendation has no recorded architect decision.
  db.exec(`
    UPDATE assessments
    SET status = 'in_progress', completed_at = NULL, updated_at = CURRENT_TIMESTAMP
    WHERE status = 'completed'
      AND id NOT IN (
        SELECT assessment_id FROM recommendations
        WHERE architect_approval IN ('agree', 'disagree')
      )
  `);

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

  // ── Sync question config from eaaf-questions.json ───────────────────────
  // Uses ON CONFLICT ... DO UPDATE so existing row IDs are preserved.
  // Questions are never deleted — responses depend on question_id FK.
  const syncResult = db.transaction(() => {
    const upsertStep = db.prepare(`
      INSERT INTO assessment_steps (key, name, sequence, description)
      VALUES (@key, @name, @sequence, @description)
      ON CONFLICT(key) DO UPDATE SET
        name        = excluded.name,
        sequence    = excluded.sequence,
        description = excluded.description
    `);

    const upsertFactor = db.prepare(`
      INSERT INTO "Factor" (id, stepKey, factorKey, name, description, displayOrder)
      VALUES (@id, @stepKey, @factorKey, @name, @description, @displayOrder)
      ON CONFLICT(id) DO UPDATE SET
        stepKey      = excluded.stepKey,
        factorKey    = excluded.factorKey,
        name         = excluded.name,
        description  = excluded.description,
        displayOrder = excluded.displayOrder
    `);

    const upsertSubFactor = db.prepare(`
      INSERT INTO "SubFactor" (id, factorId, subFactorKey, name, description, displayOrder)
      VALUES (@id, @factorId, @subFactorKey, @name, @description, @displayOrder)
      ON CONFLICT(id) DO UPDATE SET
        factorId     = excluded.factorId,
        subFactorKey = excluded.subFactorKey,
        name         = excluded.name,
        description  = excluded.description,
        displayOrder = excluded.displayOrder
    `);

    const getStepId = db.prepare<{ key: string }, { id: number }>(
      `SELECT id FROM assessment_steps WHERE key = @key`
    );

    const upsertQuestion = db.prepare(`
      INSERT INTO questions
        (step_id, question_key, factor, question_text, input_type, sequence, step_key, factorId, subFactorId)
      VALUES
        (@step_id, @question_key, @factor, @question_text, @input_type, @sequence, @step_key, @factorId, @subFactorId)
      ON CONFLICT(question_key) DO UPDATE SET
        step_id       = excluded.step_id,
        factor        = excluded.factor,
        question_text = excluded.question_text,
        input_type    = excluded.input_type,
        sequence      = excluded.sequence,
        step_key      = excluded.step_key,
        factorId      = excluded.factorId,
        subFactorId   = excluded.subFactorId
    `);

    for (const s of EAAF_QUESTIONS.steps) {
      upsertStep.run(s);
    }

    for (const f of EAAF_QUESTIONS.factors) {
      upsertFactor.run(f);
    }

    for (const sf of EAAF_QUESTIONS.subFactors) {
      upsertSubFactor.run(sf);
    }

    let questionCount = 0;
    for (const q of EAAF_QUESTIONS.questions) {
      const step = getStepId.get({ key: q.stepKey });
      if (!step) {
        throw new Error(`init-db: question "${q.questionKey}" references unknown stepKey "${q.stepKey}"`);
      }
      upsertQuestion.run({
        step_id:       step.id,
        question_key:  q.questionKey,
        factor:        q.factor,
        question_text: q.questionText,
        input_type:    q.inputType,
        sequence:      q.sequence,
        step_key:      q.stepKey,
        factorId:      q.factorId,
        subFactorId:   q.subFactorId,
      });
      questionCount++;
    }

    return {
      stepCount:      EAAF_QUESTIONS.steps.length,
      factorCount:    EAAF_QUESTIONS.factors.length,
      subFactorCount: EAAF_QUESTIONS.subFactors.length,
      questionCount,
    };
  })();

  console.log("✓ Database tables created successfully");
  console.log(`✓ Synced ${syncResult.stepCount} assessment steps from config`);
  console.log(`✓ Synced ${syncResult.factorCount} factors from config`);
  console.log(`✓ Synced ${syncResult.subFactorCount} sub-factors from config`);
  console.log(`✓ Synced ${syncResult.questionCount} questions from config`);
};

initializeDatabase();
