from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from typing import List

try:
    from backend.pdf_processor import extract_text_from_pdf
    from backend.analyzer import clean_ocr_text, extract_subject_info, split_into_questions, group_questions
except ImportError:
    from pdf_processor import extract_text_from_pdf
    from analyzer import clean_ocr_text, extract_subject_info, split_into_questions, group_questions

app = FastAPI(title="PYQ Analyzer API")

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
    - Direct PyMuPDF text extraction
    - OCR pipeline fallback
    Then cleans text, detects subjects, extracts questions, and fuzzy groups them.
    """
    all_pages_raw = []
    total_text_pages = 0
    total_ocr_pages = 0
    
    # We will accumulate questions mapped by subject name
    questions_by_subject = {}

    for file in files:
        content = await file.read()
        
        # 1. Extract raw text with method tagged per page
        result = extract_text_from_pdf(file_bytes=content, filename=file.filename)
        
        total_text_pages += result["text_pages"]
        total_ocr_pages += result["ocr_pages"]
        
        # We need the full text of the first page to determine the subject
        first_page_text = ""
        if result["pages"]:
            first_page_text = result["pages"][0]["text"]
            
        subject_name, course_code = extract_subject_info(first_page_text, file.filename)
        subject_key = f"{subject_name} ({course_code})"
        
        if subject_key not in questions_by_subject:
            questions_by_subject[subject_key] = []
            
        # 2. Process each page
        for page in result["pages"]:
            # Keep raw version for frontend "Raw text" tab
            all_pages_raw.append(page)
            
            # Clean text
            cleaned_text = clean_ocr_text(page["text"])
            
            # Extract questions
            extracted_qs = split_into_questions(cleaned_text)
            
            # Add metadata to each question
            for q in extracted_qs:
                q["paper"] = file.filename
                q["page"] = page["page_num"]
                questions_by_subject[subject_key].append(q)

    total_pages = total_text_pages + total_ocr_pages
    summary_text = f"{total_pages} pages: {total_text_pages} text, {total_ocr_pages} OCR"

    # 3. Fuzzy group questions per subject
    analysis_results = {}
    total_questions = 0
    
    for subj, q_list in questions_by_subject.items():
        total_questions += len(q_list)
        grouped = group_questions(q_list)
        analysis_results[subj] = grouped

    return {
        "summary": summary_text,
        "total_pages": total_pages,
        "text_pages": total_text_pages,
        "ocr_pages": total_ocr_pages,
        "paper_count": len(files),
        "total_questions_extracted": total_questions,
        "analysis": analysis_results,
        "pages": all_pages_raw
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
