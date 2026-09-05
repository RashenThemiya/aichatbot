import os

os.environ.setdefault("ANONYMIZED_TELEMETRY", "False")

import chromadb
import math
import re
from collections import Counter
from chromadb.config import Settings as ChromaSettings
from openai import OpenAI

from app.config import settings
from app.services.model_ids import (
    extract_model_ids,
    item_model_ids,
    matches_model_ids,
    serialize_model_ids,
)
from app.services.product_names import (
    extract_product_names,
    item_product_names,
    matches_product_names,
    serialize_product_names,
)


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
        raw_contents = [chunk.content for chunk in chunks]
        name_model_ids = extract_model_ids(document_name)
        document_product_names = extract_product_names(
            f"{document_name}\n{' '.join(raw_contents)}"
        )
        embedding_contents = []
        for chunk in chunks:
            local_model_ids = name_model_ids or extract_model_ids(
                f"{getattr(chunk, 'section_heading', '')}\n{chunk.content}"
            )
            local_product_names = extract_product_names(chunk.content)
            if len(document_product_names) == 1:
                local_product_names = document_product_names
            labels = [f"Document: {document_name}"]
            if local_model_ids:
                labels.append(f"Product model: {', '.join(sorted(local_model_ids))}")
            if local_product_names:
                labels.append(f"Product family: {', '.join(sorted(local_product_names))}")
            section_heading = getattr(chunk, "section_heading", "")
            if section_heading:
                labels.append(f"Section: {section_heading}")
            embedding_contents.append("\n".join(labels) + f"\n\n{chunk.content}")
        # Enrich only the embedding input. The text supplied to the answer model
        # remains the PDF's original display text, so normalized IDs never leak
        # into customer-facing model lists.
        embeddings = self._embed(embedding_contents)

        ids = [f"{document_id}_chunk_{i}" for i in range(len(chunks))]
        existing = collection.get(
            where={"document_id": document_id},
            include=[],
        )
        stale_ids = sorted(set(existing.get("ids", [])) - set(ids))
        metadatas = [
            {
                "company_id": company_id,
                "document_id": document_id,
                "document_name": document_name,
                "chunk_index": i,
                "page_number": chunk.page_number,
                "section_heading": getattr(chunk, "section_heading", ""),
                "document_version": document_version,
                "effective_date": effective_date,
                "is_active": is_active,
                "model_ids": serialize_model_ids(
                    name_model_ids
                    or extract_model_ids(
                        f"{getattr(chunk, 'section_heading', '')}\n{chunk.content}"
                    )
                ),
                "product_names": serialize_product_names(
                    document_product_names
                    if len(document_product_names) == 1
                    else extract_product_names(chunk.content)
                ),
                "evidence_type": getattr(chunk, "evidence_type", "text"),
                "evidence_confidence": float(
                    getattr(chunk, "evidence_confidence", 1.0)
                ),
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
                documents=raw_contents[start:end],
                metadatas=metadatas[start:end],
            )
        if stale_ids:
            collection.delete(ids=stale_ids)
        return len(chunks)

    @staticmethod
    def _display_content(document: str) -> str:
        """Remove legacy embedding-only labels from stored answer context."""
        value = str(document or "")
        header, separator, body = value.partition("\n\n")
        lines = [line.strip() for line in header.splitlines() if line.strip()]
        allowed_labels = ("Document:", "Product model:", "Product family:", "Section:")
        if (
            separator
            and lines
            and lines[0].startswith("Document:")
            and all(line.startswith(allowed_labels) for line in lines)
        ):
            return body.strip()
        return value

    def delete_document(self, company_id: str, document_id: str) -> None:
        collection = self._get_collection(company_id)
        existing = collection.get(where={"document_id": document_id})
        if existing["ids"]:
            collection.delete(ids=existing["ids"])

    def set_document_active(
        self,
        company_id: str,
        document_id: str,
        is_active: bool,
    ) -> None:
        collection = self._get_collection(company_id)
        existing = collection.get(
            where={"document_id": document_id},
            include=["metadatas"],
        )
        if not existing["ids"]:
            return
        metadatas = [
            {**metadata, "is_active": is_active}
            for metadata in existing["metadatas"]
        ]
        collection.update(ids=existing["ids"], metadatas=metadatas)

    def query(
        self,
        company_id: str,
        question: str,
        top_k: int,
        required_model_ids: set[str] | None = None,
        required_product_names: set[str] | None = None,
        allowed_document_ids: set[str] | None = None,
    ) -> list[dict]:
        collection = self._get_collection(company_id)
        count = collection.count()
        if count == 0:
            return []

        required = required_model_ids or set()
        required_products = required_product_names or set()
        allowed_documents = allowed_document_ids or set()
        where = {"is_active": True}
        eligible_count = count
        if required or required_products or allowed_documents:
            all_items = collection.get(include=["documents", "metadatas"])
            pairs = [
                (doc, meta)
                for doc, meta in zip(
                    all_items.get("documents", []),
                    all_items.get("metadatas", []),
                )
                if meta.get("document_id") and meta.get("is_active", True)
            ]
            eligible_document_ids = {
                meta.get("document_id", "") for _doc, meta in pairs
            }
            if allowed_documents:
                eligible_document_ids &= allowed_documents
            if required_products:
                eligible_document_ids &= {
                    meta.get("document_id", "")
                    for doc, meta in pairs
                    if matches_product_names(doc, meta, required_products)
                }
            if required:
                eligible_document_ids &= {
                    meta.get("document_id", "")
                    for doc, meta in pairs
                    if matches_model_ids(doc, meta, required)
                }
            eligible_document_ids = sorted(eligible_document_ids)
            if not eligible_document_ids:
                return []
            eligible_count = sum(
                1
                for doc, meta in pairs
                if meta.get("document_id", "") in eligible_document_ids
                and matches_model_ids(doc, meta, required)
            )
            document_filter = (
                {"document_id": eligible_document_ids[0]}
                if len(eligible_document_ids) == 1
                else {"document_id": {"$in": eligible_document_ids}}
            )
            where = {"$and": [{"is_active": True}, document_filter]}

        query_embedding = self._embed([question])[0]
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=min(top_k * 4 if required else top_k, eligible_count),
            where=where,
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
            if not matches_model_ids(doc, meta, required):
                continue
            score = 1.0 / (1.0 + distance)
            chunks.append(
                {
                    "document_id": meta.get("document_id", ""),
                    "document_name": meta.get("document_name", ""),
                    "page_number": meta.get("page_number"),
                    "section_heading": meta.get("section_heading", ""),
                    "document_version": meta.get("document_version", "1"),
                    "effective_date": meta.get("effective_date", ""),
                    "is_active": meta.get("is_active", True),
                    "model_ids": sorted(item_model_ids(doc, meta)),
                    "product_names": sorted(item_product_names(doc, meta)),
                    "evidence_type": meta.get("evidence_type", "text"),
                    "evidence_confidence": float(meta.get("evidence_confidence", 1.0)),
                    "content": self._display_content(doc),
                    "score": round(score, 4),
                }
            )

        return chunks[:top_k]

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
        required_model_ids: set[str] | None = None,
        required_product_names: set[str] | None = None,
        allowed_document_ids: set[str] | None = None,
    ) -> list[dict]:
        """Combine semantic retrieval with exact-term matching."""
        collection = self._get_collection(company_id)
        count = collection.count()
        if count == 0:
            return []

        required = required_model_ids or set()
        required_products = required_product_names or set()
        allowed_documents = allowed_document_ids or set()
        semantic = self.query(
            company_id,
            question,
            min(top_k, count),
            required_model_ids=required,
            required_product_names=required_products,
            allowed_document_ids=allowed_documents,
        )
        all_items = collection.get(include=["documents", "metadatas"])
        product_document_ids = {
            meta.get("document_id", "")
            for doc, meta in zip(all_items["documents"], all_items["metadatas"])
            if meta.get("is_active", True)
            and matches_product_names(doc, meta, required_products)
        }
        eligible = [
            (doc, meta)
            for doc, meta in zip(all_items["documents"], all_items["metadatas"])
            if meta.get("is_active", True)
            and matches_model_ids(doc, meta, required)
            and (not allowed_documents or meta.get("document_id", "") in allowed_documents)
            and (not required_products or meta.get("document_id", "") in product_document_ids)
        ]
        if not eligible:
            return []
        raw_documents = [doc for doc, _meta in eligible]
        documents = [self._display_content(doc) for doc in raw_documents]
        metadatas = [meta for _doc, meta in eligible]

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
                    "section_heading": meta.get("section_heading", ""),
                    "document_version": meta.get("document_version", "1"),
                    "effective_date": meta.get("effective_date", ""),
                    "is_active": meta.get("is_active", True),
                    "model_ids": sorted(item_model_ids(raw_documents[index], meta)),
                    "product_names": sorted(item_product_names(raw_documents[index], meta)),
                    "evidence_type": meta.get("evidence_type", "text"),
                    "evidence_confidence": float(meta.get("evidence_confidence", 1.0)),
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
            item["rank_score"] *= max(
                0.0,
                min(1.0, float(item.get("evidence_confidence", 1.0))),
            )

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
        required_model_ids: set[str] | None = None,
        allowed_document_ids: set[str] | None = None,
    ) -> list[dict]:
        """Attach adjacent chunks from the same document as parent context."""
        if radius <= 0:
            return chunks
        collection = self._get_collection(company_id)
        expanded = []
        cache = {}
        for chunk in chunks:
            document_id = chunk["document_id"]
            if allowed_document_ids and document_id not in allowed_document_ids:
                continue
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
                    if self._display_content(doc) == chunk["content"]
                ),
                None,
            )
            if matching_index is None:
                expanded.append(chunk)
                continue
            neighbors = []
            root_evidence_type = chunk.get("evidence_type", "text")
            for index in range(
                matching_index - radius,
                matching_index + radius + 1,
            ):
                if index in document_chunks:
                    doc, meta = document_chunks[index]
                    if not matches_model_ids(
                        doc,
                        meta,
                        required_model_ids or set(),
                    ):
                        continue
                    if (
                        root_evidence_type != "vision"
                        and meta.get("evidence_type", "text") == "vision"
                    ):
                        continue
                    neighbors.append(
                        f"[Page {meta.get('page_number', '?')}]\n"
                        f"{self._display_content(doc)}"
                    )
            enriched = dict(chunk)
            enriched["context_content"] = "\n\n".join(neighbors)
            expanded.append(enriched)
        return expanded

    def company_has_documents(self, company_id: str) -> bool:
        collection = self._get_collection(company_id)
        return collection.count() > 0
