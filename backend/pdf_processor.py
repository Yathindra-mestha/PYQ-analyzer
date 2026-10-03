import os
import io
import fitz  # PyMuPDF
from PIL import Image
import pytesseract
from typing import Dict, Any

TEXT_THRESHOLD = 50

# Try to find Tesseract
def _get_tesseract_cmd():
    candidates = [
        r"C:\Users\mesth\miniconda3\Library\bin\tesseract.exe",
        os.path.expanduser(r"~\miniconda3\Library\bin\tesseract.exe"),
        r"C:\Program Files\Tesseract-OCR\tesseract.exe"
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return None

cmd = _get_tesseract_cmd()
if cmd:
    pytesseract.pytesseract.tesseract_cmd = cmd
else:
    # Set TESSDATA_PREFIX as fallback for PyMuPDF OCR
    os.environ["TESSDATA_PREFIX"] = os.path.join(os.getcwd(), "tessdata")

IMAGE_DIR = "static/images"
os.makedirs(IMAGE_DIR, exist_ok=True)

def extract_text_from_pdf(file_bytes: bytes = None, filepath: str = None, filename: str = "document.pdf") -> Dict[str, Any]:
    doc = fitz.open(stream=file_bytes, filetype="pdf") if file_bytes else fitz.open(filepath)
    text_page_count = 0
    ocr_page_count = 0
    pages_result = []

    for page_idx, page in enumerate(doc, start=1):
        if doc.page_count > 10 and page_idx % 5 == 0:
            print(f"Processing page {page_idx} of {doc.page_count}...")

        # Save page image for cropping later
        pix = page.get_pixmap(dpi=150)
        page_img_path = os.path.join(IMAGE_DIR, f"{filename}_page_{page_idx}.jpg")
        pix.save(page_img_path)

        direct_text = page.get_text().strip()

        if len(direct_text) > TEXT_THRESHOLD:
            # Text page
            lines = []
            for b in page.get_text("dict")["blocks"]:
                if b["type"] == 0:
                    for l in b["lines"]:
                        text = " ".join([s["text"] for s in l["spans"]]).strip()
                        if text:
                            lines.append({"text": text, "y0": l["bbox"][1], "y1": l["bbox"][3]})
            
            pages_result.append({
                "page_num": page_idx,
                "filename": filename,
                "method": "text",
                "lines": lines,
                "image_path": page_img_path,
                "height": page.rect.height
            })
            text_page_count += 1
        else:
            # OCR page
            lines = []
            try:
                img = Image.open(io.BytesIO(pix.tobytes("png"))).convert("L")
                data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)
                
                lines_dict = {}
                for i in range(len(data['text'])):
                    text = data['text'][i].strip()
                    if text:
                        block_line = f"{data['block_num'][i]}_{data['line_num'][i]}"
                        if block_line not in lines_dict:
                            lines_dict[block_line] = {"text": [], "y0": data['top'][i], "y1": data['top'][i] + data['height'][i]}
                        lines_dict[block_line]["text"].append(text)
                        lines_dict[block_line]["y0"] = min(lines_dict[block_line]["y0"], data['top'][i])
                        lines_dict[block_line]["y1"] = max(lines_dict[block_line]["y1"], data['top'][i] + data['height'][i])

                # scale coordinates from 150dpi to PyMuPDF's 72dpi
                scale = 72 / 150
                for k, v in lines_dict.items():
                    lines.append({
                        "text": " ".join(v["text"]), 
                        "y0": v["y0"] * scale, 
                        "y1": v["y1"] * scale
                    })
            except Exception as e:
                print(f"OCR failed for {filename} page {page_idx}: {e}")
                
            pages_result.append({
                "page_num": page_idx,
                "filename": filename,
                "method": "ocr",
                "lines": lines,
                "image_path": page_img_path,
                "height": page.rect.height
            })
            ocr_page_count += 1

    doc.close()
    
    return {
        "filename": filename,
        "total_pages": text_page_count + ocr_page_count,
        "text_pages": text_page_count,
        "ocr_pages": ocr_page_count,
        "pages": pages_result
    }
