import os

os.environ.setdefault("ANONYMIZED_TELEMETRY", "False")

import chromadb
import math
import re
from collections import Counter
from chromadb.config import Settings as ChromaSettings
from openai import OpenAI

from app.config import settings


class ChromaStore:
    def __init__(self) -> None:
        self.client = chromadb.PersistentClient(
            path=settings.chroma_persist_dir,
            settings=ChromaSettings(anonymized_telemetry=False),
        )
        self.openai = OpenAI(
            api_key=settings.openai_api_key,
            timeout=settings.openai_request_timeout_seconds,
            max_retries=settings.openai_max_retries,
        )

    def _collection_name(self, company_id: str) -> str:
        safe_id = company_id.replace("-", "_")
        return f"company_{safe_id}"

    def _get_collection(self, company_id: str):
        return self.client.get_or_create_collection(
            name=self._collection_name(company_id),
            metadata={"company_id": company_id},
        )

    def _embed(self, texts: list[str]) -> list[list[float]]:
        """Embed bounded batches so large PDFs never become one huge request."""
        embeddings: list[list[float]] = []
        batch_size = max(1, settings.embedding_batch_size)
        for start in range(0, len(texts), batch_size):
            response = self.openai.embeddings.create(
                model=settings.openai_embedding_model,
                input=texts[start:start + batch_size],
            )
            embeddings.extend(item.embedding for item in response.data)
        return embeddings

    def add_document_chunks(
        self,
        company_id: str,
        document_id: str,
        document_name: str,
        chunks: list,
        document_version: str = "1",
        effective_date: str = "",
        is_active: bool = True,
    ) -> int:
        if not chunks:
            return 0

        collection = self._get_collection(company_id)
        contents = [chunk.content for chunk in chunks]
        embeddings = self._embed(contents)

        ids = [f"{document_id}_chunk_{i}" for i in range(len(chunks))]
        metadatas = [
            {
                "company_id": company_id,
                "document_id": document_id,
                "document_name": document_name,
                "chunk_index": i,
                "page_number": chunk.page_number,
                "document_version": document_version,
                "effective_date": effective_date,
                "is_active": is_active,
            }
            for i, chunk in enumerate(chunks)
        ]

        # Chroma also has a maximum batch size. Keep writes bounded independently
        # from the embeddings API batch size.
        batch_size = max(1, settings.vector_store_batch_size)
        for start in range(0, len(chunks), batch_size):
            end = start + batch_size
            # Reindexing can overlap with an earlier request. Upsert keeps the
            # operation idempotent and refreshes existing chunk IDs safely.
            collection.upsert(
                ids=ids[start:end],
                embeddings=embeddings[start:end],
                documents=contents[start:end],
                metadatas=metadatas[start:end],
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
                    "page_number": meta.get("page_number"),
                    "document_version": meta.get("document_version", "1"),
                    "effective_date": meta.get("effective_date", ""),
                    "is_active": meta.get("is_active", True),
                    "content": doc,
                    "score": round(score, 4),
                }
            )

        return chunks

    @staticmethod
    def _terms(text: str) -> set[str]:
        return {
            term
            for term in re.findall(r"[a-z0-9]+", text.lower())
            if len(term) > 2
        }

    @staticmethod
    def _tokens(text: str) -> list[str]:
        return [
            term
            for term in re.findall(r"[a-z0-9]+", text.lower())
            if len(term) > 2
        ]

    def hybrid_query(
        self,
        company_id: str,
        question: str,
        top_k: int,
    ) -> list[dict]:
        """Combine semantic retrieval with exact-term matching."""
        collection = self._get_collection(company_id)
        count = collection.count()
        if count == 0:
            return []

        semantic = self.query(company_id, question, min(top_k, count))
        all_items = collection.get(include=["documents", "metadatas"])
        documents = all_items["documents"]
        metadatas = all_items["metadatas"]

        tokenized = [self._tokens(doc) for doc in documents]
        query_tokens = self._tokens(question)
        average_length = (
            sum(len(tokens) for tokens in tokenized) / len(tokenized)
            if tokenized else 1.0
        )
        document_frequency = Counter()
        for tokens in tokenized:
            document_frequency.update(set(tokens))

        bm25_results = []
        k1, b = 1.5, 0.75
        for index, tokens in enumerate(tokenized):
            frequencies = Counter(tokens)
            bm25_score = 0.0
            for term in query_tokens:
                frequency = frequencies.get(term, 0)
                if not frequency:
                    continue
                frequency_in_docs = document_frequency[term]
                idf = math.log(
                    1 + (len(tokenized) - frequency_in_docs + 0.5)
                    / (frequency_in_docs + 0.5)
                )
                denominator = frequency + k1 * (
                    1 - b + b * len(tokens) / max(average_length, 1.0)
                )
                bm25_score += idf * frequency * (k1 + 1) / denominator
            if bm25_score:
                bm25_results.append((index, bm25_score))
        bm25_results.sort(key=lambda item: item[1], reverse=True)

        # Reciprocal Rank Fusion is robust because vector and BM25 scores use
        # unrelated scales.
        fused: dict[tuple, dict] = {}
        for rank, item in enumerate(semantic, 1):
            if not item.get("is_active", True):
                continue
            key = (item["document_id"], item["content"])
            item["rank_score"] = 1.0 / (60 + rank)
            fused[key] = item

        for rank, (index, raw_score) in enumerate(bm25_results[:top_k], 1):
            doc, meta = documents[index], metadatas[index]
            if not meta.get("is_active", True):
                continue
            key = (meta.get("document_id", ""), doc)
            item = fused.setdefault(
                key,
                {
                    "document_id": meta.get("document_id", ""),
                    "document_name": meta.get("document_name", ""),
                    "page_number": meta.get("page_number"),
                    "document_version": meta.get("document_version", "1"),
                    "effective_date": meta.get("effective_date", ""),
                    "is_active": meta.get("is_active", True),
                    "content": doc,
                    "score": min(0.7, raw_score / (raw_score + 1.0)),
                    "rank_score": 0.0,
                },
            )
            item["rank_score"] += 1.0 / (60 + rank)

        latest_by_name = {}
        for item in fused.values():
            name = item.get("document_name", "")
            effective = item.get("effective_date", "")
            latest_by_name[name] = max(latest_by_name.get(name, ""), effective)
        for item in fused.values():
            effective = item.get("effective_date", "")
            if effective and effective == latest_by_name.get(
                item.get("document_name", "")
            ):
                item["rank_score"] += 0.005

        return sorted(
            fused.values(),
            key=lambda item: item["rank_score"],
            reverse=True,
        )[:top_k]

    def expand_neighbors(
        self,
        company_id: str,
        chunks: list[dict],
        radius: int,
    ) -> list[dict]:
        """Attach adjacent chunks from the same document as parent context."""
        if radius <= 0:
            return chunks
        collection = self._get_collection(company_id)
        expanded = []
        cache = {}
        for chunk in chunks:
            document_id = chunk["document_id"]
            if document_id not in cache:
                data = collection.get(
                    where={"document_id": document_id},
                    include=["documents", "metadatas"],
                )
                cache[document_id] = {
                    meta.get("chunk_index", index): (doc, meta)
                    for index, (doc, meta) in enumerate(
                        zip(data["documents"], data["metadatas"])
                    )
                }
            document_chunks = cache[document_id]
            matching_index = next(
                (
                    index for index, (doc, _meta) in document_chunks.items()
                    if doc == chunk["content"]
                ),
                None,
            )
            if matching_index is None:
                expanded.append(chunk)
                continue
            neighbors = []
            for index in range(
                matching_index - radius,
                matching_index + radius + 1,
            ):
                if index in document_chunks:
                    doc, meta = document_chunks[index]
                    neighbors.append(
                        f"[Page {meta.get('page_number', '?')}]\n{doc}"
                    )
            enriched = dict(chunk)
            enriched["context_content"] = "\n\n".join(neighbors)
            expanded.append(enriched)
        return expanded

    def company_has_documents(self, company_id: str) -> bool:
        collection = self._get_collection(company_id)
        return collection.count() > 0
