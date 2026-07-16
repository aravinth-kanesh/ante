import io
import re

from docx import Document
from pypdf import PdfReader

SUPPORTED = (".pdf", ".docx", ".txt")


def extract_text(filename: str, data: bytes) -> str:
    name = filename.lower()
    if name.endswith(".pdf"):
        reader = PdfReader(io.BytesIO(data))
        text = "\n".join(page.extract_text() or "" for page in reader.pages)
    elif name.endswith(".docx"):
        document = Document(io.BytesIO(data))
        text = "\n".join(p.text for p in document.paragraphs)
    elif name.endswith(".txt"):
        text = data.decode("utf-8", errors="replace")
    else:
        raise ValueError("Unsupported file type; use PDF, Word (.docx) or plain text")

    # collapse runs of blank lines and trailing spaces
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()
