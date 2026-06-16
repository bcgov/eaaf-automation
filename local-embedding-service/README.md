# Local Embedding Service (Offline)

This service provides offline embeddings using `sentence-transformers` with the model `all-MiniLM-L6-v2`.

## Start the service

```powershell
cd local-embedding-service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

By default, the service runs at:
- `http://127.0.0.1:8001`

## Endpoints

- `GET /health`
- `POST /embed` with JSON body `{ "text": "..." }`
- `POST /embed-batch` with JSON body `{ "texts": ["...", "..."] }`

## Backend configuration

Set in `.env.local`:

```env
LOCAL_EMBEDDING_SERVICE_URL=http://127.0.0.1:8001
LOCAL_EMBEDDING_TIMEOUT_MS=20000
```

Restart Next.js after updating environment variables.
