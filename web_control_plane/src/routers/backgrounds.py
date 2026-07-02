from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from src import models
from src.database import get_db
from src.schemas import BackgroundCreate, WeightUpdate
from sqlalchemy import asc

router = APIRouter(
    prefix="/api",
    tags=["Backgrounds"]
)

@router.get("/backgrounds")
def get_all_backgrounds(db: Session = Depends(get_db)):
    """Lấy toàn bộ danh sách background, sắp xếp theo ID tăng dần"""
    # Dùng joinedload để gọi luôn bảng concepts (tránh lỗi N+1 Query)
    backgrounds = (
        db.query(models.Background)
        .options(joinedload(models.Background.concepts))
        .order_by(models.Background.id.asc())
        .all()
    )
    
    # Ép kiểu dữ liệu trả về cho Frontend, tự động map list concept sang mảng IDs
    return [
        {
            "id": bg.id,
            "name": bg.name,
            "text": bg.text,
            "weight": bg.weight,
            "is_active": bg.is_active,
            "allowed_concepts": [c.id for c in bg.concepts] # Trả về luôn mảng [1, 2, 3]
        }
        for bg in backgrounds
    ]

@router.post("/backgrounds")
def create_background(req: BackgroundCreate, db: Session = Depends(get_db)):
    # 1. Khởi tạo Background mới
    new_bg = models.Background(
        name=req.name, 
        text=req.text, 
        weight=req.weight
    )
    
    # 2. Lấy toàn bộ concepts hiện có gán cho background mới (thay thế cho việc set ="all" như ngày xưa)
    all_concepts = db.query(models.Concept).all()
    new_bg.concepts = all_concepts
    
    db.add(new_bg)
    db.commit()
    return {"message": "Tạo Background thành công"}

@router.put("/backgrounds/{bg_id}")
def update_background(bg_id: int, req: BackgroundCreate, db: Session = Depends(get_db)):
    bg = db.query(models.Background).filter(models.Background.id == bg_id).first()
    if not bg:
        raise HTTPException(status_code=404, detail="Background không tồn tại")
    
    bg.name = req.name
    bg.text = req.text
    bg.weight = req.weight
    db.commit()
    return {"message": "Cập nhật Background thành công"}

@router.post("/backgrounds/{bg_id}/toggle-concept/{concept_id}")
def toggle_bg_concept(bg_id: int, concept_id: int, db: Session = Depends(get_db)):
    # 1. Tìm Background
    bg = db.query(models.Background).filter(models.Background.id == bg_id).first()
    if not bg: 
        raise HTTPException(status_code=404, detail="Background not found")

    # 2. Tìm Concept
    concept = db.query(models.Concept).filter(models.Concept.id == concept_id).first()
    if not concept: 
        raise HTTPException(status_code=404, detail="Concept not found")

    # 3. Bật/Tắt bằng quan hệ Many-to-Many
    if concept in bg.concepts:
        bg.concepts.remove(concept) # Nếu đang bật thì Tắt
    else:
        bg.concepts.append(concept) # Nếu đang tắt thì Bật
            
    db.commit()
    
    return {
        "message": "Toggled",
        "allowedConcepts": [c.id for c in bg.concepts]
    }

@router.put("/backgrounds/{bg_id}/weight")
def update_bg_weight(bg_id: int, req: WeightUpdate, db: Session = Depends(get_db)):
    bg = db.query(models.Background).filter(models.Background.id == bg_id).first()
    if not bg: 
        raise HTTPException(status_code=404, detail="Background not found")
        
    bg.weight = req.weight
    db.commit()
    return {"message": "Updated"}

@router.get("/concepts")
def get_all_concepts(db: Session = Depends(get_db)):
    """Lấy danh sách concepts sắp xếp theo ID tăng dần để vẽ các cột cố định"""
    return (
        db.query(models.Concept)
        .filter(models.Concept.is_active == True)
        .order_by(models.Concept.id.desc())
        .all()
    )

@router.post("/backgrounds/{bg_id}/toggle-status")
def toggle_background_status(bg_id: int, db: Session = Depends(get_db)):
    """Bật hoặc Tắt trạng thái hoạt động của bối cảnh"""
    bg = db.query(models.Background).filter(models.Background.id == bg_id).first()
    if not bg:
        raise HTTPException(status_code=404, detail="Không tìm thấy bối cảnh")
    
    # Đảo ngược trạng thái hiện tại
    bg.is_active = not bg.is_active
    db.commit()
    db.refresh(bg)
    
    return {"status": "success", "is_active": bg.is_active}