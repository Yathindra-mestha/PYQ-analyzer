import json
import os
import re
from typing import List, Dict, Any

# Load syllabus topics
SYLLABUS_FILE = os.path.join(os.path.dirname(__file__), 'syllabus.json')

with open(SYLLABUS_FILE, 'r') as f:
    SYLLABUS = json.load(f)

def split_into_questions(text: str) -> List[str]:
    """
    Splits raw text into a list of individual questions.
    Uses regex to find question numbers like '1.', '2.', 'Q1', 'Q2', etc.
    """
    # Regex to match patterns like "1.", "Q1 ", "Q1. ", "1) "
    pattern = r'(?:\n|^)(?:Q\d+|\d+)[.)\s:-]+'
    
    # Split text
    parts = re.split(pattern, text)
    
    # Filter out empty or very short parts (less than 10 characters might just be noise)
    questions = [q.strip() for q in parts if len(q.strip()) > 10]
    
    return questions

def match_topics(text: str) -> List[str]:
    """
    Matches text to topics based on syllabus keywords.
    Returns a list of matched topics.
    """
    text_lower = text.lower()
    matched_topics = set()
    
    for topic, keywords in SYLLABUS.items():
        for keyword in keywords:
            if re.search(r'\b' + re.escape(keyword.lower()) + r'\b', text_lower):
                matched_topics.add(topic)
                break # Move to next topic once one keyword matches for this topic
                
    return list(matched_topics)

def analyze_paper(text: str) -> Dict[str, Any]:
    """
    Analyzes a single paper text.
    Returns a list of questions, each with its matched topics.
    """
    questions = split_into_questions(text)
    
    analyzed_questions = []
    topics_count = {}
    
    for q in questions:
        # Simplify text for display by taking first 100 characters
        display_text = q[:100] + "..." if len(q) > 100 else q
        
        topics = match_topics(q)
        analyzed_questions.append({
            "full_text": q,
            "display_text": display_text,
            "topics": topics
        })
        
        for topic in topics:
            topics_count[topic] = topics_count.get(topic, 0) + 1
            
    return {
        "questions": analyzed_questions,
        "topics_count": topics_count
    }
