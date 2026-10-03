from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import os

try:
    from backend.pdf_processor import extract_text_from_pdf
    from backend.analyzer import analyze_paper
except ImportError:
    from pdf_processor import extract_text_from_pdf
    from analyzer import analyze_paper

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
    overall_topics_count = {}
    all_questions = []

    for file in files:
        # Read file directly into memory for serverless compatibility
        content = await file.read()
        text = extract_text_from_pdf(file_bytes=content)
        
        # Analyze paper text
        result = analyze_paper(text)
        
        # Aggregate results
        for topic, count in result["topics_count"].items():
            overall_topics_count[topic] = overall_topics_count.get(topic, 0) + count
            
        all_questions.extend(result["questions"])

    # Sort topics by count descending
    sorted_topics = dict(sorted(overall_topics_count.items(), key=lambda item: item[1], reverse=True))

    return {
        "paper_count": len(files),
        "total_questions": len(all_questions),
        "topics_ranking": sorted_topics,
        "questions": all_questions
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
