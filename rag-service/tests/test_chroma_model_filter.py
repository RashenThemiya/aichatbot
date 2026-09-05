import unittest

import chromadb

from app.services.chroma_store import ChromaStore
from app.services.pdf_processor import PdfChunk


class ChromaModelFilterTests(unittest.TestCase):
    def test_add_document_chunks_returns_count_and_stores_raw_text(self):
        client = chromadb.EphemeralClient()
        collection = client.create_collection("ingest_return_test")
        store = ChromaStore.__new__(ChromaStore)
        store._get_collection = lambda _company_id: collection
        store._embed = lambda texts: [[1.0, 0.0] for _text in texts]

        count = store.add_document_chunks(
            "company",
            "document",
            "SunSaver manual.pdf",
            [PdfChunk(content="Model SS-6-12V", page_number=1)],
        )

        stored = collection.get(include=["documents"])
        self.assertEqual(count, 1)
        self.assertEqual(stored["documents"], ["Model SS-6-12V"])

    def test_legacy_embedding_labels_are_hidden_from_answer_context(self):
        stored = (
            "Document: operation-manual-.pdf\n"
            "Product model: SS1012V, NFPA70\n\n"
            "Available model: SS-10-12V"
        )

        self.assertEqual(
            ChromaStore._display_content(stored),
            "Available model: SS-10-12V",
        )

    def test_inactive_and_other_model_chunks_are_excluded_before_ranking(self):
        client = chromadb.EphemeralClient()
        collection = client.create_collection("model_filter_test")
        collection.add(
            ids=["correct", "wrong-model", "inactive"],
            embeddings=[[1.0, 0.0], [1.0, 0.0], [1.0, 0.0]],
            documents=[
                "IC1230150 fuse rating is 450 A",
                "IC121040 fuse rating is 300 A",
                "IC1230150 old fuse rating is 400 A",
            ],
            metadatas=[
                {
                    "document_id": "doc-correct",
                    "document_name": "IC1230150.pdf",
                    "model_ids": "IC1230150",
                    "is_active": True,
                },
                {
                    "document_id": "doc-wrong",
                    "document_name": "IC121040.pdf",
                    "model_ids": "IC121040",
                    "is_active": True,
                },
                {
                    "document_id": "doc-inactive",
                    "document_name": "IC1230150_old.pdf",
                    "model_ids": "IC1230150",
                    "is_active": False,
                },
            ],
        )

        store = ChromaStore.__new__(ChromaStore)
        store._get_collection = lambda _company_id: collection
        store._embed = lambda _texts: [[1.0, 0.0]]

        results = store.hybrid_query(
            "company",
            "What fuse does IC1230150 use?",
            5,
            required_model_ids={"IC1230150"},
        )

        self.assertEqual(
            {result["document_id"] for result in results},
            {"doc-correct"},
        )

    def test_product_family_and_document_scope_exclude_other_manuals(self):
        client = chromadb.EphemeralClient()
        collection = client.create_collection("product_document_filter_test")
        collection.add(
            ids=["sun", "sine", "other-sun"],
            embeddings=[[1.0, 0.0], [1.0, 0.0], [1.0, 0.0]],
            documents=[
                "Controller self-consumption is less than 8 mA.",
                "Inverter self-consumption is 25 mA off and 450 mA on.",
                "SunSaver marketing overview.",
            ],
            metadatas=[
                {
                    "document_id": "sunsaver-manual",
                    "document_name": "operation-manual-.pdf",
                    "product_names": "sunsaver",
                    "is_active": True,
                },
                {
                    "document_id": "suresine-manual",
                    "document_name": "manual (1).pdf",
                    "product_names": "suresine",
                    "is_active": True,
                },
                {
                    "document_id": "sunsaver-brochure",
                    "document_name": "brochure.pdf",
                    "product_names": "sunsaver",
                    "is_active": True,
                },
            ],
        )

        store = ChromaStore.__new__(ChromaStore)
        store._get_collection = lambda _company_id: collection
        store._embed = lambda _texts: [[1.0, 0.0]]

        results = store.hybrid_query(
            "company",
            "What is the controller self-consumption?",
            5,
            required_product_names={"sunsaver"},
            allowed_document_ids={"sunsaver-manual"},
        )

        self.assertEqual(
            {result["document_id"] for result in results},
            {"sunsaver-manual"},
        )


if __name__ == "__main__":
    unittest.main()
