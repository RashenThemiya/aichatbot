from openai import OpenAI

from app.config import settings
from app.models.schemas import QueryResponse, SourceChunk
from app.services.chroma_store import ChromaStore
from app.services.pdf_processor import chunk_text, extract_text_from_pdf

SYSTEM_PROMPT = """You are a customer support assistant. Your job is to answer support and FAQ questions ONLY using the provided context from company documents.

Rules:
- Answer ONLY based on the context below. Do not invent information.
- If the context does not contain enough information to answer, say: "I don't have that information in the available documents. Please contact support for further help."
- Do NOT handle orders, bookings, payments, or transactions. If asked, politely explain you can only help with support questions from the knowledge base.
- Be clear, helpful, and concise.
- If troubleshooting steps are in the context, list them in order."""


class RAGEngine:
    def __init__(self) -> None:
        self.store = ChromaStore()
        self.openai = OpenAI(api_key=settings.openai_api_key)

    def ingest(
        self,
        company_id: str,
        document_id: str,
        file_path: str,
        document_name: str,
    ) -> int:
        self.store.delete_document(company_id, document_id)
        text = extract_text_from_pdf(file_path)
        chunks = chunk_text(text)
        return self.store.add_document_chunks(
            company_id=company_id,
            document_id=document_id,
            document_name=document_name or file_path.split("/")[-1],
            chunks=chunks,
        )

    def delete_document(self, company_id: str, document_id: str) -> None:
        self.store.delete_document(company_id, document_id)

    def query(
        self,
        company_id: str,
        question: str,
        top_k: int | None = None,
    ) -> QueryResponse:
        k = top_k or settings.top_k

        if not self.store.company_has_documents(company_id):
            return QueryResponse(
                answer="No documents have been uploaded for this company yet. Please upload support documents first.",
                sources=[],
            )

        retrieved = self.store.query(company_id, question, k)

        if not retrieved:
            return QueryResponse(
                answer="I couldn't find relevant information in the available documents. Please contact support for further help.",
                sources=[],
            )

        context_blocks = []
        for i, chunk in enumerate(retrieved, 1):
            context_blocks.append(
                f"[Source {i} - {chunk['document_name']}]\n{chunk['content']}"
            )
        context = "\n\n---\n\n".join(context_blocks)

        response = self.openai.chat.completions.create(
            model=settings.openai_chat_model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": f"Context:\n{context}\n\nQuestion: {question}",
                },
            ],
            temperature=0.2,
        )

        answer = response.choices[0].message.content or ""
        sources = [
            SourceChunk(
                document_id=c["document_id"],
                document_name=c["document_name"],
                content=c["content"][:300] + ("..." if len(c["content"]) > 300 else ""),
                score=c["score"],
            )
            for c in retrieved
        ]

        return QueryResponse(answer=answer, sources=sources)
