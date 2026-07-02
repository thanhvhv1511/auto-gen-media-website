from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from src import models
from src.database import get_db
from src.schemas import WeightUpdate, PoseCreate 

router = APIRouter(prefix="/api", tags=["Poses"])

@router.get("/poses")
def get_all_poses(db: Session = Depends(get_db)):
    """Lấy toàn bộ danh sách tư thế, kèm theo concept_ids để frontend hiển thị checkbox"""
    poses = (
        db.query(models.ConceptPose)
        .options(joinedload(models.ConceptPose.concepts))
        .order_by(models.ConceptPose.id.asc())
        .all()
    )
    
    result = []
    for pose in poses:
        result.append({
            "id": pose.id,
            "pose_name": pose.pose_name,
            "prompt_label": pose.prompt_label, # BỔ SUNG: Trả về khóa ngoại
            "text": pose.text,
            "weight": pose.weight,
            "is_active": pose.is_active,
            # Trả về mảng ID để JS dễ check (ví dụ: [1, 2, 3])
            "concept_ids": [concept.id for concept in pose.concepts]
        })
    return result

@router.post("/poses")
def create_pose(req: PoseCreate, db: Session = Depends(get_db)):
    new_pose = models.ConceptPose(
        pose_name=req.pose_name,
        prompt_label=req.prompt_label, # Lưu khóa ngoại
        text=req.text, 
        weight=req.weight
    )
    db.add(new_pose)
    db.commit()
    return {"message": "Tạo Tư thế ảnh thành công"}

@router.put("/poses/{pose_id}")
def update_pose(pose_id: int, req: PoseCreate, db: Session = Depends(get_db)):
    pose = db.query(models.ConceptPose).filter(models.ConceptPose.id == pose_id).first()
    if not pose:
        raise HTTPException(status_code=404, detail="Tư thế không tồn tại")
    
    pose.pose_name = req.pose_name 
    pose.prompt_label = req.prompt_label # BỔ SUNG: Cho phép update label
    pose.text = req.text
    pose.weight = req.weight
    
    db.commit()
    return {"message": "Cập nhật Tư thế ảnh thành công"}

@router.post("/poses/{pose_id}/toggle-concept/{concept_id}")
def toggle_pose_concept(pose_id: int, concept_id: int, db: Session = Depends(get_db)):
    """Bật/tắt liên kết giữa tư thế và concept qua bảng trung gian Many-to-Many"""
    pose = db.query(models.ConceptPose).filter(models.ConceptPose.id == pose_id).first()
    if not pose: 
        raise HTTPException(status_code=404, detail="Tư thế không tồn tại")
        
    concept = db.query(models.Concept).filter(models.Concept.id == concept_id).first()
    if not concept:
        raise HTTPException(status_code=404, detail="Concept không tồn tại")

    # Tận dụng sức mạnh của relationship trong SQLAlchemy
    if concept in pose.concepts:
        pose.concepts.remove(concept) # Nếu đã liên kết thì gỡ ra
    else:
        pose.concepts.append(concept) # Nếu chưa liên kết thì thêm vào
            
    db.commit()
    return {"message": "Cập nhật Concept thành công"}

@router.put("/poses/{pose_id}/weight")
def update_pose_weight(pose_id: int, req: WeightUpdate, db: Session = Depends(get_db)):
    """Cập nhật trọng số nhanh cho tư thế"""
    pose = db.query(models.ConceptPose).filter(models.ConceptPose.id == pose_id).first()
    if not pose: 
        raise HTTPException(status_code=404, detail="Tư thế không tồn tại")
    
    pose.weight = req.weight
    db.commit()
    return {"message": "Cập nhật trọng số thành công"}

@router.post("/poses/{pose_id}/toggle-status")
def toggle_pose_status(pose_id: int, db: Session = Depends(get_db)):
    """Bật hoặc Tắt trạng thái hoạt động của tư thế"""
    pose = db.query(models.ConceptPose).filter(models.ConceptPose.id == pose_id).first()
    if not pose:
        raise HTTPException(status_code=404, detail="Tư thế không tồn tại")
    
    pose.is_active = not pose.is_active
    db.commit()
    db.refresh(pose)
    
    return {"status": "success", "is_active": pose.is_active}

@router.get("/prompt-variables")
def get_prompt_variables(db: Session = Depends(get_db)):
    """Lấy danh sách các biến Prompt đang active để hiển thị vào Dropdown modal"""
    return (
        db.query(models.PromptVariable)
        .filter(models.PromptVariable.is_active == True)
        .order_by(models.PromptVariable.id.asc())
        .all()
    )