import db from "../lib/db/db";

const columns = db.prepare("PRAGMA table_info(assessments)").all() as Array<{ name: string }>;
console.log("Assessments table columns:");
columns.forEach((col) => console.log("  -", col.name));
