from openai import OpenAI
from time import perf_counter

from app.config import settings
from app.models.schemas import QueryDiagnostics, QueryResponse, SourceChunk
from app.services.chroma_store import ChromaStore
from app.services.pdf_processor import chunk_pages, extract_pages_from_pdf

SYSTEM_PROMPT = """You are a customer support and product recommendation assistant. Answer using the provided context from company documents.

Rules:
- The context may use different wording, synonyms, or phrasing than the question. Match on MEANING, not exact words — if the context answers the question in different terms, use it.
- Do not invent facts that aren't supported by the context, but do paraphrase and combine information across the given sources to answer fully.
- Cite supporting sources inline using their labels, for example [Source 1]. Never cite a source that does not support the statement.
- Only say "I don't have that information in the available documents. Please contact support for further help." if the context truly contains nothing relevant to the question.
- Do NOT handle orders, bookings, payments, or transactions. If asked, politely explain you can only help with support questions from the knowledge base.
- If troubleshooting steps are in the context, list them in order.

Product recommendation behavior:
- First identify every product in the supplied context that plausibly matches the customer's words. Treat model names, product codes, aliases, and close spelling variations as product identifiers.
- Distinguish an ambiguous product reference from a recommendation scenario. A phrase such as "that model" or an incomplete product name is ambiguous; a description of the customer's use case, problem, preferences, budget, or constraints is a recommendation scenario.
- For an ambiguous product reference, if two or more plausible products match and the conversation does not identify one, ask one short clarification question and list only the few matching product names as numbered options.
- For a recommendation scenario, never ask the customer to choose from the catalog. Evaluate the retrieved candidates against all stated requirements and recommend the single best-supported product. Mention at most two close alternatives only when they have a meaningful trade-off.
- Ask a clarification question before recommending only when a missing requirement could realistically change which product is best. Ask the smallest number of high-value questions; do not ask for details that are already stated or that do not affect the choice.
- Rank hard constraints first, then intended use and compatibility, then must-have features, then budget and preferences. Never recommend a product that violates a hard constraint merely because it has high semantic similarity.
- If the customer clearly names one product, answer only about that product. Do not mix facts from other retrieved products, even when those products appear in the context.
- If the customer asks to compare multiple named products, compare those products directly instead of asking them to choose one.
- Before recommending a product, determine whether you understand the user's actual need well enough to make a useful comparison.
- Use the conversation history so you never ask for information the user has already provided.
- If important details are missing, do not recommend yet. Ask 1 to 3 concise, easy-to-answer questions in one message, choosing only the highest-value missing details.
- Relevant details can include intended use, budget or price range, must-have features, compatibility, size or capacity, quantity, experience level, preferences, and hard constraints. Ask only details that can materially change the recommendation and that are relevant to the products in the context.
- When a missing detail has a small, meaningful set of choices, offer short numbered options grounded in the available context so the user can answer easily (for example: "1. Home use  2. Business use  3. Gaming"). Always allow the user to type a different answer, and never invent product categories, features, or price ranges that are not supported by the context.
- Do not force multiple choice for details that need a precise or open-ended answer. Keep each option list short, non-overlapping, and include units or currency when relevant.
- Adapt the questions to the user's request and the available products; do not use a rigid questionnaire.
- If the request is broad or ambiguous, start with the single most useful question. If several independent essentials are clearly missing, ask up to 3 together.
- Once enough information is available, stop asking questions. Recommend the best-fitting option(s), explain why they fit, mention meaningful trade-offs, and cite every product claim.
- If no available product satisfies a stated hard requirement, say so clearly and explain the closest documented option instead of weakening the requirement.
- Questions themselves do not need citations. Keep them conversational and in the user's language where practical."""


