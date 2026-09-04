import unittest

from app.services.rag_engine import RAGEngine


class HistoryAndNumericGuardrailTests(unittest.TestCase):
    def test_explicit_new_model_drops_previous_product_history(self):
        history = [
            "user: What fuse does IC121040 use?",
            "assistant: It uses a 300 A fuse.",
        ]

        scoped = RAGEngine._scope_history_to_current_topic(
            "What fuse does IC1230150 use?",
            history,
        )

        self.assertEqual(scoped, [])

    def test_model_follow_up_keeps_only_current_topic(self):
        history = [
            "user: Tell me about IC121040",
            "assistant: Earlier product answer.",
            "user: Tell me about IC1230150",
            "assistant: Current product answer.",
        ]

        scoped = RAGEngine._scope_history_to_current_topic(
            "What fuse does it use?",
            history,
        )

        self.assertNotIn("IC121040", "\n".join(scoped))
        self.assertIn("IC1230150", "\n".join(scoped))

    def test_named_product_question_drops_unrelated_model_history(self):
        history = [
            "user: Where are the mounting holes on IC244090i?",
            "assistant: Check the technical drawing.",
        ]

        scoped = RAGEngine._scope_history_to_current_topic(
            "What is the SureSine inverter?",
            history,
        )

        self.assertEqual(scoped, [])

    def test_generic_follow_up_uses_latest_named_product_topic(self):
        history = [
            "user: Where are the mounting holes on IC244090i?",
            "assistant: Earlier product answer.",
            "user: What is the SureSine inverter?",
            "assistant: SureSine is a pure sine wave inverter.",
        ]

        scoped = RAGEngine._scope_history_to_current_topic(
            "What AC output versions are available?",
            history,
        )

        joined = "\n".join(scoped)
        self.assertNotIn("IC244090i", joined)
        self.assertIn("SureSine", joined)

    def test_wrong_numeric_value_is_rejected(self):
        retrieved = [{"content": "The IC1230150 fuse rating is 450 A."}]

        unsupported = RAGEngine._unsupported_numeric_claims(
            "The required fuse is 300A [Source 1].",
            retrieved,
        )

        self.assertEqual(unsupported, [("", "300", "a")])

    def test_uncited_numeric_value_is_rejected(self):
        retrieved = [{"content": "The fuse rating is 450 A."}]

        unsupported = RAGEngine._unsupported_numeric_claims(
            "The fuse rating is 450 A.",
            retrieved,
        )

        self.assertEqual(unsupported, [("", "450", "a")])

    def test_supported_numeric_value_and_dimensions_are_accepted(self):
        retrieved = [{
            "content": (
                "Fuse: 450 A. Dimensions: 464 x 300 x 155 mm. Threshold: >3.0 V. "
                "Input: 120/240 VAC. Warranty: two years."
            )
        }]

        unsupported = RAGEngine._unsupported_numeric_claims(
            "It uses a 450A fuse and measures 464 × 300 × 155 mm [Source 1]. "
            "The threshold is above 3.0V [Source 1]. Input is 120 VAC [Source 1]. "
            "The warranty is 2-year [Source 1].",
            retrieved,
        )

        self.assertEqual(unsupported, [])

    def test_paragraph_level_citation_supports_all_numeric_sentences(self):
        retrieved = [{
            "content": (
                "Continuous Power Rating: 300 Watts at 25°C. "
                "AC output versions: 115 VAC at 60 Hz or 220 VAC at 50 Hz."
            )
        }]

        unsupported = RAGEngine._unsupported_numeric_claims(
            "Continuous power is 300 W at 25°C. Output versions are 115 VAC at "
            "60 Hz and 220 VAC at 50 Hz. [Source 1]",
            retrieved,
        )

        self.assertEqual(unsupported, [])

    def test_unicode_comparators_and_dimensions_are_normalized(self):
        claims = RAGEngine._numeric_claims(
            "Threshold ≥3.0 V; enclosure 213 × 152 × 105 mm."
        )

        self.assertIn((">=", "3", "v"), claims)
        self.assertIn(("", "213", "mm"), claims)


if __name__ == "__main__":
    unittest.main()
