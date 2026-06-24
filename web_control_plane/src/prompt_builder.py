import random
import re
from sqlalchemy.orm import Session
from src import models

# Danh sách từ khóa gây lỗi engine media cần phải loại bỏ triệt để
FORBIDDEN_AUDIO_KEYWORDS = [r"\btalk\b", r"\btalking\b", r"\bsound\b", r"\bvoice\b", r"\baudio\b", r"\bspeak\b", r"\bspeaking\b"]

def clean_prompt_text(text: str) -> str:
    """Hàm lọc bỏ các từ khóa liên quan đến âm thanh để tránh lỗi."""
    clean_text = text
    for keyword in FORBIDDEN_AUDIO_KEYWORDS:
        clean_text = re.sub(keyword, "", clean_text, flags=re.IGNORECASE)
    # Xóa các khoảng trắng thừa do việc replace gây ra
    return " ".join(clean_text.split())

def weighted_random_choice(choices):
    """Chọn ngẫu nhiên dựa trên cột weight."""
    if not choices:
        return ""
    total = sum(c.weight for c in choices)
    r = random.uniform(0, total)
    upto = 0
    for c in choices:
        if upto + c.weight >= r:
            return c.text
        upto += c.weight
    return choices[0].text

def generate_image_prompt(db: Session, concept_id: int) -> str:
    # 1. Lấy Concept
    concept = db.query(models.Concept).filter(models.Concept.id == concept_id).first()
    if not concept:
        raise ValueError("Concept không tồn tại")

    # 2. Random Background (hiện tại random toàn bộ background active)
    bgs = db.query(models.Background).filter(models.Background.is_active == True).all()
    selected_bg = random.choice(bgs).text if bgs else ""

    # 3. Lấy Poses theo concept
    poses = db.query(models.ConceptPose).filter(models.ConceptPose.concept_id == concept_id).all()
    
    upper_bodies = [p for p in poses if p.body_part == "upperBody"]
    legs = [p for p in poses if p.body_part == "leg"]
    hands = [p for p in poses if p.body_part == "hand"]

    selected_upper = weighted_random_choice(upper_bodies)
    selected_leg = weighted_random_choice(legs)
    selected_hand = weighted_random_choice(hands)

    # 4. Lắp ráp Prompt (Giả lập việc nạp vào template)
    # Trong thực tế, bạn có thể đọc file template txt và dùng .format()
    raw_prompt = f"Bối cảnh: {selected_bg}. Dáng người: {selected_upper} {selected_leg} {selected_hand}. Đảm bảo tắt hoàn toàn âm thanh (mute video)."
    
    # 5. Làm sạch từ khóa
    final_prompt = clean_prompt_text(raw_prompt)
    
    return final_prompt