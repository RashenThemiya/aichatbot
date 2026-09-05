import unittest

from app.services.product_names import (
    extract_product_names,
    matches_product_names,
)


class ProductNameTests(unittest.TestCase):
    def test_camel_case_product_families_are_extracted(self):
        self.assertEqual(
            extract_product_names("Compare SunSaver with SureSine."),
            {"sunsaver", "suresine"},
        )

    def test_ordinary_title_case_words_are_not_product_filters(self):
        self.assertEqual(
            extract_product_names("What System Voltages Are Supported?"),
            set(),
        )

    def test_persisted_family_matches_normalized_question_name(self):
        self.assertTrue(matches_product_names(
            "System voltage is 12 or 24 V.",
            {"product_names": "sunsaver"},
            {"sunsaver"},
        ))


if __name__ == "__main__":
    unittest.main()
