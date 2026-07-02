from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import json
from src import models
from src.database import get_db
# Đã import thêm VideoSegmentCreate, VideoSegmentUpdate và WeightUpdate
from src.schemas import VideoSegmentCreate, VideoSegmentUpdate, WeightUpdate 

router = APIRouter(
    prefix="/api/video-segments",
    tags=["Video Segments"]
)

@router.get("")
def get_video_segments(
    sort_by: str = "id",
    order: str = "asc",
    db: Session = Depends(get_db)
):
    query = db.query(models.VideoSegment)

    allowed_sort_columns = ["id", "name", "created_at", "updated_at"]
    if sort_by not in allowed_sort_columns:
        sort_by = "id"
    
    sort_column = getattr(models.VideoSegment, sort_by, models.VideoSegment.id) 
    
    if order == "desc":
        query = query.order_by(sort_column.desc())
    else:
        query = query.order_by(sort_column.asc())
        
    segments = query.all()

    result = []
    for seg in segments:
        result.append({
            "id": seg.id,
            "name": seg.name,
            "text": seg.text,
            "weight": seg.weight, # [BỔ SUNG] Trả về weight để Frontend render
            "required_feature_id": seg.required_feature_id,
            "allowed_slots": seg.allowed_slots,
            "is_must_have": seg.is_must_have,
            "concept_ids": [concept.id for concept in seg.concepts] 
        })
        
    return result

@router.post("")
def create_video_segment(req: VideoSegmentCreate, db: Session = Depends(get_db)):
    new_seg = models.VideoSegment(
        name=req.name, 
        text=req.text,
        weight=getattr(req, 'weight', 10), # [BỔ SUNG] Lấy weight từ req (mặc định 10 nếu không có)
        required_feature_id=req.required_feature_id,
        is_must_have=req.is_must_have,
        allowed_slots=req.allowed_slots
    )
    db.add(new_seg)
    db.commit()
    return {"message": "Tạo Phân cảnh Video thành công"}

@router.put("/{segment_id}")
def update_video_segment(segment_id: int, req: VideoSegmentUpdate, db: Session = Depends(get_db)):
    segment = db.query(models.VideoSegment).filter(models.VideoSegment.id == segment_id).first()
    if not segment:
        raise HTTPException(status_code=404, detail="Không tìm thấy phân cảnh")

    segment.name = req.name
    segment.text = req.text
    # [BỔ SUNG] Cập nhật weight từ form edit
    if hasattr(req, 'weight'):
        segment.weight = req.weight 
        
    segment.required_feature_id = req.required_feature_id 
    segment.mute_audio_enforced = getattr(req, 'mute_audio_enforced', True)
    segment.allowed_slots = req.allowed_slots
    segment.is_must_have = req.is_must_have 
    
    db.commit()
    return {"message": "Cập nhật phân cảnh thành công"}

# ==========================================
# [BỔ SUNG MỚI] Hàm cập nhật nhanh Trọng số (Tránh lỗi 404)
# ==========================================
@router.put("/{segment_id}/weight")
def update_video_segment_weight(segment_id: int, req: WeightUpdate, db: Session = Depends(get_db)):
    segment = db.query(models.VideoSegment).filter(models.VideoSegment.id == segment_id).first()
    if not segment:
        raise HTTPException(status_code=404, detail="Không tìm thấy phân cảnh")
    
    segment.weight = req.weight
    db.commit()
    return {"message": "Cập nhật trọng số thành công"}

@router.post("/{seg_id}/toggle-concept/{concept_id}")
def toggle_video_segment_concept(seg_id: int, concept_id: int, db: Session = Depends(get_db)):
    seg = db.query(models.VideoSegment).filter(models.VideoSegment.id == seg_id).first()
    concept = db.query(models.Concept).filter(models.Concept.id == concept_id).first()
    
    if not seg or not concept: 
        raise HTTPException(status_code=404, detail="Không tìm thấy dữ liệu")

    if concept in seg.concepts:
        seg.concepts.remove(concept)
    else:
        seg.concepts.append(concept)
        
    db.commit()
    return {"message": "Cập nhật Concept thành công"}

@router.delete("/{segment_id}")
def delete_video_segment(segment_id: int, db: Session = Depends(get_db)):
    segment = db.query(models.VideoSegment).filter(models.VideoSegment.id == segment_id).first()
    if not segment:
        raise HTTPException(status_code=404, detail="Không tìm thấy phân cảnh để xóa")
    
    db.delete(segment)
    db.commit()
    return {"status": "success", "message": f"Đã xóa phân cảnh {segment_id}"}

@router.post("/{segment_id}/toggle-must-have")
def toggle_video_segment_must_have(segment_id: int, db: Session = Depends(get_db)):
    segment = db.query(models.VideoSegment).filter(models.VideoSegment.id == segment_id).first()
    if not segment:
        raise HTTPException(status_code=404, detail="Không tìm thấy phân cảnh")
    
    # Đảo ngược trạng thái hiện tại
    segment.is_must_have = not segment.is_must_have
    db.commit()
    db.refresh(segment)
    
    return {"status": "success", "is_must_have": segment.is_must_have}

@router.post("/{segment_id}/toggle-slot/{slot_id}")
def toggle_video_segment_slot(segment_id: int, slot_id: int, db: Session = Depends(get_db)):
    segment = db.query(models.VideoSegment).filter(models.VideoSegment.id == segment_id).first()
    if not segment:
        raise HTTPException(status_code=404, detail="Không tìm thấy phân cảnh")

    # Parse chuỗi JSON thành mảng
    try:
        slots = json.loads(segment.allowed_slots) if segment.allowed_slots else []
        if not isinstance(slots, list):
            slots = []
    except Exception:
        slots = []

    # Thêm hoặc xóa slot khỏi mảng
    if slot_id in slots:
        slots.remove(slot_id)
    else:
        slots.append(slot_id)

    # Lưu lại dưới dạng chuỗi JSON
    segment.allowed_slots = json.dumps(slots)
    db.commit()
    db.refresh(segment)

    return {"status": "success", "allowed_slots": segment.allowed_slots}