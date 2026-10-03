import fitz  # PyMuPDF
import os
import io
import shutil
from typing import Optional, List, Dict, Any
from PIL import Image

# Minimum characters on a page to use direct text extraction instead of OCR
TEXT_THRESHOLD = 50

# Ensure TESSDATA_PREFIX is configured if local tessdata directory exists
PROJECT_ROOT = os.path.dirname(os.path.dirname(__file__))
LOCAL_TESSDATA = os.path.join(PROJECT_ROOT, "tessdata")
if os.path.exists(LOCAL_TESSDATA):
    os.environ["TESSDATA_PREFIX"] = LOCAL_TESSDATA


def _get_tesseract_cmd() -> Optional[str]:
    """
    Finds the Tesseract executable on the system.
    Checks PATH first, then standard Windows & Conda installation paths.
    """
    which_cmd = shutil.which("tesseract")
    if which_cmd:
        return which_cmd

    candidates = [
        os.path.expanduser(r"~\miniconda3\Library\bin\tesseract.exe"),
        r"C:\Users\mesth\miniconda3\Library\bin\tesseract.exe",
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
        r"C:\tesseract-ocr\tesseract.exe"
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return None


def run_ocr_on_page(page) -> str:
    """
    Existing OCR pipeline:
    1. Render PDF page to image (pixmap)
    2. Preprocess: load via PIL and convert to grayscale
    3. Run OCR (using pytesseract or PyMuPDF built-in OCR fallback)
    """
    try:
        import pytesseract

        tess_cmd = _get_tesseract_cmd()
        if tess_cmd:
            pytesseract.pytesseract.tesseract_cmd = tess_cmd

        # 1. Render page to image at 150 DPI for balance between speed and quality
        pix = page.get_pixmap(dpi=150)
        img = Image.open(io.BytesIO(pix.tobytes("png")))

        # 2. Preprocess image: convert to grayscale
        img_gray = img.convert("L")

        # 3. Run Tesseract OCR
        ocr_text = pytesseract.image_to_string(img_gray)
        return ocr_text.strip()

    except Exception as err:
        # Fallback to PyMuPDF's built-in OCR engine if pytesseract fails
        try:
            if os.path.exists(LOCAL_TESSDATA):
                textpage = page.get_textpage_ocr(tessdata=LOCAL_TESSDATA)
                return page.get_text(textpage=textpage).strip()
        except Exception:
            pass
        print(f"OCR warning: {err}")
        return ""


def extract_text_from_pdf(
    filepath: Optional[str] = None,
    file_bytes: Optional[bytes] = None,
    filename: str = "document.pdf"
) -> Dict[str, Any]:
    """
    Processes a PDF file page by page:
    - First attempts direct PyMuPDF text extraction.
    - If a page has > 50 characters, uses direct text (method: "text") and skips OCR.
    - If a page has <= 50 characters, runs the image render + preprocess + OCR pipeline (method: "ocr").
    - Operates per page so mixed PDFs (part scanned, part digital) work seamlessly.
    """
    pages_result: List[Dict[str, Any]] = []
    text_page_count = 0
    ocr_page_count = 0

    try:
        # Open PDF either from in-memory bytes or disk path
        if file_bytes is not None:
            doc = fitz.open(stream=file_bytes, filetype="pdf")
        elif filepath is not None and os.path.exists(filepath):
            doc = fitz.open(filepath)
        else:
            raise ValueError("Either filepath or file_bytes must be provided")

        for page_idx, page in enumerate(doc, start=1):
            # Step 1: Try PyMuPDF direct text extraction first
            direct_text = page.get_text().strip()

            if len(direct_text) > TEXT_THRESHOLD:
                # Page has selectable text: use it directly and skip OCR
                pages_result.append({
                    "page_num": page_idx,
                    "filename": filename,
                    "method": "text",
                    "char_count": len(direct_text),
                    "text": direct_text
                })
                text_page_count += 1
            else:
                # Step 2: Page has little or no text: render to image, preprocess, run OCR
                ocr_text = run_ocr_on_page(page)
                pages_result.append({
                    "page_num": page_idx,
                    "filename": filename,
                    "method": "ocr",
                    "char_count": len(ocr_text),
                    "text": ocr_text
                })
                ocr_page_count += 1

        doc.close()

    except Exception as e:
        print(f"Error processing PDF {filename}: {e}")

    total_pages = text_page_count + ocr_page_count

    return {
        "filename": filename,
        "total_pages": total_pages,
        "text_pages": text_page_count,
        "ocr_pages": ocr_page_count,
        "pages": pages_result
    }
