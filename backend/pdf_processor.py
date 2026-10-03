import fitz  # PyMuPDF
import os
from typing import Optional

def extract_text_from_pdf(filepath: Optional[str] = None, file_bytes: Optional[bytes] = None) -> str:
    """
    Extracts all text from a given PDF file path or raw bytes in-memory.
    Supports serverless environments without requiring disk writes.
    """
    text = ""
    try:
        if file_bytes is not None:
            with fitz.open(stream=file_bytes, filetype="pdf") as doc:
                for page in doc:
                    text += page.get_text() + "\n"
        elif filepath is not None and os.path.exists(filepath):
            with fitz.open(filepath) as doc:
                for page in doc:
                    text += page.get_text() + "\n"
        else:
            raise ValueError("Either filepath or file_bytes must be provided")
    except Exception as e:
        print(f"Error reading PDF: {e}")
    return text
