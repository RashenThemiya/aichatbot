import chromadb
from chromadb.config import Settings as ChromaSettings
from openai import OpenAI

from app.config import settings


class ChromaStore:
    def __init__(self) -> None:
        self.client = chromadb.PersistentClient(
            path=settings.chroma_persist_dir,
            settings=ChromaSettings(anonymized_telemetry=False),
        )
        self.openai = OpenAI(api_key=settings.openai_api_key)

    def _collection_name(self, company_id: str) -> str:
        safe_id = company_id.replace("-", "_")
        return f"company_{safe_id}"

    def _get_collection(self, company_id: str):
        return self.client.get_or_create_collection(
            name=self._collection_name(company_id),
            metadata={"company_id": company_id},
        )

    def _embed(self, texts: list[str]) -> list[list[float]]:
        response = self.openai.embeddings.create(
            model=settings.openai_embedding_model,
            input=texts,
        )
        return [item.embedding for item in response.data]

    def add_document_chunks(
        self,
        company_id: str,
        document_id: str,
        document_name: str,
        chunks: list[str],
    ) -> int:
        if not chunks:
            return 0

        collection = self._get_collection(company_id)
        embeddings = self._embed(chunks)

        ids = [f"{document_id}_chunk_{i}" for i in range(len(chunks))]
        metadatas = [
            {
                "company_id": company_id,
                "document_id": document_id,
                "document_name": document_name,
                "chunk_index": i,
            }
            for i in range(len(chunks))
        ]

        collection.add(
            ids=ids,
            embeddings=embeddings,
            documents=chunks,
            metadatas=metadatas,
        )
        return len(chunks)

    def delete_document(self, company_id: str, document_id: str) -> None:
        collection = self._get_collection(company_id)
        existing = collection.get(where={"document_id": document_id})
        if existing["ids"]:
            collection.delete(ids=existing["ids"])

    def query(
        self,
        company_id: str,
        question: str,
        top_k: int,
    ) -> list[dict]:
        collection = self._get_collection(company_id)
        count = collection.count()
        if count == 0:
            return []

        query_embedding = self._embed([question])[0]
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=min(top_k, count),
            include=["documents", "metadatas", "distances"],
        )

        chunks: list[dict] = []
        if not results["documents"] or not results["documents"][0]:
            return chunks

        for doc, meta, distance in zip(
            results["documents"][0],
            results["metadatas"][0],
            results["distances"][0],
        ):
            score = 1.0 / (1.0 + distance)
            chunks.append(
                {
                    "document_id": meta.get("document_id", ""),
                    "document_name": meta.get("document_name", ""),
                    "content": doc,
                    "score": round(score, 4),
                }
            )

        return chunks

    def company_has_documents(self, company_id: str) -> bool:
        collection = self._get_collection(company_id)
        return collection.count() > 0
