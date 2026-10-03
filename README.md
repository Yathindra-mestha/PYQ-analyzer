# PYQ Analyzer (Past Paper Analyzer) 📊

A lightweight, automated web application that extracts questions from previous years' question paper PDFs (PYQs), matches them to syllabus topics, analyzes recurring frequency patterns, and presents an interactive study dashboard.

---

## 🚀 Features

- **Batch PDF Ingestion**: Drag and drop multiple past semester exam papers simultaneously.
- **Intelligent Question Extraction**: Extracts text with PyMuPDF and parses individual questions using pattern recognition.
- **Topic Matching**: Automatically classifies each question into syllabus units based on keyword matching.
- **Recurring Weightage Visuals**:
  - **Bar Chart**: Visualizes topic frequency across all uploaded papers.
  - **Doughnut Chart**: Shows percentage distribution of exam topics.
- **Question Bank Explorer**:
  - Live search across question text.
  - Filter questions by topic pills.
  - 1-click **Copy Question** button to quickly export questions into your personal notes (Notion, Obsidian, Markdown).
- **Cloud / Vercel Ready**: Includes a built-in API configuration modal to easily connect a Vercel-hosted frontend to a deployed FastAPI backend.

---

## 🛠️ Tech Stack

- **Backend**: Python, [FastAPI](https://fastapi.tiangolo.com/), [PyMuPDF](https://pymupdf.readthedocs.io/) (`fitz`), Uvicorn
- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3, [Chart.js](https://www.chartjs.org/)
- **Data Persistence**: In-memory / stateless processing (no database required for MVP)

---

## 📁 Repository Structure

```text
PYQ-analyzer/
├── backend/
│   ├── main.py              # FastAPI endpoints (upload, parse, health)
│   ├── pdf_processor.py     # PyMuPDF text extraction logic
│   ├── analyzer.py          # Regex question splitter & topic matcher
│   └── syllabus.json        # Syllabus keyword dictionary
├── frontend/
│   ├── index.html           # Main dashboard UI
│   ├── style.css            # Dark/modern responsive styling
│   └── script.js            # Frontend logic, API caller & Chart.js renderer
├── uploads/                 # Temporary directory for processing uploads
├── SPEC.md                  # Project specification & MVP roadmap
├── requirements.txt         # Python dependencies
└── README.md                # Project documentation
```

---

## ⚡ Quickstart (Running Locally)

### 1. Prerequisites
- Python 3.10+ installed

### 2. Set Up the Virtual Environment

```bash
# Clone the repository
git clone https://github.com/Yathindra-mestha/PYQ-analyzer.git
cd PYQ-analyzer

# Create and activate virtual environment
python -m venv venv

# Windows (PowerShell):
.\venv\Scripts\activate

# macOS / Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Start the Backend API

```bash
cd backend
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```
The FastAPI documentation will be available at `http://127.0.0.1:8000/docs`.

### 4. Start the Frontend

In a separate terminal:
```bash
cd frontend
python -m http.server 8080
```
Open **[http://localhost:8080](http://localhost:8080)** in your browser!

---

## 🌐 Deploying to Production (Vercel + Cloud)

1. **Frontend on Vercel**:
   - Push this repo to GitHub.
   - Import the repo into Vercel and set the Root Directory to `frontend`.
2. **Backend on Render / Railway**:
   - Deploy the `backend` folder as a Python web service (Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`).
3. **Connect Frontend to Backend**:
   - In the live website, click **⚙️ API Config** in the top navigation bar and paste your live backend URL (e.g. `https://your-backend.onrender.com`).
