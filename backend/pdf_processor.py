import fitz  # PyMuPDF
import os

def extract_text_from_pdf(filepath: str) -> str:
    """
    Extracts all text from a given PDF file.
    """
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"File not found: {filepath}")
    
    text = ""
    try:
        # Open the PDF file
        with fitz.open(filepath) as doc:
            for page in doc:
                text += page.get_text() + "\n"
    except Exception as e:
        print(f"Error reading PDF {filepath}: {e}")
    return text
