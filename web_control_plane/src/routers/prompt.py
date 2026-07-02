from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

# Điều chỉnh lại đường dẫn import tùy theo cấu trúc thư mục của bạn
from src import models
from src.database import get_db
from src.schemas import PromptVariableResponse, BasePromptUpdate, ConceptCreate

# Khởi tạo router riêng biệt cho phần Prompts
router = APIRouter(
    prefix="/api",
    tags=["Prompts & Concepts"]
)

@router.get("/prompt-variables", response_model=List[PromptVariableResponse])
def get_prompt_variables(db: Session = Depends(get_db)):
    """
    Lấy danh sách các biến Prompt (Prompt Variables) đang active.
    """
    variables = db.query(models.PromptVariable).filter(models.PromptVariable.is_active == True).all()
    return variables

@router.put("/concepts/{concept_id}/base-prompt")
def update_concept_base_prompt(
    concept_id: int, 
    req: BasePromptUpdate, 
    db: Session = Depends(get_db)
):
    """
    Cập nhật Base Prompt (Image & Video) cho một Concept cụ thể.
    """
    concept = db.query(models.Concept).filter(models.Concept.id == concept_id).first()
    
    if not concept:
        raise HTTPException(
            status_code=404, 
            detail=f"Không tìm thấy Concept với ID: {concept_id}"
        )

    concept.base_prompt_image = req.base_prompt_image
    concept.base_prompt_video = req.base_prompt_video

    db.commit()
    db.refresh(concept)
    
    return {
        "message": "Cập nhật Base Prompt thành công",
        "concept_id": concept.id
    }

@router.post("/concepts")
def create_concept(req: ConceptCreate, db: Session = Depends(get_db)):
    """
    Tạo một Concept mới từ Frontend
    """
    # Xử lý chuỗi tên tránh khoảng trắng thừa
    clean_name = req.name.strip()
    
    if not clean_name:
        raise HTTPException(status_code=400, detail="Tên Concept không được để trống!")

    # Khởi tạo record Concept mới (is_active mặc định là True trong models)
    new_concept = models.Concept(name=clean_name)
    
    db.add(new_concept)
    db.commit()
    db.refresh(new_concept)
    
    return {
        "message": "Thêm Concept thành công",
        "concept_id": new_concept.id,
        "name": new_concept.name
    }