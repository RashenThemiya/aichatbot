import re
import json
from pathlib import Path

from pypdf import PdfReader

from app.config import settings


def extract_text_from_pdf(file_path: str) -> str:
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"PDF not found: {file_path}")
    if path.suffix.lower() != ".pdf":
        raise ValueError("Only PDF files are supported")

    reader = PdfReader(str(path))
    pages: list[str] = []
    for page in reader.pages:
        text = page.extract_text() or ""
        pages.append(text.strip())

    full_text = "\n\n".join(p for p in pages if p)
    if not full_text.strip():
        raise ValueError("No extractable text found in PDF")

    return full_text


def _extract_api_doc_text(path: Path) -> str:
    raw = path.read_text(encoding="utf-8", errors="ignore")
    suffix = path.suffix.lower()

    if suffix == ".json":
        try:
            data = json.loads(raw)
            paths = data.get("paths") if isinstance(data, dict) else None
            if isinstance(paths, dict) and paths:
                endpoint_lines: list[str] = []
                for route, methods in paths.items():
                    if not isinstance(methods, dict):
                        continue
                    for method, details in methods.items():
                        summary = ""
                        if isinstance(details, dict):
                            summary = details.get("summary") or details.get(
                                "description") or ""
                        endpoint_lines.append(
                            f"{str(method).upper()} {route} {summary}".strip())
                if endpoint_lines:
                    return "\n".join(endpoint_lines)
            return json.dumps(data, indent=2)
        except Exception:
            return raw

    return raw


def extract_text_from_file(file_path: str, doc_type: str = "pdf", mime_type: str = "") -> str:
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    suffix = path.suffix.lower()
    looks_pdf = doc_type == "pdf" or suffix == ".pdf" or mime_type == "application/pdf"
    if looks_pdf:
        return extract_text_from_pdf(file_path)

    text = _extract_api_doc_text(path)
    if not text.strip():
        raise ValueError("No extractable text found in document")
    return text


def _split_on_paragraphs(text: str) -> list[str]:
    paragraphs = re.split(r"\n\s*\n", text)
    return [p.strip() for p in paragraphs if p.strip()]


def chunk_text(text: str) -> list[str]:
    """Split text into overlapping chunks sized for embedding retrieval."""
    chunk_size = settings.chunk_size
    overlap = settings.chunk_overlap
    paragraphs = _split_on_paragraphs(text)

    chunks: list[str] = []
    current = ""

    for paragraph in paragraphs:
        if len(current) + len(paragraph) + 2 <= chunk_size:
            current = f"{current}\n\n{paragraph}".strip(
            ) if current else paragraph
        else:
            if current:
                chunks.append(current)
            if len(paragraph) <= chunk_size:
                current = paragraph
            else:
                start = 0
                while start < len(paragraph):
                    end = start + chunk_size
                    chunks.append(paragraph[start:end])
                    start = end - overlap if end < len(paragraph) else end
                current = ""

    if current:
        chunks.append(current)

    if not chunks:
        return [text[:chunk_size]]

    overlapped: list[str] = []
    for i, chunk in enumerate(chunks):
        if i > 0 and overlap > 0:
            prev_tail = chunks[i - 1][-overlap:]
            if not chunk.startswith(prev_tail):
                chunk = prev_tail + chunk
        overlapped.append(chunk)

    return overlapped
