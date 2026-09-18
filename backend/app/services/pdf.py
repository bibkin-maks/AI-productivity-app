import io
from typing import List

from langchain_text_splitters import RecursiveCharacterTextSplitter
from pypdf import PdfReader

MAX_PDF_PAGES = 100  # Reasonable limit; larger docs risk token budget exhaustion

def process_pdf_bytes(file_bytes: bytes) -> List[str]:
    # Synchronous CPU-bound task - in production consider running in a threadpool
    reader = PdfReader(io.BytesIO(file_bytes))

    if len(reader.pages) > MAX_PDF_PAGES:
        raise ValueError(
            f"PDF has {len(reader.pages)} pages, which exceeds the {MAX_PDF_PAGES}-page limit."
        )

    full_text = ""
    for page in reader.pages:
        extracted = page.extract_text() or ""
        full_text += extracted + "\n"

    # RecursiveCharacterTextSplitter respects natural sentence/paragraph boundaries.
    # chunk_overlap=150 ensures consecutive chunks share context so answers
    # don't get cut off at chunk boundaries.
    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=150)
    chunks = splitter.split_text(full_text)

    return chunks
