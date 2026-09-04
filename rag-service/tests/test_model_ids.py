import unittest

from app.services.model_ids import (
    extract_model_ids,
    item_model_ids,
    matches_model_ids,
    normalize_model_id,
)


class ModelIdTests(unittest.TestCase):
    def test_spacing_and_hyphens_are_normalized(self):
        self.assertEqual(normalize_model_id("IC 121040-I"), "IC121040I")
        self.assertEqual(
            extract_model_ids("Compare IC 121040 with IC121040I."),
            {"IC121040", "IC121040I"},
        )

    def test_similar_models_remain_distinct(self):
        metadata = {"document_name": "IC121040I user manual.pdf"}

        self.assertFalse(matches_model_ids(
            "Inverter specifications",
            metadata,
            {"IC121040"},
        ))
        self.assertTrue(matches_model_ids(
            "Inverter specifications",
            metadata,
            {"IC121040I"},
        ))

    def test_filename_owns_document_even_when_another_model_is_mentioned(self):
        metadata = {"document_name": "IC121040I user manual.pdf"}

        self.assertEqual(
            item_model_ids("For comparison, see IC121040.", metadata),
            {"IC121040I"},
        )

    def test_error_and_certification_codes_are_not_models(self):
        self.assertEqual(
            extract_model_ids(
                "Error E05 at 10.5V, fuse 450A, RS485, RJ45, ingress IP20, "
                "and UL9540A certification"
            ),
            set(),
        )

    def test_long_hyphenated_models_are_supported(self):
        self.assertIn(
            "S6GC30KLVUS",
            extract_model_ids("Use the S6-GC30K-LV-US installation manual."),
        )

    def test_suresine_versions_are_models_but_standards_and_addresses_are_not(self):
        self.assertEqual(
            extract_model_ids(
                "SureSine SI-300-115V-UL and SI-300-220V comply with "
                "EN 60950-1. The office is in Newtown, PA 18940."
            ),
            {"SI300115VUL", "SI300220V"},
        )


if __name__ == "__main__":
    unittest.main()
