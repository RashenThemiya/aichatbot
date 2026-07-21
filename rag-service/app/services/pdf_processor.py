import re
from pathlib import Path

from app.config import settings
import base64
from pathlib import Path

import fitz  # PyMuPDF
import pdfplumber
from openai import OpenAI

from app.config import settings

_vision_client = OpenAI(api_key=settings.openai_api_key)


def _table_to_markdown(table: list[list[str | None]]) -> str:
    rows = [[(c or "").strip() for c in row] for row in table if row]
    if not rows:
        return ""
    header, *body = rows
    lines = ["| " + " | ".join(header) + " |", "| " + " | ".join(["---"] * len(header)) + " |"]
    for row in body:
        row = (row + [""] * len(header))[: len(header)]
        lines.append("| " + " | ".join(row) + " |")
    return "\n".join(lines)


def _describe_image(image_bytes: bytes) -> str:
    try:
        b64 = base64.b64encode(image_bytes).decode("utf-8")
        resp = _vision_client.chat.completions.create(
            model=settings.openai_vision_model,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text", "text": "Transcribe any visible text exactly, and describe what this image/diagram/chart shows. Be concise but complete."},
                    {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}},
                ],
            }],
            max_tokens=500,
        )
        return (resp.choices[0].message.content or "").strip()
    except Exception:
        return ""


def extract_text_from_pdf(file_path: str) -> str:
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"PDF not found: {file_path}")
    if path.suffix.lower() != ".pdf":
        raise ValueError("Only PDF files are supported")

    pages: list[str] = []
    with pdfplumber.open(str(path)) as pdf:
        for page in pdf.pages:
            parts = []
            text = (page.extract_text() or "").strip()
            if text:
                parts.append(text)
            for table in page.extract_tables():
                md = _table_to_markdown(table)
                if md:
                    parts.append(f"[Table]\n{md}")
            pages.append("\n\n".join(parts))

    if settings.describe_pdf_images:
        doc = fitz.open(str(path))
        for i in range(len(doc)):
            descs = []
            for img in doc[i].get_images(full=True):
                base = doc.extract_image(img[0])
                if base["width"] < settings.min_image_size or base["height"] < settings.min_image_size:
                    continue  # skip logos/icons/bullets
                desc = _describe_image(base["image"])
                if desc:
                    descs.append(f"[Image]\n{desc}")
            if descs:
                pages[i] = "\n\n".join(filter(None, [pages[i], *descs]))
        doc.close()

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
