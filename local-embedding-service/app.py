import os
from typing import List

from flask import Flask, jsonify, request
from sentence_transformers import SentenceTransformer

MODEL_NAME = "all-MiniLM-L6-v2"
HOST = os.getenv("LOCAL_EMBEDDING_HOST", "127.0.0.1")
PORT = int(os.getenv("LOCAL_EMBEDDING_PORT", "8001"))

app = Flask(__name__)
model = SentenceTransformer(MODEL_NAME)


@app.get("/health")
def health():
    return jsonify({"status": "ok", "model": MODEL_NAME})


@app.post("/embed")
def embed_single():
    payload = request.get_json(silent=True) or {}
    text = payload.get("text", "")

    if not isinstance(text, str) or not text.strip():
        return jsonify({"error": "Field 'text' must be a non-empty string."}), 400

    vector = model.encode(text, convert_to_numpy=True, normalize_embeddings=True).tolist()
    return jsonify({"embedding": vector, "model": MODEL_NAME, "dimension": len(vector)})


@app.post("/embed-batch")
def embed_batch():
    payload = request.get_json(silent=True) or {}
    texts = payload.get("texts", [])

    if not isinstance(texts, list) or len(texts) == 0:
        return jsonify({"error": "Field 'texts' must be a non-empty array of strings."}), 400

    cleaned: List[str] = [t.strip() for t in texts if isinstance(t, str) and t.strip()]
    if len(cleaned) == 0:
        return jsonify({"error": "No valid non-empty strings in 'texts'."}), 400

    vectors = model.encode(cleaned, convert_to_numpy=True, normalize_embeddings=True).tolist()
    dimension = len(vectors[0]) if vectors else 0

    return jsonify({"embeddings": vectors, "model": MODEL_NAME, "dimension": dimension, "count": len(vectors)})


if __name__ == "__main__":
    app.run(host=HOST, port=PORT)
