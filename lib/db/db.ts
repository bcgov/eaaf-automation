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

export default db;