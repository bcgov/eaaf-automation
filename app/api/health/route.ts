import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import db from "@/lib/db/db";

type CheckStatus = "pass" | "warn" | "fail";

interface HealthCheck {
  id: string;
  label: string;
  status: CheckStatus;
  summary: string;
  details?: string;
  fix: string[];
}

function checkDbInitialized(): HealthCheck {
  const requiredTables = [
    "assessments",
    "assessment_steps",
    "questions",
    "responses",
    "recommendations",
    "assessment_history",
    "assessment_embeddings",
  ];

  try {
    const rows = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as Array<{ name: string }>;

    const tableSet = new Set(rows.map((r) => r.name));
    const missing = requiredTables.filter((t) => !tableSet.has(t));

    if (missing.length > 0) {
      return {
        id: "db",
        label: "Database initialized",
        status: "fail",
        summary: `Missing required tables: ${missing.join(", ")}`,
        fix: [
          "Run: npm run db:init",
          "Confirm seed file exists: seed-data/seed-questions.local.json",
          "If first-time setup, run: .\\setup-dev.ps1",
        ],
      };
    }

    const questions = db.prepare("SELECT COUNT(*) as c FROM questions").get() as { c: number };
    const steps = db.prepare("SELECT COUNT(*) as c FROM assessment_steps").get() as { c: number };

    if (questions.c === 0 || steps.c === 0) {
      return {
        id: "db",
        label: "Database initialized",
        status: "fail",
        summary: "Database schema exists but question/step seed data is empty.",
        details: `questions=${questions.c}, steps=${steps.c}`,
        fix: [
          "Run: npm run db:init",
          "Verify: seed-data/seed-questions.local.json is present",
          "Re-run setup: .\\setup-dev.ps1",
        ],
      };
    }

    return {
      id: "db",
      label: "Database initialized",
      status: "pass",
      summary: "Schema and required baseline data are present.",
      details: `questions=${questions.c}, steps=${steps.c}`,
      fix: [],
    };
  } catch (error) {
    return {
      id: "db",
      label: "Database initialized",
      status: "fail",
      summary: "Database check failed.",
      details: error instanceof Error ? error.message : String(error),
      fix: [
        "Run: npm run db:init",
        "If issue persists, run: .\\setup-dev.ps1",
      ],
    };
  }
}

function checkSeedFiles(): HealthCheck {
  const root = process.cwd();
  const requiredSeed = path.join(root, "seed-data", "seed-questions.local.json");
  const optionalSeed = path.join(root, "seed-data", "assessments-seed.local.json");

  const hasRequired = fs.existsSync(requiredSeed);
  const hasOptional = fs.existsSync(optionalSeed);

  if (!hasRequired) {
    return {
      id: "seed",
      label: "Seed data files",
      status: "fail",
      summary: "Required seed file is missing.",
      details: "seed-data/seed-questions.local.json not found",
      fix: [
        "Request from team lead: seed-data/seed-questions.local.json",
        "Place it under: seed-data/",
        "Run: npm run db:init",
      ],
    };
  }

  if (!hasOptional) {
    return {
      id: "seed",
      label: "Seed data files",
      status: "warn",
      summary: "Required seed exists; historical seed file is missing (optional).",
      details: "Optional file missing: seed-data/assessments-seed.local.json",
      fix: [
        "Optional: request seed-data/assessments-seed.local.json from team",
        "Then run: npm run db:seed:assessments",
      ],
    };
  }

  return {
    id: "seed",
    label: "Seed data files",
    status: "pass",
    summary: "Required and optional seed files are present.",
    fix: [],
  };
}

async function checkEmbeddingService(): Promise<HealthCheck> {
  const serviceUrl = process.env.LOCAL_EMBEDDING_SERVICE_URL || "http://127.0.0.1:8001";

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(`${serviceUrl}/health`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return {
        id: "embedding",
        label: "Local embedding service",
        status: "fail",
        summary: `Service responded with HTTP ${res.status}`,
        fix: [
          "Run: npm run embeddings:service",
          "If first-time setup, run: .\\setup-dev.ps1",
          "If pip error occurs, install deps in local-embedding-service/.venv",
        ],
      };
    }

    const payload = (await res.json()) as { status?: string; model?: string };
    const model = payload?.model || "unknown model";

    return {
      id: "embedding",
      label: "Local embedding service",
      status: "pass",
      summary: "Service is reachable and healthy.",
      details: `model=${model}`,
      fix: [],
    };
  } catch (error) {
    return {
      id: "embedding",
      label: "Local embedding service",
      status: "fail",
      summary: "Service is not reachable.",
      details: error instanceof Error ? error.message : String(error),
      fix: [
        "Run: npm run embeddings:service",
        "If this fails, run: .\\setup-dev.ps1",
        "Check Python install: python --version",
      ],
    };
  }
}

function checkAppServer(): HealthCheck {
  return {
    id: "app",
    label: "Application server rendering",
    status: "pass",
    summary: "Health page rendered successfully.",
    details: "If you can see this page, Next.js server is up.",
    fix: [],
  };
}

export async function GET() {
  const checks: HealthCheck[] = [
    checkAppServer(),
    checkDbInitialized(),
    checkSeedFiles(),
    await checkEmbeddingService(),
  ];

  const hasFail = checks.some((c) => c.status === "fail");
  const hasWarn = checks.some((c) => c.status === "warn");

  const overall: CheckStatus = hasFail ? "fail" : hasWarn ? "warn" : "pass";

  return NextResponse.json(
    {
      overall,
      generatedAt: new Date().toISOString(),
      checks,
      readmeQuickFixes: [
        "Run first-time setup: .\\setup-dev.ps1",
        "Start dev server: npm run dev",
        "Start embedding service: npm run embeddings:service",
        "Initialize DB: npm run db:init",
        "Seed assessments (optional): npm run db:seed:assessments",
      ],
    },
    {
      status: overall === "fail" ? 503 : 200,
      headers: { "Cache-Control": "no-store" },
    }
  );
}
