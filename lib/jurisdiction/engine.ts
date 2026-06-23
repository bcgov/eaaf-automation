/**
 * Jurisdiction Scan — Engine
 *
 * Builds the structured prompt from BC Gov assessment inputs,
 * calls the AI layer, parses the JSON response, and returns
 * a normalized JurisdictionScanResult.
 */

import { callAI } from "./ai-client";
import { getJurisdictionAIConfig } from "./config";

export interface JurisdictionScanInputs {
  assessmentName: string;
  businessProblem: string;
  drivers: string;
  requirements: string;
  currentState: string;
  proposedSolution: string;
}

export interface JurisdictionEntry {
  jurisdiction: string;
  organization: string;
  sector: "public" | "private";
  solution: string;
  platform: string | null;
  alignmentScore: number;
  alignmentRationale: string;
  businessProblemAlignment: string;
  driverAlignment: string;
  requirementAlignment: string;
  currentStateComparison: string;
  proposedSolutionComparison: string;
  referenceUrl: string | null;
}

export interface JurisdictionScanResult {
  canada: JurisdictionEntry[];
  us: JurisdictionEntry[];
  europe: JurisdictionEntry[];
  other: JurisdictionEntry[];
  publicSectorAvailable: boolean;
  generatedAt: string;
  aiProvider: string;
  aiModel: string;
  inputs: JurisdictionScanInputs;
}

// ── Prompts ───────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert in public sector digital transformation and enterprise architecture.
You have deep knowledge of government technology implementations globally, including case management systems,
CRM platforms, ITSM tools, low-code platforms, and custom builds across Canadian, US, European, and global jurisdictions.

Your task is to scan your knowledge for real-world implementations that are most closely aligned with a
BC Government enterprise architecture assessment. Output ONLY valid JSON — no markdown, no commentary.`;

function buildUserPrompt(inputs: JurisdictionScanInputs): string {
  return `Identify the most relevant real-world implementations for the following BC Government assessment.

ASSESSMENT: ${inputs.assessmentName}

BC GOV INPUTS:
- Business Problem: ${inputs.businessProblem || "Not specified"}
- Drivers: ${inputs.drivers || "Not specified"}
- Requirements: ${inputs.requirements || "Not specified"}
- Current State: ${inputs.currentState || "Not captured"}
- Proposed Solution: ${inputs.proposedSolution || "Not yet determined"}

Return a single JSON object with this EXACT structure (valid JSON only, no extra text):
{
  "canada": [],
  "us": [],
  "europe": [],
  "other": [],
  "publicSectorAvailable": true
}

Each array entry must use this exact schema:
{
  "jurisdiction": "Province / State / Country name",
  "organization": "Actual organization name",
  "sector": "public",
  "solution": "What they implemented and how it addressed their problem",
  "platform": "Technology or platform used (e.g. Salesforce, ServiceNow, Custom)",
  "alignmentScore": 82,
  "alignmentRationale": "Why this case is relevant to BC Gov's situation",
  "businessProblemAlignment": "How their business problem matched BC Gov's",
  "driverAlignment": "Which of BC Gov's drivers this case reflects",
  "requirementAlignment": "Which of BC Gov's requirements this case satisfies",
  "currentStateComparison": "How their starting point compared to BC Gov's current state",
  "proposedSolutionComparison": "How their implemented solution compares to BC Gov's proposed solution",
  "referenceUrl": "A real URL you know of, or null"
}

RULES:
1. Return TOP 3 per region, sorted by alignmentScore descending. Include fewer if fewer are known.
2. PRIORITIZE public sector (sector: "public"). Only use private sector if no public examples exist for that region.
3. If all regions use public sector examples, set "publicSectorAvailable": true. If any region falls back to private, set false.
4. alignmentScore must be an integer 1–100. Only include entries with score >= 50.
5. Only include organizations and cases you have reasonable factual knowledge of. Do not fabricate.
6. Focus on implementations from the last 10 years where possible.
7. "other" covers notable global implementations outside Canada, US, and Europe.`;
}

// ── Parsing & normalization ───────────────────────────────────────────────

function normalizeEntries(raw: unknown): JurisdictionEntry[] {
  if (!Array.isArray(raw)) return [];
  return (raw as JurisdictionEntry[])
    .filter((e) => e && typeof e === "object" && typeof e.organization === "string")
    .map((e) => ({
      jurisdiction: String(e.jurisdiction ?? ""),
      organization: String(e.organization ?? ""),
      sector: (e.sector === "private" ? "private" : "public") as "public" | "private",
      solution: String(e.solution ?? ""),
      platform: e.platform ? String(e.platform) : null,
      alignmentScore: Math.min(100, Math.max(0, Number(e.alignmentScore) || 0)),
      alignmentRationale: String(e.alignmentRationale ?? ""),
      businessProblemAlignment: String(e.businessProblemAlignment ?? ""),
      driverAlignment: String(e.driverAlignment ?? ""),
      requirementAlignment: String(e.requirementAlignment ?? ""),
      currentStateComparison: String(e.currentStateComparison ?? ""),
      proposedSolutionComparison: String(e.proposedSolutionComparison ?? ""),
      referenceUrl: e.referenceUrl ? String(e.referenceUrl) : null,
    }))
    .sort((a, b) => b.alignmentScore - a.alignmentScore)
    .slice(0, 3);
}

// ── Public API ────────────────────────────────────────────────────────────

export async function runJurisdictionScan(
  inputs: JurisdictionScanInputs
): Promise<JurisdictionScanResult> {
  const config = getJurisdictionAIConfig();

  const response = await callAI(config, {
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: buildUserPrompt(inputs),
  });

  // Strip markdown fences some models wrap JSON in
  const cleaned = response.content
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(
      `AI response was not valid JSON. Preview: ${response.content.slice(0, 300)}`
    );
  }

  return {
    canada: normalizeEntries(parsed.canada),
    us: normalizeEntries(parsed.us),
    europe: normalizeEntries(parsed.europe),
    other: normalizeEntries(parsed.other),
    publicSectorAvailable: parsed.publicSectorAvailable !== false,
    generatedAt: new Date().toISOString(),
    aiProvider: response.provider,
    aiModel: response.model,
    inputs,
  };
}
