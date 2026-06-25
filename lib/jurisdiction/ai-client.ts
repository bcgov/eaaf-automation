/**
 * Jurisdiction Scan — AI-Agnostic Client
 *
 * Routes requests to the correct provider format based on config.
 * To add a new provider: add a case in callAI() and implement its handler below.
 *
 * Supported providers:
 *   openai     — OpenAI Chat Completions API
 *   gemini     — Google Gemini generateContent API
 *   anthropic  — Anthropic Messages API
 *   azure      — Azure OpenAI (same format as openai, different auth header)
 *   custom     — Any OpenAI-compatible endpoint
 */

import { AIProviderConfig } from "./config";

export interface AICallRequest {
  systemPrompt: string;
  userPrompt: string;
}

export interface AICallResponse {
  content: string;
  provider: string;
  model: string;
}

/** Entry point — dispatches to the correct provider handler. */
export async function callAI(
  config: AIProviderConfig,
  request: AICallRequest
): Promise<AICallResponse> {
  switch (config.provider) {
    case "gemini":
      return callGemini(config, request);
    case "anthropic":
      return callAnthropic(config, request);
    case "openai":
    case "azure":
    case "custom":
    default:
      return callOpenAICompatible(config, request);
  }
}

// ── OpenAI / Azure OpenAI / OpenAI-compatible ─────────────────────────────

async function callOpenAICompatible(
  config: AIProviderConfig,
  request: AICallRequest
): Promise<AICallResponse> {
  const url = `${config.endpoint.replace(/\/$/, "")}/chat/completions`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.apiKey}`,
  };

  // Azure uses api-key header instead of Authorization: Bearer
  if (config.provider === "azure") {
    delete headers["Authorization"];
    headers["api-key"] = config.apiKey;
  }

  const body = {
    model: config.model,
    messages: [
      { role: "system", content: request.systemPrompt },
      { role: "user", content: request.userPrompt },
    ],
    max_tokens: config.maxTokens,
    temperature: config.temperature,
    response_format: { type: "json_object" },
  };

  console.log(`[AI-Client] POST ${url}`);
  console.log("[AI-Client] Request body:", JSON.stringify({ ...body, messages: body.messages.map((m) => ({ ...m, content: m.content.slice(0, 100) + "..." })) }));

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`[AI-Client] Error response (${res.status}):`, err);
    throw new Error(`AI call failed (${config.provider} ${res.status}): ${err}`);
  }

  const data = await res.json();
  const content: string = data.choices?.[0]?.message?.content ?? "";
  return { content, provider: config.provider, model: config.model };
}

// ── Google Gemini ─────────────────────────────────────────────────────────

async function callGemini(
  config: AIProviderConfig,
  request: AICallRequest
): Promise<AICallResponse> {
  // Gemini endpoint format: {base}/models/{model}:generateContent?key={apiKey}
  const url = `${config.endpoint.replace(/\/$/, "")}/models/${config.model}:generateContent?key=${config.apiKey}`;

  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: `${request.systemPrompt}\n\n${request.userPrompt}` }],
      },
    ],
    generationConfig: {
      temperature: config.temperature,
      maxOutputTokens: config.maxTokens,
      responseMimeType: "application/json",
    },
  };

  console.log(`[AI-Client/Gemini] POST ${url.replace(/key=[^&]+/, "key=REDACTED")}`);
  console.log("[AI-Client/Gemini] generationConfig:", body.generationConfig);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  console.log(`[AI-Client/Gemini] Response status: ${res.status}`);

  if (!res.ok) {
    const err = await res.text();
    console.error("[AI-Client/Gemini] Error body:", err);
    throw new Error(`Gemini call failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  console.log("[AI-Client/Gemini] Response candidates:", JSON.stringify(data).slice(0, 300));
  const content: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return { content, provider: "gemini", model: config.model };
}

// ── Anthropic Claude ──────────────────────────────────────────────────────

async function callAnthropic(
  config: AIProviderConfig,
  request: AICallRequest
): Promise<AICallResponse> {
  const url = `${config.endpoint.replace(/\/$/, "")}/messages`;

  const body = {
    model: config.model,
    max_tokens: config.maxTokens,
    temperature: config.temperature,
    system: request.systemPrompt,
    messages: [{ role: "user", content: request.userPrompt }],
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic call failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  const content: string = data.content?.[0]?.text ?? "";
  return { content, provider: "anthropic", model: config.model };
}
