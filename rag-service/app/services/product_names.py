"""Conservative product-family name extraction for retrieval scoping."""

import re


# Product families such as SunSaver and SureSine use an internal capital. This
# deliberately avoids guessing ordinary title-cased words as product names.
_CAMEL_CASE_PRODUCT = re.compile(
    r"(?<![A-Za-z0-9])([A-Z][a-z]+(?:[A-Z][A-Za-z0-9]+)+)(?![A-Za-z0-9])"
)


def normalize_product_name(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9]", "", str(value or "")).casefold()


def extract_product_names(text: str) -> set[str]:
    """Return normalized, high-confidence product-family names."""
    return {
        normalized
        for match in _CAMEL_CASE_PRODUCT.finditer(str(text or ""))
        if (normalized := normalize_product_name(match.group(1)))
    }


def serialize_product_names(product_names: set[str]) -> str:
    return ",".join(sorted(product_names))


def deserialize_product_names(value: object) -> set[str]:
    return {
        normalized
        for item in str(value or "").split(",")
        if (normalized := normalize_product_name(item))
    }


def item_product_names(document: str, metadata: dict) -> set[str]:
    persisted = deserialize_product_names(metadata.get("product_names", ""))
    if persisted:
        return persisted
    return extract_product_names(
        f"{metadata.get('document_name', '')}\n{document or ''}"
    )


def matches_product_names(document: str, metadata: dict, required: set[str]) -> bool:
    return not required or bool(item_product_names(document, metadata) & required)
