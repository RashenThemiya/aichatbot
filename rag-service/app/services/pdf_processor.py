import re
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
            current = f"{current}\n\n{paragraph}".strip() if current else paragraph
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
