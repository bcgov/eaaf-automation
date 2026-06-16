import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// @ts-ignore
import type {} from "better-sqlite3";

const dataDir = path.join(process.cwd(), "data");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "app.db");

const db = new Database(dbPath);

// WAL mode
db.pragma("journal_mode = WAL");

// safer defaults
db.pragma("synchronous = NORMAL");
db.pragma("foreign_keys = ON");

function tableExists(tableName: string): boolean {
  const row = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(tableName);
  return !!row;
}

function addColumnIfMissing(tableName: string, columnDefinition: string): void {
  if (!tableExists(tableName)) return;
  try {
    db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${columnDefinition}`).run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("duplicate column name")) {
      throw error;
    }
  }
}

addColumnIfMissing("recommendations", "architect_approval TEXT");
addColumnIfMissing("recommendations", "architect_approval_reason TEXT");
addColumnIfMissing("recommendations", "architect_approval_recorded_at DATETIME");

export default db;