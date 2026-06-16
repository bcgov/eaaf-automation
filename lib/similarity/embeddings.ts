const LOCAL_EMBEDDING_SERVICE_URL = process.env.LOCAL_EMBEDDING_SERVICE_URL || "http://127.0.0.1:8001";
const LOCAL_EMBEDDING_TIMEOUT_MS = Number(process.env.LOCAL_EMBEDDING_TIMEOUT_MS || 20000);
const LOCAL_EMBEDDING_MODEL = "all-MiniLM-L6-v2";

function buildUnavailableError(message: string): Error {
  return new Error(`LOCAL_EMBEDDING_SERVICE_UNAVAILABLE: ${message}`);
}

async function postJson(path: string, payload: unknown): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LOCAL_EMBEDDING_TIMEOUT_MS);

  try {
    const res = await fetch(`${LOCAL_EMBEDDING_SERVICE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text();
      throw buildUnavailableError(
        `HTTP ${res.status} from ${LOCAL_EMBEDDING_SERVICE_URL}${path}. Response: ${body.slice(0, 400)}`
      );
    }

    return await res.json();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw buildUnavailableError(
        `Timed out after ${LOCAL_EMBEDDING_TIMEOUT_MS}ms calling ${LOCAL_EMBEDDING_SERVICE_URL}${path}`
      );
    }

    if (error instanceof Error && error.message.includes("LOCAL_EMBEDDING_SERVICE_UNAVAILABLE:")) {
      throw error;
    }

    throw buildUnavailableError(
      `Could not reach local embedding service at ${LOCAL_EMBEDDING_SERVICE_URL}${path}. ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  } finally {
    clearTimeout(timeout);
  }
}

function assertNumberArray(value: unknown, context: string): number[] {
  if (!Array.isArray(value) || value.length === 0 || value.some((v) => typeof v !== "number" || Number.isNaN(v))) {
    throw new Error(`Invalid embedding payload for ${context}`);
  }
  return value as number[];
}

export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    return [];
  }

  try {
    const result = await postJson("/embed", { text, model: LOCAL_EMBEDDING_MODEL });
    return assertNumberArray(result?.embedding, "single text embedding");
  } catch (error) {
    console.error("Error generating embedding from local service:", error);
    throw error;
  }
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (!texts || texts.length === 0) {
    return [];
  }

  const cleaned = texts.map((t) => t?.trim() ?? "").filter((t) => t.length > 0);
  if (cleaned.length === 0) {
    return [];
  }

  try {
    const result = await postJson("/embed-batch", { texts: cleaned, model: LOCAL_EMBEDDING_MODEL });
    if (!Array.isArray(result?.embeddings)) {
      throw new Error("Invalid embedding batch response");
    }

    return result.embeddings.map((e: unknown, idx: number) => assertNumberArray(e, `batch embedding ${idx}`));
  } catch (error) {
    console.error("Error generating embedding batch from local service:", error);
    throw error;
  }
}

export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error("Vectors must have the same length");
  }

  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}