"""Product-model extraction shared by ingestion and retrieval."""

import re


# Model numbers are usually compact uppercase/alphanumeric codes. Spaces and
# hyphens are formatting variants and are removed by normalization.
_MODEL_PATTERN = re.compile(
    r"(?<![A-Za-z0-9])(?:"
    r"(?:[A-Za-z]{1,8}-){1,5}[A-Za-z]{1,8}\s*\d{2,}[A-Za-z0-9]*(?:-[A-Za-z0-9]+)*"
    r"|[A-Za-z]{1,8}\s+\d{2,}[A-Za-z0-9]*(?:-[A-Za-z0-9]+)*"
    r"|[A-Za-z]{1,12}\d{2,}[A-Za-z0-9]*(?:-[A-Za-z0-9]+)*"
    r"|[A-Za-z]{1,8}\d[A-Za-z0-9]*(?:-[A-Za-z0-9]+)+"
    r")(?![A-Za-z0-9])"
)

_NON_MODEL_PREFIXES = {
    "PAGE", "SOURCE", "FIGURE", "TABLE", "SECTION", "STEP", "OPTION",
    "ERROR", "CODE", "HTTP", "HTTPS", "ISBN", "YEAR",
    "MANUAL", "GUIDE", "DATASHEET", "DOCUMENT", "PRODUCT", "VERSION",
    "AT", "FUSE", "BATTERY", "INPUT", "OUTPUT", "VOLTAGE", "CURRENT",
    "POWER", "RATING", "MAX", "MIN", "TEMPERATURE", "TEMP", "PORT",
    "PIN", "CHARGE", "CHARGER", "CAPACITY", "FREQUENCY",
}
_NON_MODEL_CODES = re.compile(
    r"^(?:E|F|ERR|ERROR)\d{1,4}$|"
    r"^(?:IP|UL|IEC|IEEE|ISO|FCC|CE|ROHS|RS|RJ|USB|COM|MODBUS)\d+[A-Z0-9]*$|"
    r"^(?:V|VAC|VDC|A|AMP|W|KW|HZ|AH|MAH)\d+[A-Z0-9]*$"
)


def normalize_model_id(value: str) -> str:
    """Normalize display variations while preserving meaningful suffixes."""
    return re.sub(r"[^A-Za-z0-9]", "", str(value or "")).upper()


def extract_model_ids(text: str) -> set[str]:
    """Extract likely product IDs without treating error/spec codes as models."""
    found: set[str] = set()
    for match in _MODEL_PATTERN.finditer(str(text or "")):
        raw_value = match.group(0)
        # A spaced model prefix (for example "IC 121040") is code-like and
        # uppercase. This prevents ordinary phrases such as "at 10.5V" or
        # "fuse 450A" from becoming fake model filters.
        if re.search(r"\s", raw_value):
            prefix = re.split(r"[\s\d]", raw_value, maxsplit=1)[0]
            if prefix != prefix.upper():
                continue
        model_id = normalize_model_id(raw_value)
        if len(model_id) < 4 or not any(char.isdigit() for char in model_id):
            continue
        if _NON_MODEL_CODES.fullmatch(model_id):
            continue
        if any(model_id.startswith(prefix) for prefix in _NON_MODEL_PREFIXES):
            continue
        found.add(model_id)
    return found


def serialize_model_ids(model_ids: set[str]) -> str:
    """Chroma metadata values must be primitive, so store IDs as CSV."""
    return ",".join(sorted(model_ids))


def deserialize_model_ids(value: object) -> set[str]:
    return {
        normalized
        for item in str(value or "").split(",")
        if (normalized := normalize_model_id(item))
    }


def item_model_ids(document: str, metadata: dict) -> set[str]:
    """Read persisted IDs, with a fallback for documents indexed before this fix."""
    persisted = deserialize_model_ids(metadata.get("model_ids", ""))
    if persisted:
        return persisted
    # The filename identifies what the document belongs to. Mentions of other
    # models inside that document must not make it a source for those models.
    filename_ids = extract_model_ids(metadata.get("document_name", ""))
    return filename_ids or extract_model_ids(document or "")


def matches_model_ids(document: str, metadata: dict, required: set[str]) -> bool:
    return not required or bool(item_model_ids(document, metadata) & required)
