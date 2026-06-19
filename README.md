# Multi-Tenant RAG Chatbot

A multi-company RAG (Retrieval-Augmented Generation) system for customer support. Each company uploads PDF knowledge-base documents; end users ask questions and get answers grounded in that company's docs only.

## Architecture

```
┌─────────────┐     REST API      ┌──────────────┐     HTTP      ┌─────────────────┐
│   Client    │ ───────────────►  │ Node.js API  │ ────────────► │ Python RAG Svc  │
│ (web/admin) │                   │  (Express)   │               │   (FastAPI)     │
└─────────────┘                   └──────┬───────┘               └────────┬────────┘
                                         │                                │
                                    MongoDB                          ChromaDB
                                  (metadata,                         (vectors per
                                   chat history)                      company)
```

| Component | Role |
|-----------|------|
| **backend/** | Companies CRUD, PDF upload, chat proxy, conversation storage |
| **rag-service/** | PDF parsing, chunking, embeddings, vector search, LLM answers |

## Prerequisites

- **Node.js** 18+
- **Python** 3.11+
- **MongoDB** running locally (or Atlas URI)
- **OpenAI API key** (embeddings + chat)

## Setup

### 1. Python RAG service

```bash
cd rag-service
python -m venv venv

# Windows
venv\Scripts\activate

pip install -r requirements.txt
copy .env.example .env
# Edit .env and set OPENAI_API_KEY
```

Start the RAG service:

```bash
uvicorn app.main:app --reload --port 8000
```

> **Windows note:** If ChromaDB fails to import, ensure `onnxruntime==1.19.2` is installed (included in `requirements.txt`).

### 2. Node.js backend

```bash
cd backend
npm install
copy .env.example .env
# Edit .env if MongoDB or RAG URL differs
```

Start the backend:

```bash
npm run dev
```

Backend: `http://localhost:3000`  
RAG service: `http://localhost:8000`  
RAG API docs: `http://localhost:8000/docs`

## Docker

Run both backend and RAG service with Docker Compose:

```powershell
cd C:\Users\Rashen\Desktop\github\RAG-System
docker compose up --build
```

Build and push Docker Hub images:

```powershell
docker login

docker build -t mhartvishwajith448/rag-backend:latest ./backend
docker build -t mhartvishwajith448/rag-service:latest ./rag-service

docker push mhartvishwajith448/rag-backend:latest
docker push mhartvishwajith448/rag-service:latest
```

More Docker details are in `DOCKER.md`.

## API Usage

### Health check

```bash
curl http://localhost:3000/health
```

### Create a company

```bash
curl -X POST http://localhost:3000/api/companies \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"Acme Support\", \"description\": \"Acme customer help\"}"
```

Save the returned `_id` as `COMPANY_ID`.

### Upload a PDF

```bash
curl -X POST http://localhost:3000/api/companies/COMPANY_ID/documents \
  -F "file=@path/to/your-faq.pdf"
```

### List documents

```bash
curl http://localhost:3000/api/companies/COMPANY_ID/documents
```

### Chat (ask a question)

```bash
curl -X POST http://localhost:3000/api/companies/COMPANY_ID/chat \
  -H "Content-Type: application/json" \
  -d "{\"message\": \"How do I reset my password?\"}"
```

Response includes `answer`, `sources`, and `sessionId` for follow-up messages:

```bash
curl -X POST http://localhost:3000/api/companies/COMPANY_ID/chat \
  -H "Content-Type: application/json" \
  -d "{\"message\": \"What are your support hours?\", \"sessionId\": \"SESSION_ID_FROM_PREVIOUS\"}"
```

### Delete a document

```bash
curl -X DELETE http://localhost:3000/api/companies/COMPANY_ID/documents/DOCUMENT_ID
```

### View chat history (admin)

```bash
curl http://localhost:3000/api/companies/COMPANY_ID/chat/conversations
curl http://localhost:3000/api/companies/COMPANY_ID/chat/history/SESSION_ID
```

## API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Backend + RAG health |
| POST | `/api/companies` | Create company |
| GET | `/api/companies` | List companies |
| GET/PUT/DELETE | `/api/companies/:id` | Get, update, delete company |
| POST | `/api/companies/:id/documents` | Upload PDF (multipart `file`) |
| GET | `/api/companies/:id/documents` | List documents |
| DELETE | `/api/companies/:id/documents/:docId` | Delete PDF + vectors |
| POST | `/api/companies/:id/documents/:docId/reindex` | Re-index PDF |
| POST | `/api/companies/:id/chat` | Ask question |
| GET | `/api/companies/:id/chat/conversations` | List sessions |
| GET | `/api/companies/:id/chat/history/:sessionId` | Full conversation |

## Python RAG service (direct)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health |
| POST | `/ingest` | Index a PDF |
| DELETE | `/documents` | Remove document vectors |
| POST | `/query` | RAG Q&A |

## Multi-tenancy

- Each company gets an isolated ChromaDB collection (`company_{id}`).
- Queries always filter by `company_id` — Company A never sees Company B's data.
- PDFs are stored under `backend/uploads/{companyId}/`.

## Environment variables

**rag-service/.env**

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | — | Required |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` | Embeddings model |
| `OPENAI_CHAT_MODEL` | `gpt-4o-mini` | Chat model |
| `CHROMA_PERSIST_DIR` | `./chroma_data` | Vector DB path |
| `CHUNK_SIZE` | `1000` | Characters per chunk |
| `CHUNK_OVERLAP` | `200` | Overlap between chunks |
| `TOP_K` | `5` | Retrieved chunks per query |

**backend/.env**

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | API port |
| `MONGODB_URI` | `mongodb://localhost:27017/rag_chatbot` | MongoDB connection |
| `RAG_SERVICE_URL` | `http://localhost:8000` | Python service URL |
| `UPLOAD_DIR` | `./uploads` | PDF storage |

## Next steps (future phases)

- React admin UI + embeddable chat widget
- SMS (Twilio) and voice call integration
- Authentication / API keys per company
- AWS S3 for file storage
"# aichatbot" 
