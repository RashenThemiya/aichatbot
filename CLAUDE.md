# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Services

Three independently runnable services:

| Service | Stack | Port |
|---------|-------|------|
| `backend/` | Node.js / Express | 3000 |
| `rag-service/` | Python / FastAPI | 8000 |
| `frontend/` | React / Vite | 5173 |

## Development Commands

### RAG service (Python)

```powershell
cd rag-service
venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Backend (Node.js)

```powershell
cd backend
npm install
npm run dev
```

### Frontend admin UI

```powershell
cd frontend
npm install
npm run dev
```

### Embeddable widget build

```powershell
cd frontend
npm run build:widget
# Output: frontend/dist-widget/rag-chat-widget.iife.js
```

### Docker (both backend + RAG service)

```powershell
docker compose up --build
docker compose logs -f backend
docker compose logs -f rag-service
```

In Docker, set `RAG_SERVICE_URL=http://rag-service:8000` in `backend/.env`.

## Environment Setup

Copy and fill each `.env.example`:

**`backend/.env`** — key variables beyond the defaults:
- `JWT_SECRET` — change from the dev default before deploying
- `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` — seeded on first startup if no superadmin exists
- `LIVE_API_SECRET_KEY` — used to encrypt `LiveApiTool.encryptedAuthSecret` (AES); required for live API tools to work
- `LIVE_API_MIN_PLAN_CONFIDENCE` (default `0.55`) — minimum RAG planner confidence to trigger a live tool call

**`rag-service/.env`** — key variables:
- `OPENAI_API_KEY` — required; used for both embeddings and chat completions
- `OPENAI_CHAT_MODEL` (default `gpt-4o-mini`) / `OPENAI_EMBEDDING_MODEL` (default `text-embedding-3-small`)

## Architecture

### Request flow for a chat message

```
POST /widget/companies/:id/chat   (unauthenticated, validated by widget API key)
POST /api/companies/:id/chat      (authenticated admin)
          │
          ▼
    chat.js route
          │── 1. Fetch enabled LiveApiTools for the company
          │── 2. POST /tool-plan to RAG service → decide which live tool to call
          │── 3. If confidence ≥ threshold: execute live HTTP call (liveApiTools.js)
          │── 4. POST /query to RAG service with (question + live result as extra_context)
          │── 5. Save conversation turn to MongoDB
          └── Return { answer, sources, sessionId, liveApi }
```

### Document ingestion flow

```
POST /api/companies/:id/documents  (multipart file)
          │
          ▼
    documents.js route
          │── inferDocType() → "pdf" or "api" based on extension/mime
          │── Save Document record (status: "indexing")
          │── POST /ingest to RAG service → ChromaDB vectors
          │── If docType === "api": syncApiDocTools() → parse + save LiveApiTools
          └── Update Document status to "indexed" or "failed"
```

### Multi-tenancy

- Each company's vectors are isolated in a ChromaDB collection named `company_{id}`.
- PDFs are stored under `backend/uploads/{companyId}/`.
- Admin users have `role: "superadmin"` (all companies) or `role: "company_admin"` (single `companyId`).

### API document tools (feat/upload-api-doc branch)

When a non-PDF file (`.json`, `.yaml`, `.yml`, `.md`, `.txt`) is uploaded:

1. `apiDocTools.js:parseApiDocTools()` parses it as OpenAPI JSON → OpenAPI YAML → Markdown heuristics (in that order).
2. Each parsed endpoint becomes a `LiveApiTool` document in MongoDB with `generatedFromDocument: true` and `sourceDocumentId` pointing back to the document.
3. Deleting or re-indexing the document deletes and regenerates its tools atomically.
4. At query time, `rag_engine.py:plan_tool()` sends a planner prompt to GPT to decide whether any live tool fits the user question, then `liveApiTools.js:executePlannedTool()` makes the HTTP call and the response is injected as `extra_context` into the RAG query.

### Auth secrets for live tools

Auth secrets (`authSecret` field on POST/PUT) are AES-encrypted by `backend/src/services/crypto.js` using `LIVE_API_SECRET_KEY` before storage. The raw secret is never persisted. The API returns `hasAuthSecret: true/false` but never the decrypted value.

### Widget authentication

The widget embed uses a per-company `ragw_...` API key sent as `x-widget-api-key` header. The key is SHA-256-hashed before storage (`widgetApiKeyHash`). The raw key is shown once on generation and never again.

## Key Files

| File | Purpose |
|------|---------|
| `backend/src/index.js` | Express app setup, MongoDB connect, superadmin seed, route mounting |
| `backend/src/routes/chat.js` | Full chat pipeline (tool planning → live call → RAG query → save) |
| `backend/src/routes/documents.js` | Upload, list, delete, reindex documents |
| `backend/src/services/apiDocTools.js` | Parse API doc files into `LiveApiTool` records |
| `backend/src/services/liveApiTools.js` | Execute a planned live API call |
| `backend/src/middleware/auth.js` | JWT auth, superadmin gate, company access control |
| `rag-service/app/services/rag_engine.py` | `ingest()`, `query()`, `plan_tool()` |
| `rag-service/app/services/chroma_store.py` | ChromaDB wrapper (embed + store + retrieve) |
| `rag-service/app/services/pdf_processor.py` | PDF/API-doc text extraction and chunking |
| `frontend/src/widget.js` | Self-contained embeddable chat widget |
