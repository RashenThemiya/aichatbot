# Docker Run Guide

Build and run both services:

```powershell
cd C:\Users\Rashen\Desktop\github\RAG-System
docker compose up --build
```

Services:

```text
Backend:     http://localhost:3000
RAG service: http://localhost:8000
RAG docs:    http://localhost:8000/docs
```

The compose file reads:

```text
backend/.env
rag-service/.env
```

Make sure `backend/.env` has your MongoDB Atlas URI and auth settings.

Make sure `rag-service/.env` has your OpenAI API key.

Useful commands:

```powershell
docker compose up --build
docker compose down
docker compose logs -f backend
docker compose logs -f rag-service
```

Persistent data:

```text
backend_uploads volume -> uploaded PDFs
rag_chroma_data volume -> ChromaDB vectors
```

Important: in Docker, backend talks to the RAG service using:

```env
RAG_SERVICE_URL=http://rag-service:8000
```
