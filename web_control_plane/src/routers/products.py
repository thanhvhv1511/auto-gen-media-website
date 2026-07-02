import os
import json
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy.orm import joinedload
from src import models
from src.database import get_db
from src.schemas import ProductCreate, PromptVariableResponse

router = APIRouter(
    prefix="/api",
    tags=["Products & Master Data"]
)

STORAGE_PATH = "/storage"

@router.get("/master-data")
def get_master_data(db: Session = Depends(get_db)):
    products = db.query(models.Product).all()

    concepts = db.query(models.Concept).order_by(models.Concept.id).all()
    concepts_data = [{
        "id": c.id, "name": c.name,
        "basePromptImage": c.base_prompt_image,
        "basePromptVideo": c.base_prompt_video
    } for c in concepts]

    backgrounds = db.query(models.Background).options(joinedload(models.Background.concepts)).all()
    backgrounds_data = [{
        "id": b.id, 
        "name": b.name, 
        "text": b.text,
        "weight": b.weight, 
        "allowedConcepts": [c.id for c in b.concepts]
    } for b in backgrounds]

    features = db.query(models.ProductFeature).all()
    features_data = {f.id: f.feature_name for f in features}

    # [ĐÃ UPDATE] Dùng selectinload để tối ưu query, tránh lỗi N+1
    segments = db.query(models.VideoSegment).options(selectinload(models.VideoSegment.concepts)).all()
    segments_data = [{
        "id": s.id, 
        "concept_ids": [c.id for c in s.concepts], # [ĐÃ UPDATE] Chuyển thành mảng do Many-to-Many
        "name": s.name,
        "text": s.text,
        "slots": s.allowed_slots if isinstance(s.allowed_slots, list) else (json.loads(s.allowed_slots) if isinstance(s.allowed_slots, str) and s.allowed_slots.startswith('[') else [1, 2, 3, 4]),
        "feature": s.required_feature_id,
        "is_must_have": s.is_must_have # [ĐÃ SỬA] Đổi từ mute_audio_enforced sang is_must_have
    } for s in segments]

    # [ĐÃ UPDATE] Tương tự với Pose, dùng selectinload
    poses = db.query(models.ConceptPose).options(selectinload(models.ConceptPose.concepts)).all()
    poses_data = [{
        "id": p.id, 
        "concept_ids": [c.id for c in p.concepts], # [ĐÃ UPDATE] Chuyển thành mảng do Many-to-Many
        "pose_name": p.pose_name,
        "text": p.text, "weight": p.weight
    } for p in poses]

    # ĐỊNH NGHĨA TRẠNG THÁI JOB TẠI ĐÂY (Single Source of Truth)
    job_statuses = {
        0: {"class": "pending", "text": "PENDING"},
        1: {"class": "processing", "text": "PROCESSING"},
        2: {"class": "completed", "text": "COMPLETED"},
        3: {"class": "failed", "text": "FAILED"}
    }

    return {
        "products": products,
        "concepts": concepts_data,
        "backgrounds": backgrounds_data,
        "features": features_data,
        "videoScenes": segments_data,
        "poses": poses_data,
        "jobStatuses": job_statuses  # Bắn object này xuống Frontend
    }

@router.get("/scanned-sources")
def get_scanned_video_sources(db: Session = Depends(get_db)):
    base_dir = os.path.join(STORAGE_PATH, "output_images")
    sources = []
    
    if not os.path.exists(base_dir):
        return {"sources": []}

    products = db.query(models.Product).options(joinedload(models.Product.feature)).all()
    
    product_map = {}
    for p in products:
        feature_data = None
        if p.feature:
            feature_data = {"id": p.feature.id, "feature_name": p.feature.feature_name}
        product_map[p.product_code.lower()] = {"name": p.product_name, "feature": feature_data}

    for folder_name in os.listdir(base_dir):
        folder_path = os.path.join(base_dir, folder_name)
        
        if os.path.isdir(folder_path):
            p_data = product_map.get(folder_name.lower(), {"name": "Chưa có tên SP", "feature": None})
            
            total_images = 0
            concepts = []
            
            for sub_folder in os.listdir(folder_path):
                sub_path = os.path.join(folder_path, sub_folder)
                
                if os.path.isdir(sub_path) and sub_folder.startswith("concept-"):
                    images = [f for f in os.listdir(sub_path) if f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp'))]
                    if len(images) > 0:
                        concept_id = sub_folder.split("-")[1]
                        total_images += len(images)
                        concepts.append({
                            "id": concept_id,
                            "name": f"Concept {concept_id}",
                            "image_count": len(images)
                        })
            
            if total_images > 0:
                sources.append({
                    "folder": folder_name,
                    "product_name": p_data["name"],
                    "feature": p_data["feature"],
                    "image_count": total_images,
                    "concepts": sorted(concepts, key=lambda x: int(x["id"]))
                })
                
    sources = sorted(sources, key=lambda x: x["folder"])
    return {"sources": sources}

@router.post("/products")
def create_product(req: ProductCreate, db: Session = Depends(get_db)):
    safe_product_code = req.product_code.lower().strip()
    
    existing_product = db.query(models.Product).filter(models.Product.product_code == safe_product_code).first()
    if existing_product:
        raise HTTPException(status_code=400, detail="Mã sản phẩm đã tồn tại trên hệ thống!")

    resolved_feature_id = req.feature_id

    if req.feature_name and req.feature_name.strip():
        clean_feature_name = req.feature_name.strip()
        existing_feature = db.query(models.ProductFeature).filter(
            models.ProductFeature.feature_name == clean_feature_name
        ).first()
        
        if existing_feature:
            resolved_feature_id = existing_feature.id
        else:
            new_feature = models.ProductFeature(feature_name=clean_feature_name)
            db.add(new_feature)
            db.flush() 
            resolved_feature_id = new_feature.id

    new_product = models.Product(
        product_code=safe_product_code,
        product_name=req.product_name,
        feature_id=resolved_feature_id if resolved_feature_id else None
    )
    db.add(new_product)
    db.commit()
    db.refresh(new_product)
    
    return {"message": "Thêm sản phẩm thành công", "product_id": new_product.id}

@router.get("/prompt-variables", response_model=List[PromptVariableResponse])
def get_prompt_variables(db: Session = Depends(get_db)):
    variables = db.query(models.PromptVariable).filter(models.PromptVariable.is_active == True).all()
    return variables