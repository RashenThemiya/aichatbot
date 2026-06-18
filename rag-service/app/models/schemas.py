from pydantic import BaseModel, Field


class IngestRequest(BaseModel):
    company_id: str = Field(..., description="Unique company identifier")
    document_id: str = Field(..., description="Unique document identifier")
    file_path: str = Field(..., description="Absolute path to the PDF file")
    document_name: str = Field(default="", description="Original filename")


class DeleteDocumentRequest(BaseModel):
    company_id: str
    document_id: str


class QueryRequest(BaseModel):
    company_id: str
    question: str
    top_k: int | None = None


class SourceChunk(BaseModel):
    document_id: str
    document_name: str
    content: str
    score: float


class QueryResponse(BaseModel):
    answer: str
    sources: list[SourceChunk]


class IngestResponse(BaseModel):
    success: bool
    chunks_indexed: int
    message: str


class DeleteResponse(BaseModel):
    success: bool
    message: str


class HealthResponse(BaseModel):
    status: str
    service: str
