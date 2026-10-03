import re
import os
from rapidfuzz import fuzz
from PIL import Image

REPEATED_THRESHOLD = 3
LEAST_REPEATED_THRESHOLD = 2
SIMILARITY_THRESHOLD = 75.0

def clean_ocr_lines(lines: list) -> list:
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
    
    for l in lines:
        line_clean = l["text"].strip()
        if not line_clean:
            continue
            
        is_noise = False
        for p in noise_patterns:
            if re.match(p, line_clean):
                is_noise = True
                break
                
        if len(line_clean) < 3 and not re.match(r"^(\d+[a-z]?|[a-z])[\.\)]", line_clean.lower()):
            is_noise = True
            
        if not is_noise:
            cleaned.append({"text": line_clean, "y0": l["y0"], "y1": l["y1"]})
            
    return cleaned

def extract_subject_info(lines: list, filename: str) -> tuple[str, str]:
    text = "\n".join([l["text"] for l in lines[:15]])
    code_match = re.search(r"([0-9]{2}[A-Z]{2,4}[0-9]{2,3})", text, re.IGNORECASE)
    course_code = code_match.group(1).upper() if code_match else "UNKNOWN_CODE"
    
    subject = "Unknown Subject"
    for l in lines[:15]:
        line = l["text"].strip()
        if len(line) > 5 and line.isupper() and "EXAMINATION" not in line and "INSTITUTE" not in line and "TIME:" not in line and "MARKS:" not in line:
            subject = line
            break
            
    if subject == "Unknown Subject":
        subject = filename.replace('.pdf', '')
        
    return subject, course_code

def split_into_questions_and_crop(lines: list, image_path: str, page_height: float, filename: str, page_num: int) -> list[dict]:
    q_pattern = re.compile(r"^(?:Q\d+|\d+[a-z]?[\.\)]|\(\w\))\s+(.*)", re.IGNORECASE)
    marks_pattern = re.compile(r"[\(\[]\s*(\d+)\s*(?:Marks|M)?\s*[\)\]]", re.IGNORECASE)
    
    questions = []
    current_q_text = []
    current_marks = ""
    start_y = 0
    
    for idx, l in enumerate(lines):
        line = l["text"]
        match = q_pattern.match(line)
        
        if match:
            # Save previous
            if current_q_text:
                q_text = " ".join(current_q_text).strip()
                if q_text:
                    questions.append({
                        "text": q_text, 
                        "marks": current_marks,
                        "y_start": start_y,
                        "y_end": l["y0"]
                    })
            
            # Start new
            start_y = l["y0"]
            q_content = line
            m_match = marks_pattern.search(q_content)
            if m_match:
                current_marks = m_match.group(1)
                q_content = marks_pattern.sub("", q_content).strip()
            else:
                current_marks = ""
            current_q_text = [q_content]
            
        else:
            if current_q_text:
                m_match = marks_pattern.search(line)
                if m_match:
                    current_marks = m_match.group(1)
                    line = marks_pattern.sub("", line).strip()
                current_q_text.append(line)
            else:
                # Text before any question
                start_y = l["y0"]
                current_q_text = [line]
                
    if current_q_text:
        q_text = " ".join(current_q_text).strip()
        if q_text:
            questions.append({
                "text": q_text, 
                "marks": current_marks,
                "y_start": start_y,
                "y_end": page_height
            })
            
    if not questions and lines:
        questions.append({
            "text": "\n".join([l["text"] for l in lines]),
            "marks": "",
            "y_start": lines[0]["y0"],
            "y_end": page_height
        })
        
    # Now crop images
    final_qs = []
    if os.path.exists(image_path) and questions:
        try:
            img = Image.open(image_path)
            width, height = img.size
            # The coordinates in lines are based on 72dpi, image is 150dpi
            scale = 150 / 72
            
            for idx, q in enumerate(questions):
                y0 = max(0, int(q["y_start"] * scale) - 10)
                y1 = min(height, int(q["y_end"] * scale))
                
                if y1 <= y0:
                    y1 = y0 + 50
                    
                cropped = img.crop((0, y0, width, y1))
                crop_filename = f"q_{filename.replace(' ', '_')}_p{page_num}_{idx}.jpg"
                crop_path = os.path.join("static/images", crop_filename)
                cropped.save(crop_path, "JPEG", quality=70)
                
                final_qs.append({
                    "text": q["text"],
                    "marks": q["marks"],
                    "image_url": f"/images/{crop_filename}"
                })
        except Exception as e:
            print(f"Failed to crop images for {image_path}: {e}")
            for q in questions:
                final_qs.append({"text": q["text"], "marks": q["marks"], "image_url": None})
    else:
        for q in questions:
            final_qs.append({"text": q["text"], "marks": q["marks"], "image_url": None})
            
    return final_qs

def group_questions(questions: list[dict]) -> dict:
    groups = []
    for q in questions:
        q_text = q["text"]
        found = False
        for g in groups:
            rep_text = g["representative"]["text"]
            score = fuzz.ratio(q_text.lower(), rep_text.lower())
            if score >= SIMILARITY_THRESHOLD:
                g["items"].append(q)
                found = True
                break
        if not found:
            groups.append({"representative": q, "items": [q]})
            
    result = {"Repeated": [], "Least repeated": [], "Remaining": []}
    
    for g in groups:
        items = g["items"]
        unique_papers = set(item["paper"] for item in items)
        count = len(unique_papers)
        
        if count >= REPEATED_THRESHOLD:
            category = "Repeated"
        elif count == LEAST_REPEATED_THRESHOLD:
            category = "Least repeated"
        else:
            category = "Remaining"
            
        locs = {}
        for item in items:
            if item["paper"] not in locs:
                locs[item["paper"]] = []
            locs[item["paper"]].append(item["page"])
            
        loc_list = []
        for p, pgs in locs.items():
            loc_list.append(f"{p} (page {', '.join(str(x) for x in sorted(set(pgs)))})")
            
        marks = next((item["marks"] for item in items if item["marks"]), "")
        image_url = next((item["image_url"] for item in items if item["image_url"]), None)
            
        result[category].append({
            "text": g["representative"]["text"],
            "count": count,
            "marks": marks,
            "locations": ", ".join(loc_list),
            "image_url": image_url
        })
        
    for cat in result:
        result[cat].sort(key=lambda x: x["count"], reverse=True)
        
    return result
