/**
 * Jurisdiction Scan — AI Provider Configuration
 *
 * All values are read from environment variables so the underlying AI provider
 * can be swapped without touching code.  Add these to your .env.local:
 *
 *   JURISDICTION_AI_PROVIDER    = openai | gemini | anthropic | azure | custom
 *   JURISDICTION_AI_ENDPOINT    = base URL for the provider (see examples below)
 *   JURISDICTION_AI_KEY         = API key / secret
 *   JURISDICTION_AI_MODEL       = model name
 *   JURISDICTION_AI_MAX_TOKENS  = (optional) default 2000
 *   JURISDICTION_AI_TEMPERATURE = (optional) default 0.2
 *   JURISDICTION_REGIONS        = (optional) comma-separated list: canada,us,europe,other — default: canada
 *
 * Provider endpoint examples:
 *   openai:     https://api.openai.com/v1
 *   gemini:     https://generativelanguage.googleapis.com/v1beta
 *   anthropic:  https://api.anthropic.com/v1
 *   azure:      https://{resource}.openai.azure.com/openai/deployments/{deployment}
 *   custom:     any OpenAI-compatible endpoint (e.g. local Ollama, Together AI)
 *
 * To add a new provider: add its name to AIProvider, add a handler in ai-client.ts.
 */

export type AIProvider = "openai" | "gemini" | "anthropic" | "azure" | "custom";
export type JurisdictionRegion = "canada" | "us" | "europe" | "other";

const VALID_REGIONS: JurisdictionRegion[] = ["canada", "us", "europe", "other"];

export interface AIProviderConfig {
  provider: AIProvider;
  endpoint: string;
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  regions: JurisdictionRegion[];
}

export function getJurisdictionAIConfig(): AIProviderConfig {
  return  {
    provider: (process.env.JURISDICTION_AI_PROVIDER ?? "openai") as AIProvider,

    endpoint: process.env.JURISDICTION_AI_ENDPOINT ?? "",

    apiKey: process.env.JURISDICTION_AI_KEY ?? "",

    model: process.env.JURISDICTION_AI_MODEL ?? "",

    maxTokens: parseInt(
      process.env.JURISDICTION_AI_MAX_TOKENS ?? "4000",
      10
    ),

    temperature: parseFloat(
      process.env.JURISDICTION_AI_TEMPERATURE ?? "0.2"
    ),

    regions: (() => {
      const raw = process.env.JURISDICTION_REGIONS ?? "canada";
      const parsed = raw
        .split(",")
        .map((r) => r.trim().toLowerCase())
        .filter((r): r is JurisdictionRegion => VALID_REGIONS.includes(r as JurisdictionRegion));
      return parsed.length > 0 ? parsed : ["canada"];
    })(),
  };
}

/** Returns true only when both the endpoint and key are provided. */
export function isJurisdictionScanConfigured(): boolean {
  return !!process.env.JURISDICTION_AI_KEY;
}