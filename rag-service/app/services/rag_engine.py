import json
import re
from difflib import SequenceMatcher

from openai import OpenAI
from time import perf_counter

from app.config import settings
from app.models.schemas import (
    ClarificationSuggestion,
    QueryDiagnostics,
    QueryResponse,
    SourceChunk,
)
from app.services.chroma_store import ChromaStore
from app.services.pdf_processor import chunk_pages, extract_pages_from_pdf

SYSTEM_PROMPT = """You are a customer support and product recommendation assistant. Answer using the provided context from company documents.

Rules:
- The context may use different wording, synonyms, or phrasing than the question. Match on MEANING, not exact words — if the context answers the question in different terms, use it.
- Do not invent facts that aren't supported by the context, but do paraphrase and combine information across the given sources to answer fully.
- Cite supporting sources inline using their labels, for example [Source 1]. Never cite a source that does not support the statement.
- A product or service claim must be supported by a context block about that same named product or service. Never use one product's document as support for a different product.
- Return only a customer-facing answer. Never mention the draft, supplied context, verification, unsupported claims, or text that should be removed.
- When the context does not support an answer, ask one concise clarification question. Do not claim that the customer must contact support.
- Do NOT handle orders, bookings, payments, or transactions. If asked, politely explain you can only help with support questions from the knowledge base.
- If troubleshooting steps are in the context, list them in order.
- Adapt the response to the request type: answer factual questions directly, compare named products side by side, recommend from stated needs and constraints, and provide ordered diagnosis for troubleshooting.
- For scenario questions, explicitly connect each recommendation or instruction to the customer's stated conditions.

Conversation style:
- Write like a friendly, knowledgeable human support assistant. Keep the tone warm, calm, and professional.
- Use natural wording and contractions such as "I'll", "you're", and "that's" where they fit.
- Give the direct answer first, then add only the details that help the customer act on it.
- When the customer describes a problem, briefly acknowledge it before giving the solution, but do not over-apologize.
- Prefer simple words, short paragraphs, and clear sentences. Use bullets or numbered steps only when they improve readability.
- Never use internal or robotic phrases such as "the supplied context states", "the context indicates", or "based on the retrieved chunks".
- Do not repeat a greeting, apology, or closing in every answer. Avoid filler, excessive enthusiasm, and unnecessary emojis.
- Ask one natural follow-up question only when more information would materially improve the answer.
- Match the customer's language where practical. Never sacrifice accuracy or invent details just to sound conversational.
- Treat every reply as the next turn in a real conversation: respond to what the person actually said instead of restating their question.
- Avoid formal headings such as "Answer", "Response", or "Conclusion" for simple replies, and never refer to the person as "the customer".
- Vary transitions and sentence openings naturally so replies do not feel copied from a fixed template.

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
- Never ask substantially the same clarification twice. After two clarification rounds, stop asking questions and provide the best-supported recommendation possible, clearly stating any assumptions or missing constraints.
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

    def _analyze_request(
        self,
        question: str,
        history: list[str],
        catalog_context: str = "",
        avoid_question: str = "",
    ) -> dict:
        """Understand intent and decide whether one grounded clarification is necessary."""
        recent = history[-settings.conversation_history_messages:]
        conversation = "\n".join(recent) or "(no earlier messages)"
        customer_messages = [
            re.sub(r"^user:\s*", "", item, flags=re.I)
            for item in recent
            if item.strip().lower().startswith("user:")
        ]
        customer_messages.append(question)
        customer_evidence = "\n".join(customer_messages)
        try:
            response = self.openai.chat.completions.create(
                model=settings.openai_chat_model,
                messages=[{
                    "role": "user",
                    "content": (
                        "Analyze this customer-support request using the conversation. Return one "
                        "JSON object with exactly these fields: intent, scenario_summary, "
                        "known_requirements, missing_requirements, sufficient, clarification_question, "
                        "clarification_options, no_more_information. Intent "
                        "must be one of factual, recommendation, "
                        "comparison, troubleshooting, or unclear. scenario_summary must combine all "
                        "known product names, use case, symptoms, conditions, numbers, compatibility "
                        "requirements, preferences, and hard constraints without inventing anything. "
                        "known_requirements must be an array of objects with requirement, value, and "
                        "evidence. evidence must be a short verbatim quote from a USER message. Never "
                        "treat an assistant statement, catalog description, suggested option, or model "
                        "assumption as a customer requirement. missing_requirements must be an array of "
                        "short requirement names that would materially distinguish the available choices. "
                        "For a clear factual question or comparison of named products, sufficient is "
                        "true. A request like 'which one should I select' is a recommendation and is not "
                        "sufficient unless the user has explicitly stated an outcome/use case or other "
                        "decision criteria. For recommendations and troubleshooting, set sufficient false "
                        "when a missing detail could materially change the answer or make guidance unsafe. "
                        "Never ask again for information already present in the conversation. If "
                        "at least one customer requirement is known, the next question must target "
                        "one concrete differentiator found in the catalog, such as a documented "
                        "dimension, capacity, compatibility condition, environment, or service scope. "
                        "Do not ask vague catch-all questions about preferences, requirements, or "
                        "whether there is anything else. If "
                        "sufficient is false, clarification_question must ask only the smallest useful "
                        "question, in the customer's language, and may contain at most 3 short questions. "
                        "Otherwise clarification_question must be an empty string. "
                        "clarification_options must be an array of up to 3 short objects containing "
                        "label and message. Each message must be a first-person customer answer to the "
                        "clarification question, never another question or an instruction. For example, "
                        "use label 'Personal use' with message 'I need it for personal use.' "
                        "Labels must be concrete answers to the question, not names of information fields. "
                        "Include options only when they are plausible interpretations "
                        "of the customer's own wording or concrete choices supported by the catalog; "
                        "never invent products, specifications, categories, or facts. Preserve names, "
                        "codes, quantities, and constraints exactly. Set no_more_information true only "
                        "when the latest customer "
                        "message explicitly says none of the choices match and provides no new useful "
                        "detail. Otherwise it must be false. Do not answer the customer and do not "
                        "include markdown. Use the catalog excerpts only to make clarification questions "
                        "and choices relevant to this company's actual offerings.\n\n"
                        f"Conversation:\n{conversation}\n"
                        f"Latest customer message:\n{question}\n\n"
                        f"Available catalog excerpts:\n{catalog_context or '(none available)'}\n\n"
                        + (
                            "A previous proposed clarification was rejected as repetitive: "
                            f"{avoid_question}\nAsk a materially different, concrete catalog-based "
                            "question. If no useful different question exists, set sufficient true."
                            if avoid_question else ""
                        )
                    ),
                }],
                temperature=0,
                max_tokens=350,
                response_format={"type": "json_object"},
            )
            parsed = json.loads(response.choices[0].message.content or "{}")
            intent = parsed.get("intent", "unclear")
            if intent not in {
                "factual", "recommendation", "comparison", "troubleshooting", "unclear"
            }:
                intent = "unclear"
            if self._is_recommendation_request(question):
                intent = "recommendation"
            sufficient = bool(parsed.get("sufficient", True))
            clarification = str(parsed.get("clarification_question") or "").strip()
            known_requirements = self._validated_known_requirements(
                parsed.get("known_requirements") or [], customer_evidence
            )
            missing_requirements = [
                " ".join(str(item).split())[:120]
                for item in (parsed.get("missing_requirements") or [])
                if str(item).strip()
            ][:5]
            if intent == "recommendation" and not known_requirements:
                sufficient = False
                if not clarification:
                    clarification = (
                        "What outcome do you need, and what requirements or constraints "
                        "must the recommendation meet?"
                    )
            options = []
            for option in parsed.get("clarification_options") or []:
                if not isinstance(option, dict):
                    continue
                label = str(option.get("label") or "").strip()
                message = str(option.get("message") or "").strip()
                if label and message:
                    options.append({"label": label[:120], "message": message[:500]})
                if len(options) == 3:
                    break
            options = self._sanitize_clarification_options(clarification, options)
            scenario_summary = str(parsed.get("scenario_summary") or "").strip()
            if intent == "recommendation":
                scenario_summary = "; ".join(
                    f"{item['requirement']}: {item['value']}"
                    for item in known_requirements
                )
            return {
                "intent": intent,
                "scenario_summary": scenario_summary,
                "known_requirements": known_requirements,
                "missing_requirements": missing_requirements,
                "sufficient": sufficient or not clarification,
                "clarification_question": clarification,
                "clarification_options": options,
                "no_more_information": bool(parsed.get("no_more_information", False)),
            }
        except Exception:
            # Conversation analysis should improve answers, never prevent retrieval.
            return {
                "intent": "unclear",
                "scenario_summary": "",
                "known_requirements": [],
                "missing_requirements": [],
                "sufficient": True,
                "clarification_question": "",
                "clarification_options": [],
                "no_more_information": False,
            }

    @staticmethod
    def _is_recommendation_request(question: str) -> bool:
        """Recognize selection language independently of any company's industry."""
        normalized = " ".join(question.casefold().split())
        return bool(re.search(
            r"\b(?:recommend|recommendation|suggest|best|choose|select|suitable|"
            r"right for me|fit for me|match for me|which one)\b",
            normalized,
        ))

    @staticmethod
    def _validated_known_requirements(items: list, customer_evidence: str) -> list[dict]:
        """Keep only requirements backed by a verbatim customer statement."""
        normalized_evidence = re.sub(r"\W+", " ", customer_evidence.casefold()).strip()
        validated = []
        seen = set()
        for item in items:
            if not isinstance(item, dict):
                continue
            requirement = " ".join(str(item.get("requirement") or "").split()).strip()
            value = " ".join(str(item.get("value") or "").split()).strip()
            evidence = " ".join(str(item.get("evidence") or "").split()).strip()
            normalized_quote = re.sub(r"\W+", " ", evidence.casefold()).strip()
            key = (requirement.casefold(), value.casefold())
            if (
                not requirement
                or not value
                or len(normalized_quote) < 3
                or normalized_quote not in normalized_evidence
                or key in seen
            ):
                continue
            seen.add(key)
            validated.append({
                "requirement": requirement[:120],
                "value": value[:300],
                "evidence": evidence[:300],
            })
        return validated[:12]

    @staticmethod
    def _catalog_context(candidates: list[dict], max_characters: int = 6000) -> str:
        """Build bounded catalog evidence used only to ask relevant questions."""
        blocks = []
        used = 0
        for candidate in candidates:
            document_name = " ".join(
                str(candidate.get("document_name") or "Catalog document").split()
            )
            content = " ".join(str(candidate.get("content") or "").split())
            if not content:
                continue
            block = f"[{document_name}] {content[:900]}"
            remaining = max_characters - used
            if remaining <= 0:
                break
            blocks.append(block[:remaining])
            used += len(block)
        return "\n\n".join(blocks)

    @staticmethod
    def _fallback_clarification(missing_requirements: list[str]) -> str:
        """Request unresolved criteria without using company-specific vocabulary."""
        details = [
            " ".join(str(item).split()).strip(" .?!")
            for item in missing_requirements
            if str(item).strip()
        ][:3]
        if details:
            if len(details) == 1:
                detail_text = details[0]
            else:
                detail_text = ", ".join(details[:-1]) + f", and {details[-1]}"
            return (
                "Please provide the following detail so I can distinguish the best match: "
                f"{detail_text}."
            )
        return (
            "Please describe the outcome you need and the most important constraint the "
            "recommended choice must satisfy."
        )

    @staticmethod
    def _looks_like_question(value: str) -> bool:
        text = re.sub(r"^(?:assistant|user):\s*", "", value.strip(), flags=re.I)
        if not text:
            return False
        if "?" in text:
            return True
        return bool(re.match(
            r"^(?:what|which|who|where|when|why|how|do|does|did|is|are|was|were|"
            r"can|could|would|will|should|have|has|tell|choose|select|provide|specify|describe|please)\b",
            text,
            flags=re.I,
        ))

    @classmethod
    def _sanitize_clarification_options(
        cls, clarification: str, options: list[dict]
    ) -> list[dict]:
        """Ensure a suggestion click sends a customer answer, never another prompt."""
        cleaned = []
        seen = set()
        for option in options:
            label = " ".join(str(option.get("label") or "").split()).strip(" .?!")
            message = " ".join(str(option.get("message") or "").split()).strip()
            if not label or label.casefold() in seen:
                continue
            seen.add(label.casefold())

            if (
                not message
                or cls._looks_like_question(message)
                or message.casefold().rstrip(" .?!")
                == clarification.casefold().rstrip(" .?!")
            ):
                continue
            elif not re.match(r"^(?:i|i'm|i’d|i'll|my|we|we're|our)\b", message, re.I):
                message = f"My answer is: {message.rstrip(' .')}."

            cleaned.append({"label": label[:120], "message": message[:500]})
            if len(cleaned) == 3:
                break
        return cleaned

    @classmethod
    def _clarification_round_count(cls, history: list[str]) -> int:
        """Count the current uninterrupted run of assistant clarification questions."""
        rounds = 0
        for entry in reversed(history):
            if not entry.strip().lower().startswith("assistant:"):
                continue
            if cls._looks_like_question(entry):
                rounds += 1
            else:
                break
        return rounds

    @classmethod
    def _is_repeated_clarification(cls, question: str, history: list[str]) -> bool:
        proposed = re.sub(r"\W+", " ", question.casefold()).strip()
        if not proposed:
            return False
        proposed_tokens = set(proposed.split())
        filler_words = {
            "a", "an", "are", "be", "do", "does", "for", "is", "it", "of",
            "referring", "that", "the", "this", "to", "what", "which", "you", "your",
        }
        proposed_meaning = proposed_tokens - filler_words
        for entry in history:
            if not entry.strip().lower().startswith("assistant:"):
                continue
            previous = re.sub(
                r"\W+",
                " ",
                re.sub(r"^assistant:\s*", "", entry, flags=re.I).casefold(),
            ).strip()
            if not previous:
                continue
            similarity = SequenceMatcher(None, proposed, previous).ratio()
            previous_tokens = set(previous.split())
            union = proposed_tokens | previous_tokens
            overlap = len(proposed_tokens & previous_tokens) / len(union) if union else 0
            previous_meaning = previous_tokens - filler_words
            smaller_meaning = min(len(proposed_meaning), len(previous_meaning))
            meaning_containment = (
                len(proposed_meaning & previous_meaning) / smaller_meaning
                if smaller_meaning else 0
            )
            if similarity >= 0.78 or overlap >= 0.72 or meaning_containment >= 0.8:
                return True
        return False
    
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
        retrieval_stats: dict[str, int | bool | str] = {}

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

        if question.strip().casefold() == (
            "none of these choices match, and i do not have more information."
        ):
            timings["total"] = int((perf_counter() - query_started) * 1000)
            return QueryResponse(
                answer=(
                    "I don't have enough information in your question to identify the "
                    "correct product or guidance."
                ),
                sources=[],
                diagnostics=QueryDiagnostics(
                    timings_ms=timings,
                    retrieval=retrieval_stats,
                ),
            )

        started = perf_counter()
        base_standalone_question = self._standalone_question(question, history or [])
        mark("standalone_question", started)

        started = perf_counter()
        preliminary_candidates = self.store.hybrid_query(
            company_id,
            base_standalone_question,
            min(max(k, 8), 12),
        )
        mark("catalog_retrieval", started)

        started = perf_counter()
        catalog_context = self._catalog_context(preliminary_candidates)
        request_analysis = self._analyze_request(
            question,
            history or [],
            catalog_context,
        )
        mark("request_analysis", started)
        retrieval_stats["intent"] = request_analysis["intent"]
        retrieval_stats["known_requirement_count"] = len(
            request_analysis["known_requirements"]
        )
        retrieval_stats["missing_requirements"] = ", ".join(
            request_analysis["missing_requirements"]
        )[:500]
        clarification_rounds = self._clarification_round_count(history or [])
        repeated_clarification = self._is_repeated_clarification(
            request_analysis["clarification_question"], history or []
        )
        if (
            repeated_clarification
            and clarification_rounds < settings.max_clarification_rounds
        ):
            retry_analysis = self._analyze_request(
                question,
                history or [],
                catalog_context,
                avoid_question=request_analysis["clarification_question"],
            )
            retry_repeated = self._is_repeated_clarification(
                retry_analysis["clarification_question"], history or []
            )
            if retry_repeated:
                retry_analysis["sufficient"] = False
                retry_analysis["clarification_question"] = self._fallback_clarification(
                    retry_analysis["missing_requirements"]
                    or request_analysis["missing_requirements"]
                )
                retry_analysis["clarification_options"] = []
            request_analysis = retry_analysis
            repeated_clarification = False
            retrieval_stats["intent"] = request_analysis["intent"]
            retrieval_stats["known_requirement_count"] = len(
                request_analysis["known_requirements"]
            )
            retrieval_stats["missing_requirements"] = ", ".join(
                request_analysis["missing_requirements"]
            )[:500]
        clarification_exhausted = (
            clarification_rounds >= settings.max_clarification_rounds
            or repeated_clarification
        )
        retrieval_stats["clarification_rounds"] = clarification_rounds
        retrieval_stats["clarification_exhausted"] = clarification_exhausted
        if request_analysis["no_more_information"]:
            timings["total"] = int((perf_counter() - query_started) * 1000)
            return QueryResponse(
                answer=(
                    "I don't have enough information in your question to identify the "
                    "correct product or guidance."
                ),
                sources=[],
                diagnostics=QueryDiagnostics(
                    timings_ms=timings,
                    retrieval=retrieval_stats,
                ),
            )
        if not request_analysis["sufficient"] and not clarification_exhausted:
            suggestions = [
                ClarificationSuggestion(label=option["label"], message=option["message"])
                for option in request_analysis["clarification_options"]
            ]
            if suggestions:
                suggestions.append(
                    ClarificationSuggestion(
                        label="None of these",
                        message="None of these choices match, and I do not have more information.",
                    )
                )
            timings["total"] = int((perf_counter() - query_started) * 1000)
            return QueryResponse(
                answer=request_analysis["clarification_question"],
                sources=[],
                suggestions=suggestions,
                diagnostics=QueryDiagnostics(
                    timings_ms=timings,
                    retrieval=retrieval_stats,
                ),
            )

        started = perf_counter()
        standalone_question = base_standalone_question
        if request_analysis["scenario_summary"]:
            standalone_question = (
                f"{standalone_question}\nCustomer scenario and constraints: "
                f"{request_analysis['scenario_summary']}"
            )
        if clarification_exhausted:
            standalone_question = (
                f"{standalone_question}\nThe clarification limit has been reached. "
                "Do not ask another question. Use the known requirements and give the "
                "best-supported result, stating assumptions or missing constraints."
            )
        mark("scenario_question", started)

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
        for chunk in preliminary_candidates:
            key = (chunk["document_id"], chunk.get("page_number"), chunk["content"][:80])
            seen[key] = chunk
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
        

        if not retrieved and clarification_exhausted:
            timings["total"] = int((perf_counter() - query_started) * 1000)
            return QueryResponse(
                answer=(
                    "I don't have enough confirmed information to recommend one confidently. "
                    "If you can share the product model, system specification, or required "
                    "compatibility later, I'll be able to narrow it down."
                ),
                sources=[],
                diagnostics=QueryDiagnostics(
                    timings_ms=timings,
                    retrieval=retrieval_stats,
                ),
            )
        if not retrieved:
            suggestions = self._clarification_suggestions(question, candidates)
            return QueryResponse(
                answer=self._clarification_answer(suggestions),
                sources=[],
                suggestions=suggestions,
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
                        f"Standalone search question: {standalone_question}\n\n"
                        + (
                            "Response requirement: the customer has completed the maximum "
                            "clarification rounds. Do not ask another question. Give the best "
                            "supported recommendation and explicitly state assumptions or gaps."
                            if clarification_exhausted else ""
                        )
                    ),
                },
            ],
            temperature=0.2,
        )
        mark("answer_generation", started)

        answer = response.choices[0].message.content or ""
        started = perf_counter()
        answer = self._verify_answer(
            standalone_question,
            context,
            answer,
            allow_clarification=not clarification_exhausted,
        )
        answer = self._remove_verifier_commentary(answer)
        if self._is_unsupported_answer(answer):
            if clarification_exhausted:
                answer = (
                    "I don't have enough confirmed information to make a confident recommendation "
                    "yet. When you have the product model or compatibility details, share them "
                    "with me and I'll help you narrow it down."
                )
            else:
                suggestions = self._clarification_suggestions(question, candidates)
                return QueryResponse(
                    answer=self._clarification_answer(suggestions),
                    sources=[],
                    suggestions=suggestions,
                )
        cited_indices = {
            int(index)
            for index in re.findall(r"\[Source\s+(\d+)\]", answer, flags=re.I)
            if 1 <= int(index) <= len(retrieved)
        }
        cited_retrieved = [
            chunk for index, chunk in enumerate(retrieved, 1)
            if index in cited_indices
        ]
        sources = [
            SourceChunk(
                document_id=c["document_id"],
                document_name=c["document_name"],
                content=c["content"][:300] + ("..." if len(c["content"]) > 300 else ""),
                score=c["score"],
                page_number=c.get("page_number"),
            )
            for c in cited_retrieved
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

    @staticmethod
    def _is_unsupported_answer(answer: str) -> bool:
        normalized = " ".join(answer.lower().split())
        unsupported_phrases = (
            "i couldn't find relevant information",
            "i could not find relevant information",
            "not available in the documents",
        )
        return bool(re.search(r"\bi (?:don't|do not) have\b", normalized)) or any(
            phrase in normalized for phrase in unsupported_phrases
        )

    @staticmethod
    def _remove_verifier_commentary(answer: str) -> str:
        """Remove accidental internal editing notes from a customer-facing answer."""
        cleaned = re.sub(
            r"(?im)(?:^|(?<=[.!?]))\s*[^.!?\n]*(?:"
            r"unsupported in (?:the )?(?:provided|supplied) context|"
            r"should be removed|should be omitted"
            r")[^.!?\n]*[.!?]?",
            " ",
            answer,
        )
        cleaned = re.sub(r"(?im)^.*(?:draft answer|verified answer).*$", "", cleaned)
        cleaned = re.sub(r"[ \t]+\n", "\n", cleaned)
        cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
        return cleaned.strip()

    def _clarification_suggestions(
        self, question: str, candidates: list[dict]
    ) -> list[ClarificationSuggestion]:
        """Turn weak retrieval matches into safe, clickable follow-up searches."""
        suggestions = []
        seen = set()
        key_terms = {
            term.lower()
            for term in re.findall(r"[A-Za-z0-9-]+", question)
            if len(term) >= 5 or any(char.isdigit() for char in term)
        }
        for chunk in candidates:
            content = " ".join(chunk.get("content", "").split())
            if not content:
                continue
            document_name = chunk.get("document_name") or "Related document"
            candidate_text = f"{document_name} {content}".lower()
            if key_terms and not any(term in candidate_text for term in key_terms):
                continue
            page = chunk.get("page_number")
            excerpt = content[:180].rsplit(" ", 1)[0].strip() or content[:180]
            page_suffix = f" (page {page})" if page else ""
            label = f"{document_name}{page_suffix}: {excerpt}"
            if label.casefold() in seen:
                continue
            seen.add(label.casefold())
            suggestions.append(
                ClarificationSuggestion(
                    label=label,
                    message=(
                        "I meant this related topic: "
                        f"{excerpt}. Please use it to answer my original question."
                    ),
                )
            )
            if len(suggestions) == 3:
                break
        return suggestions

    @staticmethod
    def _clarification_answer(suggestions: list[ClarificationSuggestion]) -> str:
        if suggestions:
            return (
                "I want to make sure I've understood you correctly. "
                "Which of these is closest to what you mean? You can also add a little more detail."
            )
        return (
            "I want to make sure I give you the right answer. Could you share the "
            "product model, a related document name, or one more detail?"
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

    def _verify_answer(
        self,
        question: str,
        context: str,
        answer: str,
        allow_clarification: bool = True,
    ) -> str:
        if not settings.enable_answer_verification or not answer.strip():
            return answer
        verification_policy = (
            "If the context does not answer the question, ask for the smallest useful "
            "detail needed to identify the right product or document section."
            if allow_clarification
            else "Do not ask another question. If a reliable match cannot be made, say so "
            "and summarize only the closest result supported by the context."
        )
        try:
            response = self.openai.chat.completions.create(
                model=settings.openai_chat_model,
                messages=[{
                    "role": "user",
                    "content": (
                        "Verify the draft answer strictly against the supplied context. "
                        "Remove or correct every unsupported factual claim. Add the correct "
                        "[Source N] citation to every retained factual product or service claim. "
                        "Preserve a friendly, natural, concise customer-support tone while editing. "
                        "Use direct wording and contractions where appropriate, and do not make the "
                        "answer sound like a report or mention documents unless the customer asks. "
                        "Do not add outside knowledge. A source may "
                        "support claims only about the same named product or service described "
                        "in that source block. Return only the revised customer-facing answer. "
                        "Silently remove unsupported material; never mention verification, the "
                        "draft, supplied context, unsupported claims, or what was removed. If the "
                        "draft asks concise clarification questions and makes no product "
                        "claims, preserve those questions only when clarification is allowed. "
                        f"{verification_policy}\n\n"
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
                f"[{i}] Document: {item.get('document_name', 'Unknown')}\n"
                f"{item['content'][:1200]}"
                for i, item in enumerate(candidates)
            )
            response = self.openai.chat.completions.create(
                model=settings.openai_chat_model,
                messages=[{
                    "role": "user",
                    "content": (
                        "Select only context chunks that directly help answer the question. "
                        "Reject chunks from unrelated subjects even if they share generic words. "
                        "For product or service recommendations, retain only chunks that describe "
                        "a candidate matching an explicit customer requirement. Return [] when no "
                        "chunk is directly relevant. "
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
            return selected[:limit]
        except Exception:
            return candidates[:limit]
