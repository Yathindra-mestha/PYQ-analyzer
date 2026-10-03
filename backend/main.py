from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import os

try:
    from backend.pdf_processor import extract_text_from_pdf
except ImportError:
    from pdf_processor import extract_text_from_pdf

app = FastAPI(title="PYQ Analyzer API")

# Allow CORS for frontend interaction
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "Past Paper Analyzer API"}

@app.post("/analyze")
async def analyze_papers(files: List[UploadFile] = File(...)):
    """
    Accepts one or more PDF files and extracts text per page using:
    - Direct PyMuPDF text extraction if > 50 characters of text exist on the page.
    - OCR pipeline (image rendering + grayscale preprocessing + OCR) if little/no text exists.
    Returns per-page details with 'method' ('text' or 'ocr') and a top-level summary.
    """
    all_pages = []
    total_text_pages = 0
    total_ocr_pages = 0

    for file in files:
        # Read file bytes in memory (safe for local and serverless)
        content = await file.read()
        
        # Process the PDF with per-page hybrid detection
        result = extract_text_from_pdf(
            file_bytes=content,
            filename=file.filename
        )

        total_text_pages += result["text_pages"]
        total_ocr_pages += result["ocr_pages"]
        all_pages.extend(result["pages"])

    total_pages = total_text_pages + total_ocr_pages

    # Generate summary string in the requested format (e.g. "35 pages: 0 text, 35 OCR")
    summary_text = f"{total_pages} pages: {total_text_pages} text, {total_ocr_pages} OCR"

    return {
        "summary": summary_text,
        "total_pages": total_pages,
        "text_pages": total_text_pages,
        "ocr_pages": total_ocr_pages,
        "paper_count": len(files),
        "pages": all_pages
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