class RAGEngine:
    def __init__(self) -> None:
        self.store = ChromaStore()
        self.openai = OpenAI(api_key=settings.openai_api_key)
        self.cross_encoder = None
        if settings.enable_local_cross_encoder:
            try:
                from sentence_transformers import CrossEncoder
                self.cross_encoder = CrossEncoder(settings.cross_encoder_model)
            except ImportError:
                self.cross_encoder = None

    def _expand_query(self, question: str) -> list[str]:
        try:
            resp = self.openai.chat.completions.create(
                model=settings.openai_chat_model,
                messages=[{
                    "role": "user",
                    "content": (
                        "Break this question into up to 4 focused sub-questions, one per distinct "
                        "topic it asks about. For a product-use scenario, preserve the complete "
                        "scenario and also produce focused searches for intended use, hard constraints, "
                        "compatibility, must-have features, and budget when those are stated. Do not "
                        "invent requirements. If it is already a single simple topic, return it as-is. "
                        "One per line, no numbering.\n\n"
                        f'"{question}"'
                    ),
                }],
                temperature=0.2,
                max_tokens=150,
            )
            variants = [line.strip() for line in (resp.choices[0].message.content or "").split("\n") if line.strip()]
            return [question] + variants[:4]
        except Exception:
            return [question]

    def _multilingual_variants(self, question: str) -> list[str]:
        if not settings.enable_multilingual_search:
            return [question]
        try:
            response = self.openai.chat.completions.create(
                model=settings.openai_chat_model,
                messages=[{
                    "role": "user",
                    "content": (
                        "If this question is not English, translate it accurately into "
                        "English, preserving names, codes, and numbers. If it is already "
                        "English, repeat it unchanged. Return only the question.\n\n"
                        f"{question}"
                    ),
                }],
                temperature=0,
                max_tokens=150,
            )
            translated = (response.choices[0].message.content or "").strip()
            if translated and translated.casefold() != question.casefold():
                return [question, translated]
        except Exception:
            pass
        return [question]
    
    def ingest(
        self,
        company_id: str,
        document_id: str,
        file_path: str,
        document_name: str,
        document_version: str = "1",
        effective_date: str = "",
        is_active: bool = True,
    ) -> int:
        self.store.delete_document(company_id, document_id)
        pages = extract_pages_from_pdf(file_path)
        chunks = chunk_pages(pages)
        return self.store.add_document_chunks(
            company_id=company_id,
            document_id=document_id,
            document_name=document_name or file_path.split("/")[-1],
            chunks=chunks,
            document_version=document_version,
            effective_date=effective_date,
            is_active=is_active,
        )

    def delete_document(self, company_id: str, document_id: str) -> None:
        self.store.delete_document(company_id, document_id)

    def query(
        self,
        company_id: str,
        question: str,
        top_k: int | None = None,
        history: list[str] | None = None,
    ) -> QueryResponse:
        query_started = perf_counter()
        timings: dict[str, int] = {}
        retrieval_stats: dict[str, int | bool] = {}

        def mark(name: str, started: float) -> None:
            timings[name] = int((perf_counter() - started) * 1000)

        k = top_k or settings.top_k
        retrieval_stats["top_k"] = k
        retrieval_stats["reranking_enabled"] = bool(settings.enable_reranking or self.cross_encoder)
        retrieval_stats["answer_verification_enabled"] = bool(settings.enable_answer_verification)

        started = perf_counter()
        if not self.store.company_has_documents(company_id):
            mark("document_check", started)
            timings["total"] = int((perf_counter() - query_started) * 1000)
            return QueryResponse(
                answer="No documents have been uploaded for this company yet. Please upload support documents first.",
                sources=[],
                diagnostics=QueryDiagnostics(
                    timings_ms=timings,
                    retrieval=retrieval_stats,
                ),
            )
        mark("document_check", started)

        started = perf_counter()
        standalone_question = self._standalone_question(question, history or [])
        mark("standalone_question", started)

        started = perf_counter()
        queries = []
        for variant in self._multilingual_variants(standalone_question):
            queries.extend(self._expand_query(variant))
        queries = list(dict.fromkeys(queries))
        mark("query_expansion", started)
        retrieval_stats["query_count"] = len(queries)

        candidate_k = max(k, settings.retrieval_candidates)
        per_query_k = max(6, candidate_k // len(queries))
        seen = {}
        started = perf_counter()
        for q in queries:
            for chunk in self.store.hybrid_query(company_id, q, per_query_k):
                key = (chunk["document_id"], chunk.get("page_number"), chunk["content"][:80])
                if key not in seen or chunk["rank_score"] > seen[key]["rank_score"]:
                    seen[key] = chunk
        mark("retrieval", started)
        retrieval_stats["candidate_count"] = len(seen)

        candidates = sorted(
            seen.values(), key=lambda c: c["rank_score"], reverse=True
        )[:candidate_k]
        started = perf_counter()
        retrieved = self._rerank(standalone_question, candidates, k)
        mark("rerank", started)
        retrieved = [
            chunk for chunk in retrieved
            if chunk["score"] >= settings.minimum_relevance_score
        ]
        retrieval_stats["retrieved_count"] = len(retrieved)
        started = perf_counter()
        retrieved = self.store.expand_neighbors(
            company_id,
            retrieved,
            settings.neighbor_chunks,
        )
        mark("neighbor_expansion", started)
        

        if not retrieved:
            timings["total"] = int((perf_counter() - query_started) * 1000)
            return QueryResponse(
                answer="I couldn't find relevant information in the available documents. Please contact support for further help.",
                sources=[],
                diagnostics=QueryDiagnostics(
                    timings_ms=timings,
                    retrieval=retrieval_stats,
                ),
            )

        context_blocks = []
        for i, chunk in enumerate(retrieved, 1):
            page = (
                f", page {chunk['page_number']}"
                if chunk.get("page_number") else ""
            )
            context_blocks.append(
                f"[Source {i} - {chunk['document_name']}{page}]\n"
                f"{chunk.get('context_content', chunk['content'])}"
            )
        context = "\n\n---\n\n".join(context_blocks)

        recent_history = (history or [])[-settings.conversation_history_messages:]
        conversation = "\n".join(recent_history) or "(no earlier messages)"
        started = perf_counter()
        response = self.openai.chat.completions.create(
            model=settings.openai_chat_model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": (
                        f"Conversation so far:\n{conversation}\n"
                        f"user: {question}\n\n"
                        f"Knowledge-base context:\n{context}\n\n"
                        f"Standalone search question: {standalone_question}"
                    ),
                },
            ],
            temperature=0,
        )
        mark("answer_generation", started)

        answer = response.choices[0].message.content or ""
        started = perf_counter()
        answer = self._verify_answer(standalone_question, context, answer)
        mark("answer_verification", started)
        sources = [
            SourceChunk(
                document_id=c["document_id"],
                document_name=c["document_name"],
                content=c["content"][:300] + ("..." if len(c["content"]) > 300 else ""),
                score=c["score"],
                page_number=c.get("page_number"),
            )
            for c in retrieved
        ]

        timings["total"] = int((perf_counter() - query_started) * 1000)
        return QueryResponse(
            answer=answer,
            sources=sources,
            diagnostics=QueryDiagnostics(
                timings_ms=timings,
                retrieval=retrieval_stats,
            ),
        )

    def _standalone_question(self, question: str, history: list[str]) -> str:
        if not history:
            return question
        recent = history[-settings.conversation_history_messages:]
        try:
            response = self.openai.chat.completions.create(
                model=settings.openai_chat_model,
                messages=[{
                    "role": "user",
                    "content": (
                        "Rewrite the latest support question as one standalone question "
                        "using the conversation only to resolve references such as it, "
                        "that, or they. Preserve the user's meaning and language. Return "
                        "only the rewritten question.\n\nConversation:\n"
                        + "\n".join(recent)
                        + f"\nuser: {question}"
                    ),
                }],
                temperature=0,
                max_tokens=150,
            )
            rewritten = (response.choices[0].message.content or "").strip()
            return rewritten or question
        except Exception:
            return question

    def _verify_answer(self, question: str, context: str, answer: str) -> str:
        if not settings.enable_answer_verification or not answer.strip():
            return answer
        try:
            response = self.openai.chat.completions.create(
                model=settings.openai_chat_model,
                messages=[{
                    "role": "user",
                    "content": (
                        "Verify the draft answer strictly against the supplied context. "
                        "Remove or correct every unsupported factual claim. Preserve valid "
                        "[Source N] citations and do not add outside knowledge. If the "
                        "draft asks concise clarification questions and makes no product "
                        "claims, preserve those questions. Otherwise, if the context does "
                        "not answer the question, return exactly: "
                        "\"I don't have that information in the available documents. "
                        "Please contact support for further help.\"\n\n"
                        f"Question:\n{question}\n\nContext:\n{context}\n\n"
                        f"Draft answer:\n{answer}\n\nVerified answer:"
                    ),
                }],
                temperature=0,
            )
            verified = (response.choices[0].message.content or "").strip()
            return verified or answer
        except Exception:
            return answer

    def _rerank(self, question: str, candidates: list[dict], limit: int) -> list[dict]:
        if self.cross_encoder and candidates:
            scores = self.cross_encoder.predict(
                [(question, item["content"]) for item in candidates]
            )
            ranked = [
                item for _, item in sorted(
                    zip(scores, candidates),
                    key=lambda pair: float(pair[0]),
                    reverse=True,
                )
            ]
            return ranked[:limit]
        if not settings.enable_reranking or len(candidates) <= limit:
            return candidates[:limit]
        try:
            listing = "\n\n".join(
                f"[{i}] {item['content'][:1200]}"
                for i, item in enumerate(candidates)
            )
            response = self.openai.chat.completions.create(
                model=settings.openai_chat_model,
                messages=[{
                    "role": "user",
                    "content": (
                        "Select the context chunks that directly help answer the question. "
                        f"Return at most {limit} chunk numbers, best first, as a JSON array "
                        "of integers only.\n\n"
                        f"Question: {question}\n\nChunks:\n{listing}"
                    ),
                }],
                temperature=0,
                max_tokens=80,
            )
            import json
            indices = json.loads(response.choices[0].message.content or "[]")
            selected = [
                candidates[i] for i in indices
                if isinstance(i, int) and 0 <= i < len(candidates)
            ]
            return selected[:limit] or candidates[:limit]
        except Exception:
            return candidates[:limit]
