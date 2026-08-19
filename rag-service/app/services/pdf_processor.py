import base64
from io import BytesIO
import re
from dataclasses import dataclass
from pathlib import Path

import fitz  # PyMuPDF
import pdfplumber
import pytesseract
from PIL import Image
from openai import OpenAI

from app.config import settings

_vision_client = OpenAI(api_key=settings.openai_api_key)

if settings.tesseract_cmd:
    pytesseract.pytesseract.tesseract_cmd = settings.tesseract_cmd

@dataclass
class PdfPage:
    page_number: int
    text: str


@dataclass
class PdfChunk:
    content: str
    page_number: int


def _table_to_markdown(table: list[list[str | None]]) -> str:
    rows = [[(c or "").strip() for c in row] for row in table if row]
    if not rows:
        return ""
    header, *body = rows
    lines = ["| " + " | ".join(header) + " |", "| " + " | ".join(["---"] * len(header)) + " |"]
    for row in body:
        row = (row + [""] * len(header))[: len(header)]
        lines.append("| " + " | ".join(row) + " |")
    searchable_rows = [
        "; ".join(
            f"{column}: {value}"
            for column, value in zip(header, row)
            if column and value
        )
        for row in body
    ]
    search_text = "\n".join(row for row in searchable_rows if row)
    return "\n".join(lines) + (
        f"\n\nTable search text:\n{search_text}" if search_text else ""
    )

def _extract_tables(page):
    tables = page.extract_tables()
    if not tables:
        tables = page.extract_tables(table_settings={
            "vertical_strategy": "text",
            "horizontal_strategy": "text",
            "snap_y_tolerance": 5,
        })
    return tables


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


def _ocr_page(page: fitz.Page) -> str:
    """Run free, local OCR on a rendered PDF page."""
    try:
        pixmap = page.get_pixmap(dpi=settings.ocr_dpi, alpha=False)
        with Image.open(BytesIO(pixmap.tobytes("png"))) as image:
            return pytesseract.image_to_string(
                image,
                lang=settings.ocr_language,
            ).strip()
    except pytesseract.TesseractNotFoundError as exc:
        raise RuntimeError(
            "Local OCR is enabled, but Tesseract was not found. Install "
            "Tesseract and add it to PATH, or set TESSERACT_CMD."
        ) from exc
    except pytesseract.TesseractError:
        return ""


def extract_pages_from_pdf(file_path: str) -> list[PdfPage]:
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"PDF not found: {file_path}")
    if path.suffix.lower() != ".pdf":
        raise ValueError("Only PDF files are supported")

    pages: list[str] = []
    with pdfplumber.open(str(path)) as pdf:
        for page in pdf.pages:
            parts = []
            text = (page.extract_text(layout=True) or page.extract_text() or "").strip()
            if text:
                parts.append(text)
            for table in _extract_tables(page):
                md = _table_to_markdown(table)
                if md:
                    parts.append(f"[Table]\n{md}")
            pages.append("\n\n".join(parts))

    if settings.enable_local_ocr or settings.describe_pdf_images:
        doc = fitz.open(str(path))
        for i in range(len(doc)):
            if (
                settings.enable_local_ocr
                and len(pages[i].strip()) < settings.ocr_min_page_characters
            ):
                ocr_text = _ocr_page(doc[i])
                if ocr_text:
                    existing_text = pages[i].strip()
                    pages[i] = "\n\n".join(
                        part for part in (existing_text, ocr_text) if part
                    )

            if not settings.describe_pdf_images:
                continue

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

    if not any(p.strip() for p in pages):
        raise ValueError("No extractable text found in PDF")
    return [
        PdfPage(page_number=i + 1, text=text)
        for i, text in enumerate(pages)
        if text.strip()
    ]


def extract_text_from_pdf(file_path: str) -> str:
    """Backward-compatible plain-text extraction."""
    return "\n\n".join(page.text for page in extract_pages_from_pdf(file_path))






def _split_on_paragraphs(text: str) -> list[str]:
    paragraphs = re.split(r"\n\s*\n", text)
    return [p.strip() for p in paragraphs if p.strip()]


def _is_heading(text: str) -> bool:
    line = " ".join(text.split())
    if not line or len(line) > 120 or "\n" in text.strip():
        return False
    words = line.split()
    return (
        line.isupper()
        or line.endswith(":")
        or bool(re.match(r"^(\d+(\.\d+)*|[A-Z])[\s.)-]+", line))
        or (len(words) <= 10 and line == line.title())
    )


def _split_long_unit(text: str, limit: int) -> list[str]:
    if len(text) <= limit or text.startswith("[Table]"):
        return [text]
    sentences = [
        sentence.strip()
        for sentence in re.split(r"(?<=[.!?])\s+", text)
        if sentence.strip()
    ]
    if len(sentences) <= 1:
        return [
            text[start:start + limit]
            for start in range(0, len(text), limit)
        ]
    units, current = [], ""
    for sentence in sentences:
        if current and len(current) + len(sentence) + 1 > limit:
            units.append(current)
            current = sentence
        else:
            current = f"{current} {sentence}".strip()
    if current:
        units.append(current)
    return units


def chunk_text(text: str) -> list[str]:
    """Create section-aware chunks without cutting sentences or tables."""
    chunk_size = settings.chunk_size
    overlap = settings.chunk_overlap
    paragraphs = _split_on_paragraphs(text)
    chunks, current_units = [], []
    current_heading = ""

    def flush() -> None:
        if not current_units:
            return
        body = "\n\n".join(current_units)
        content = (
            f"Section: {current_heading}\n\n{body}"
            if current_heading and current_heading not in body else body
        )
        chunks.append(content)

    for paragraph in paragraphs:
        if _is_heading(paragraph):
            flush()
            current_units = []
            current_heading = " ".join(paragraph.split())
            continue

        for unit in _split_long_unit(paragraph, chunk_size):
            projected = len("\n\n".join([*current_units, unit]))
            if current_units and projected > chunk_size:
                previous_tail = current_units[-1]
                flush()
                current_units = (
                    [previous_tail[-overlap:]]
                    if overlap and not previous_tail.startswith("[Table]")
                    else []
                )
            current_units.append(unit)

    flush()
    return chunks or [text[:chunk_size]]


def chunk_pages(pages: list[PdfPage]) -> list[PdfChunk]:
    """Chunk each page separately so retrieval can retain reliable citations."""
    chunks: list[PdfChunk] = []
    for page in pages:
        chunks.extend(
            PdfChunk(content=content, page_number=page.page_number)
            for content in chunk_text(page.text)
        )
    return chunks

