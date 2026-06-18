from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.models.schemas import (
    DeleteDocumentRequest,
    DeleteResponse,
    HealthResponse,
    IngestRequest,
    IngestResponse,
    QueryRequest,
    QueryResponse,
)
from app.services.rag_engine import RAGEngine

app = FastAPI(
    title="RAG Service",
    description="Multi-tenant PDF knowledge retrieval and Q&A",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = RAGEngine()


@app.get("/health", response_model=HealthResponse)
def health():
    return HealthResponse(status="ok", service="rag-service")


@app.post("/ingest", response_model=IngestResponse)
def ingest_document(request: IngestRequest):
    if not settings.openai_api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY is not configured")

    try:
        chunks = engine.ingest(
            company_id=request.company_id,
            document_id=request.document_id,
            file_path=request.file_path,
            document_name=request.document_name,
        )
        return IngestResponse(
            success=True,
            chunks_indexed=chunks,
            message=f"Indexed {chunks} chunks for document {request.document_id}",
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")


@app.delete("/documents", response_model=DeleteResponse)
def delete_document(request: DeleteDocumentRequest):
    try:
        engine.delete_document(request.company_id, request.document_id)
        return DeleteResponse(
            success=True,
            message=f"Deleted vectors for document {request.document_id}",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")


@app.post("/query", response_model=QueryResponse)
def query_knowledge(request: QueryRequest):
    if not settings.openai_api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY is not configured")

    try:
        return engine.query(
            company_id=request.company_id,
            question=request.question,
            top_k=request.top_k,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {str(e)}")
