# Past Paper Analyzer - SPEC

## 1. Goal
A website where users can upload past question paper PDFs. The system extracts questions, groups them by topic, shows which topics repeat most across years, and lists likely important questions.

## 2. MVP Features
- **Upload:** Ability to upload multiple PDF files at once.
- **Extraction:** Extract text from PDFs and intelligently split it into individual questions.
- **Topic Matching:** Match each extracted question to a topic using a predefined syllabus keyword list.
- **Frequency Analysis:** Count the frequency of each topic per year/paper.
- **Dashboard:** A web interface displaying:
  - A bar chart of top repeating topics.
  - A table of frequently repeated questions.

## 3. Tech Stack
- **Backend:** Python with FastAPI.
- **PDF Processing:** PyMuPDF (`fitz`) for robust text reading and extraction.
- **Frontend:** HTML, CSS, and vanilla JavaScript.
- **Charts:** Chart.js for data visualization.
- **Database:** None (in-memory or file-based processing for the MVP).

## 4. Folder Structure
```text
past-paper-analyzer/
├── backend/
│   ├── main.py              # FastAPI application entry point & API routes
│   ├── pdf_processor.py     # Logic for reading PDFs and extracting raw text
│   ├── analyzer.py          # Logic for splitting questions and matching topics
│   ├── syllabus.json        # Configuration file mapping topics to keywords
│   └── requirements.txt     # Python dependencies
├── frontend/
│   ├── index.html           # Main dashboard UI
│   ├── style.css            # Application styling
│   └── script.js            # API interaction and Chart.js rendering
└── uploads/                 # Temporary storage directory for uploaded PDFs (ignored in git)
```

## 5. Build Steps
1. **Setup & Environment:** Initialize the project structure, set up a Python virtual environment, and install necessary dependencies (`fastapi`, `uvicorn`, `pymupdf`, `python-multipart`).
2. **PDF Extraction (Backend):** Implement `pdf_processor.py` to read an uploaded PDF and extract its text content. Test with a sample paper.
3. **Analysis Engine (Backend):** Implement `analyzer.py` to identify individual questions from the text block, match them to topics defined in `syllabus.json`, and aggregate frequency data.
4. **API Endpoints (Backend):** Develop endpoints in `main.py` to accept file uploads, trigger the processing pipeline, and return a JSON payload with the analysis results.
5. **Frontend UI Skeleton:** Build the basic `index.html` structure with a file upload form and empty containers for the chart and results table.
6. **Frontend Integration:** Write JavaScript in `script.js` to submit the uploaded files to the backend and handle the returned JSON data.
7. **Data Visualization:** Integrate Chart.js to render a bar chart of top topics, and dynamically generate an HTML table to display the most repeated questions.

## 6. Definition of "Done"
The project is complete when I can successfully upload 3 or more sample past paper PDFs via the web dashboard and immediately see a rendered bar chart of ranked topics along with a list of repeated questions.
