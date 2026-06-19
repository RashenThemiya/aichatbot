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

## Build And Push To Docker Hub

Docker Hub username:

```text
mhartvishwajith448
```

Login:

```powershell
docker login
```

Build images:

```powershell
cd C:\Users\Rashen\Desktop\github\RAG-System

docker build -t mhartvishwajith448/rag-backend:latest ./backend
docker build -t mhartvishwajith448/rag-service:latest ./rag-service
```

Push images:

```powershell
docker push mhartvishwajith448/rag-backend:latest
docker push mhartvishwajith448/rag-service:latest
```

Pull images on a server:

```powershell
docker pull mhartvishwajith448/rag-backend:latest
docker pull mhartvishwajith448/rag-service:latest
```

Run pulled images manually:

```powershell
docker run -d --name rag-service -p 8000:8000 --env-file .\rag-service\.env mhartvishwajith448/rag-service:latest

docker run -d --name rag-backend -p 3000:3000 --env-file .\backend\.env -e RAG_SERVICE_URL=http://host.docker.internal:8000 mhartvishwajith448/rag-backend:latest
```

Do not bake `.env` secrets into the image. Keep MongoDB URI, OpenAI key, and JWT secret in server environment variables or env files.
