import re
from rapidfuzz import fuzz

REPEATED_THRESHOLD = 3
LEAST_REPEATED_THRESHOLD = 2
SIMILARITY_THRESHOLD = 75.0

def clean_ocr_text(text: str) -> str:
    """Removes headers, footers, noise and blank lines from OCR text."""
    lines = text.split('\n')
    cleaned = []
    
    noise_patterns = [
        r"(?i).*autonomous institute.*",
        r"(?i).*accredited by.*",
        r"(?i).*page\s*\d+\s*of\s*\d+.*",
        r"(?i)^\s*or\s*$",
        r"(?i)^\s*usn\s*[:\-]?\s*.*",
        r"(?i).*college of engineering.*",
        r"(?i).*degree examination.*"
    ]
    
    for line in lines:
        line_clean = line.strip()
        if not line_clean:
            continue
        
        is_noise = False
        for p in noise_patterns:
            if re.match(p, line_clean):
                is_noise = True
                break
                
        # Remove very short lines likely to be noise (but keep valid question letters/numbers)
        if len(line_clean) < 3 and not re.match(r"^(\d+[a-z]?|[a-z])[\.\)]", line_clean.lower()):
            is_noise = True
            
        if not is_noise:
            cleaned.append(line_clean)
            
    return "\n".join(cleaned)

def extract_subject_info(text: str, filename: str) -> tuple[str, str]:
    """Extracts subject name and course code from the first few lines of text."""
    # Look for course code like 23ECPC210, 21CS42, 18MAT31
    code_match = re.search(r"([0-9]{2}[A-Z]{2,4}[0-9]{2,3})", text, re.IGNORECASE)
    course_code = code_match.group(1).upper() if code_match else "UNKNOWN_CODE"
    
    # Try to extract subject name (usually the line before or near the code)
    lines = text.split('\n')[:15]
    subject = "Unknown Subject"
    
    for line in lines:
        line = line.strip()
        # Simplistic heuristic: mostly uppercase, > 5 chars, not containing generic words
        if len(line) > 5 and line.isupper() and "EXAMINATION" not in line and "INSTITUTE" not in line and "TIME:" not in line and "MARKS:" not in line:
            subject = line
            break
            
    if subject == "Unknown Subject":
        subject = filename.replace('.pdf', '')
        
    return subject, course_code

def split_into_questions(text: str) -> list[dict]:
    """Splits text into questions based on numbering and extracts marks."""
    q_pattern = re.compile(r"^(?:Q\d+|\d+[a-z]?[\.\)]|\(\w\))\s+(.*)", re.IGNORECASE)
    marks_pattern = re.compile(r"[\(\[]\s*(\d+)\s*(?:Marks|M)?\s*[\)\]]", re.IGNORECASE)
    
    lines = text.split('\n')
    questions = []
    current_q = []
    current_marks = ""
    
    for line in lines:
        match = q_pattern.match(line)
        if match:
            if current_q:
                q_text = " ".join(current_q).strip()
                if q_text:
                    questions.append({"text": q_text, "marks": current_marks})
            
            q_content = line
            m_match = marks_pattern.search(q_content)
            if m_match:
                current_marks = m_match.group(1)
                q_content = marks_pattern.sub("", q_content).strip()
            else:
                current_marks = ""
                
            current_q = [q_content]
        else:
            if current_q:
                m_match = marks_pattern.search(line)
                if m_match:
                    current_marks = m_match.group(1)
                    line = marks_pattern.sub("", line).strip()
                current_q.append(line)
            else:
                # Text before any question starts -> we append it so it doesn't get lost
                current_q = [line]
                
    if current_q:
        q_text = " ".join(current_q).strip()
        if q_text:
            questions.append({"text": q_text, "marks": current_marks})
            
    # If a question couldn't be detected by numbers at all, fallback to the entire text
    if not questions and text.strip():
        questions.append({"text": text.strip(), "marks": ""})
            
    return questions

def group_questions(questions: list[dict]) -> dict:
    """
    Groups similar questions using rapidfuzz.
    Categorizes them into Repeated, Least repeated, Remaining based on unique paper count.
    """
    groups = []
    
    for q in questions:
        q_text = q["text"]
        found_group = False
        
        for g in groups:
            rep_text = g["representative"]["text"]
            score = fuzz.ratio(q_text.lower(), rep_text.lower())
            
            if score >= SIMILARITY_THRESHOLD:
                g["items"].append(q)
                found_group = True
                break
                
        if not found_group:
            groups.append({
                "representative": q,
                "items": [q]
            })
            
    # Format and categorize output
    result = {
        "Repeated": [],
        "Least repeated": [],
        "Remaining": []
    }
    
    for g in groups:
        items = g["items"]
        # Count unique papers (not just total occurrences)
        unique_papers = set(item["paper"] for item in items)
        count = len(unique_papers)
        
        if count >= REPEATED_THRESHOLD:
            category = "Repeated"
        elif count == LEAST_REPEATED_THRESHOLD:
            category = "Least repeated"
        else:
            category = "Remaining"
            
        # Locations string format: "Paper 1 (page 3), Paper 2 (page 7)"
        locs = {}
        for item in items:
            if item["paper"] not in locs:
                locs[item["paper"]] = []
            locs[item["paper"]].append(item["page"])
            
        locations_list = []
        for paper, pages in locs.items():
            pages_str = ", ".join(str(p) for p in sorted(list(set(pages))))
            locations_list.append(f"{paper} (page {pages_str})")
            
        marks = next((item["marks"] for item in items if item["marks"]), "")
            
        result[category].append({
            "text": g["representative"]["text"],
            "count": count,
            "marks": marks,
            "locations": ", ".join(locations_list)
        })
        
    # Sort groups by count descending
    for cat in result:
        result[cat].sort(key=lambda x: x["count"], reverse=True)
        
    return result
