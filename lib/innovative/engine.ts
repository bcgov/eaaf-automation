/**
 * AI-Assisted Innovative Solutions — Engine
 *
 * Generates 1–2 alternative architectural ideas related to the proposed solution.
 * Exploratory only — does not challenge, score, or replace the proposed solution.
 * Reuses the same AI provider configured for the Jurisdiction Scan feature.
 */

import { callAI } from "@/lib/jurisdiction/ai-client";
import { getJurisdictionAIConfig } from "@/lib/jurisdiction/config";
import { jsonrepair } from "jsonrepair";

// ── Interfaces ────────────────────────────────────────────────────────────

export interface InnovativeSolutionsInputs {
  assessmentName: string;
  businessProblem: string;
  drivers: string;
  requirements: string;
  proposedSolution: string;
}

export interface InnovativeIdea {
  ideaName: string;
  description: string;
  whyRelevant: string;
  benefits: string[];
  risks: string[];
  applicability: string;
}

export interface InnovativeSolutionsResult {
  ideas: InnovativeIdea[];
  generatedAt: string;
  aiProvider: string;
  aiModel: string;
  inputs: InnovativeSolutionsInputs;
}

// ── Prompts ───────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior enterprise architect and technology strategist with deep expertise in digital government transformation, cloud architecture, and emerging technology patterns.

Your role is to surface exploratory, alternative architectural ideas that complement a proposed solution. You are NOT evaluating the proposed solution, recommending against it, or producing a final recommendation. You are expanding the architect's thinking with additional options worth considering.

Output ONLY valid JSON — no markdown, no commentary, no explanation outside the JSON.`;

function buildUserPrompt(inputs: InnovativeSolutionsInputs): string {
  const fieldLines = [
    inputs.businessProblem && `Business Problem:\n${inputs.businessProblem}`,
    inputs.drivers         && `Drivers:\n${inputs.drivers}`,
    inputs.requirements    && `Requirements:\n${inputs.requirements}`,
    inputs.proposedSolution && `Current Proposed Solution:\n${inputs.proposedSolution}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return `Assessment: ${inputs.assessmentName}

${fieldLines}

Generate "Section 9: AI-Assisted Innovative Solutions" for the architect reviewing this assessment.

Instructions:
- Do NOT change or challenge the proposed solution.
- Do NOT score or rank options.
- Do NOT reference jurisdictional scan results or deterministic assessment logic.
- Do NOT repeat prior analysis.
- Do NOT produce a final recommendation.
- Focus ONLY on additional ideas, enhancements, and alternative architectural approaches.
- Limit output to the most relevant 1 or 2 ideas only.

Return a JSON object with this exact structure:
{
  "ideas": [
    {
      "ideaName": "Short, descriptive name for the idea",
      "description": "What this idea is and how it would work — 2 to 3 sentences",
      "whyRelevant": "Why this idea is specifically relevant to the business problem and context above — 1 to 2 sentences",
      "benefits": ["Benefit 1", "Benefit 2", "Benefit 3"],
      "risks": ["Risk or tradeoff 1", "Risk or tradeoff 2"],
      "applicability": "How well this idea applies to this specific context and any conditions that would make it more or less suitable — 1 to 2 sentences"
    }
  ]
}

Rules:
1. Return 1 or 2 ideas only — choose the most relevant, not the most numerous.
2. Each array in benefits and risks should contain 2 to 4 concise bullet strings (not full paragraphs).
3. All string fields must be complete sentences — do not truncate.
4. The ideas must be genuinely distinct from the proposed solution and from each other.
5. Prioritize ideas that are architecturally credible for BC Government context (cloud-native, open standards, privacy by design, interoperability).`;
}

// ── Parsing & normalization ───────────────────────────────────────────────

function normalizeIdea(raw: unknown): InnovativeIdea | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  if (!e.ideaName || typeof e.ideaName !== "string") return null;

  return {
    ideaName: String(e.ideaName ?? ""),
    description: String(e.description ?? ""),
    whyRelevant: String(e.whyRelevant ?? ""),
    benefits: Array.isArray(e.benefits) ? (e.benefits as unknown[]).map(String) : [],
    risks: Array.isArray(e.risks) ? (e.risks as unknown[]).map(String) : [],
    applicability: String(e.applicability ?? ""),
  };
}

// ── Public API ────────────────────────────────────────────────────────────

export async function runInnovativeSolutions(
  inputs: InnovativeSolutionsInputs
): Promise<InnovativeSolutionsResult> {
  const base = getJurisdictionAIConfig();

  // Use a separate, higher temperature for creative ideation.
  // Override with INNOVATIVE_AI_TEMPERATURE in .env.local (default 0.7).
  const temperature = parseFloat(
    process.env.INNOVATIVE_AI_TEMPERATURE ?? "0.7"
  );
  const config = { ...base, temperature };

  const userPrompt = buildUserPrompt(inputs);

  const response = await callAI(config, {
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
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
    try {
      const repaired = jsonrepair(cleaned);
      parsed = JSON.parse(repaired);
      console.warn("[InnovativeSolutions] JSON was repaired (likely truncated response).");
    } catch {
      throw new Error(
        `AI response was not valid JSON. Preview: ${response.content.slice(0, 300)}`
      );
    }
  }

  const rawIdeas = Array.isArray(parsed.ideas) ? parsed.ideas : [];
  const ideas = rawIdeas
    .map(normalizeIdea)
    .filter((idea): idea is InnovativeIdea => idea !== null)
    .slice(0, 2);

  return {
    ideas,
    generatedAt: new Date().toISOString(),
    aiProvider: response.provider,
    aiModel: response.model,
    inputs,
  };
}
