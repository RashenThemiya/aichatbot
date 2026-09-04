import unittest

import chromadb

from app.services.chroma_store import ChromaStore


class ChromaModelFilterTests(unittest.TestCase):
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


if __name__ == "__main__":
    unittest.main()
