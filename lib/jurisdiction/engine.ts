/**
 * Jurisdiction Scan — Engine
 *
 * Builds the structured prompt from BC Gov assessment inputs,
 * calls the AI layer, parses the JSON response, and returns
 * a normalized JurisdictionScanResult.
 */

import { callAI } from "./ai-client";
import { getJurisdictionAIConfig, JurisdictionRegion } from "./config";
import { jsonrepair } from "jsonrepair";

const REGION_LABELS: Record<JurisdictionRegion, string> = {
  canada: "Canadian provinces and territories",
  us: "US states and federal agencies",
  europe: "European countries and EU institutions",
  other: "global implementations outside Canada, US, and Europe",
};

const REGION_JURISDICTION_HINT: Record<JurisdictionRegion, string> = {
  canada: "Province or territory name",
  us: "US State or federal agency name",
  europe: "Country or EU institution name",
  other: "Country or region name",
};

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
  configuredRegions: string[];
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

function buildUserPrompt(inputs: JurisdictionScanInputs, regions: JurisdictionRegion[]): string {
  const regionDescriptions = regions.map((r) => REGION_LABELS[r]).join(", ");
  const jsonKeys = regions.map((r) => `  "${r}": []`).join(",\n");
  const schemaExamples = regions
    .map((r) => `Each array entry in "${r}" must use this exact schema:\n{\n  "jurisdiction": "${REGION_JURISDICTION_HINT[r]}",\n  "organization": "Actual organization name",\n  "sector": "public",\n  "solution": "What they implemented and how it addressed their problem",\n  "platform": "Technology or platform used (e.g. Salesforce, ServiceNow, Custom)",\n  "alignmentScore": 82,\n  "alignmentRationale": "Why this case is relevant to BC Gov's situation",\n  "businessProblemAlignment": "How their business problem matched BC Gov's",\n  "driverAlignment": "Which of BC Gov's drivers this case reflects",\n  "requirementAlignment": "Which of BC Gov's requirements this case satisfies",\n  "currentStateComparison": "How their starting point compared to BC Gov's current state",\n  "proposedSolutionComparison": "How their implemented solution compares to BC Gov's proposed solution",\n  "referenceUrl": "A real URL you know of, or null"\n}`)
    .join("\n\n");

  const fieldLines = [
    inputs.businessProblem && `- Business Problem: ${inputs.businessProblem}`,
    inputs.drivers        && `- Drivers: ${inputs.drivers}`,
    inputs.requirements   && `- Requirements: ${inputs.requirements}`,
    inputs.currentState   && `- Current State: ${inputs.currentState}`,
    inputs.proposedSolution && `- Proposed Solution: ${inputs.proposedSolution}`,
  ].filter(Boolean).join("\n");

  return `Identify the most relevant real-world public sector implementations from the following regions: ${regionDescriptions}. This is for a BC Government enterprise architecture assessment.

ASSESSMENT: ${inputs.assessmentName}

BC GOV INPUTS:
${fieldLines}

Return a single JSON object with this EXACT structure (valid JSON only, no extra text):
{
${jsonKeys},
  "publicSectorAvailable": true
}

${schemaExamples}

RULES:
1. Return TOP 2 entries per region, sorted by alignmentScore descending. Include fewer if fewer are known.
2. PRIORITIZE public sector (sector: "public"). Only use private sector if no public examples exist for that region.
3. Set "publicSectorAvailable": true if all entries across all regions are public sector, false otherwise.
4. alignmentScore must be an integer 1–100. Only include entries with score >= 50.
5. Only include organizations and cases you have reasonable factual knowledge of. Do not fabricate.
6. Focus on implementations from the last 10 years where possible.
7. CRITICAL: Keep ALL text field values under 120 characters each. Be concise.`;
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
    .slice(0, 2);
}

// ── Public API ────────────────────────────────────────────────────────────

export async function runJurisdictionScan(
  inputs: JurisdictionScanInputs
): Promise<JurisdictionScanResult> {
  const config = getJurisdictionAIConfig();

  const userPrompt = buildUserPrompt(inputs, config.regions);
  console.log("[JurisdictionScan] Config:", {
    provider: config.provider,
    endpoint: config.endpoint,
    model: config.model,
    maxTokens: config.maxTokens,
    temperature: config.temperature,
    hasKey: !!config.apiKey,
  });
  console.log("[JurisdictionScan] User prompt (first 500 chars):", userPrompt.slice(0, 500));

  const regions = config.regions;
  const response = await callAI(config, {
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
  });

  console.log("[JurisdictionScan] Raw AI response (first 500 chars):", response.content.slice(0, 500));

  // Strip markdown fences some models wrap JSON in
  const cleaned = response.content
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Response was likely truncated — attempt repair before giving up
    try {
      const repaired = jsonrepair(cleaned);
      parsed = JSON.parse(repaired);
      console.warn("[JurisdictionScan] JSON was repaired (likely truncated response).");
    } catch {
      console.error("[JurisdictionScan] JSON repair failed. Full response:", response.content);
      throw new Error(
        `AI response was not valid JSON (likely truncated — try increasing JURISDICTION_AI_MAX_TOKENS). Preview: ${response.content.slice(0, 300)}`
      );
    }
  }

  return {
    canada: regions.includes("canada") ? normalizeEntries(parsed.canada) : [],
    us: regions.includes("us") ? normalizeEntries(parsed.us) : [],
    europe: regions.includes("europe") ? normalizeEntries(parsed.europe) : [],
    other: regions.includes("other") ? normalizeEntries(parsed.other) : [],
    configuredRegions: regions,
    publicSectorAvailable: parsed.publicSectorAvailable !== false,
    generatedAt: new Date().toISOString(),
    aiProvider: response.provider,
    aiModel: response.model,
    inputs,
  };
}
