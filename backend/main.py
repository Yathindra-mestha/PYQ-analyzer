from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import os
import shutil

from pdf_processor import extract_text_from_pdf
from analyzer import analyze_paper

app = FastAPI()

# Allow CORS for frontend interaction
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for local dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "Past Paper Analyzer API"}

@app.post("/analyze")
async def analyze_papers(files: List[UploadFile] = File(...)):
    overall_topics_count = {}
    all_questions = []

    for file in files:
        # Save file temporarily
        file_path = os.path.join(UPLOAD_DIR, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Extract text
        text = extract_text_from_pdf(file_path)
        
        # Analyze paper
        result = analyze_paper(text)
        
        # Aggregate results
        for topic, count in result["topics_count"].items():
            overall_topics_count[topic] = overall_topics_count.get(topic, 0) + count
            
        all_questions.extend(result["questions"])
        
        # Clean up
        if os.path.exists(file_path):
            os.remove(file_path)

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

