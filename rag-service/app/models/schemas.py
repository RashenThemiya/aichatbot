from pydantic import BaseModel, Field


class IngestRequest(BaseModel):
    company_id: str = Field(..., description="Unique company identifier")
    document_id: str = Field(..., description="Unique document identifier")
    file_path: str = Field(...,
                           description="Absolute path to the uploaded file")
    document_name: str = Field(default="", description="Original filename")
    mime_type: str = Field(default="", description="Detected mime type")
    doc_type: str = Field(
        default="pdf", description="Document type: pdf or api")


class DeleteDocumentRequest(BaseModel):
    company_id: str
    document_id: str


class QueryRequest(BaseModel):
    company_id: str
    question: str
    top_k: int | None = None
    extra_context: str = ""


class SourceChunk(BaseModel):
    document_id: str
    document_name: str
    content: str
    score: float


class QueryResponse(BaseModel):
    answer: str
    sources: list[SourceChunk]


class LiveToolParam(BaseModel):
    name: str
    in_: str = Field(alias="in")
    required: bool = False
    description: str = ""


class LiveToolDefinition(BaseModel):
    id: str
    name: str
    description: str = ""
    method: str
    base_url: str
    path_template: str
    keyword_hints: list[str] = []
    parameters: list[LiveToolParam] = []


class ToolPlanRequest(BaseModel):
    question: str
    tools: list[LiveToolDefinition]


class ToolPlanResponse(BaseModel):
    use_live_tool: bool = False
    tool_id: str = ""
    confidence: float = 0.0
    reason: str = ""
    path_params: dict = {}
    query_params: dict = {}
    body_params: dict = {}
    headers: dict = {}


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
