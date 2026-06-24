from fastapi import FastAPI, Depends, UploadFile, File, Form, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
import os
import shutil
import json
import unicodedata
import re
from datetime import datetime
from pydantic import BaseModel
from . import models, database
from .prompt_builder import generate_image_prompt
from typing import Optional
from src.database import get_db

class QAReviewRequest(BaseModel):
    approved_indexes: list[int]

class BasePromptUpdate(BaseModel):
    base_prompt_image: str
    base_prompt_video: str

class BackgroundCreate(BaseModel):
    name: str
    text: str
    weight: int = 10

class VideoSegmentUpdate(BaseModel):
    name: str
    text: str
    required_feature: Optional[str] = ""
    allowed_slots: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class ConceptCreate(BaseModel):
    name: str

class WeightUpdate(BaseModel):
    weight: int

class PoseUpdate(BaseModel):
    text: str
    weight: int


models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="Autoscript Media Control Plane", version="1.0.0")

# ==========================================
# CẤU HÌNH MOUNT STATIC, MEDIA & TEMPLATES
# ==========================================
os.makedirs("/storage/output_images", exist_ok=True)
os.makedirs("/storage/output_videos", exist_ok=True)
app.mount("/media", StaticFiles(directory="/storage"), name="media")

static_dir = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(os.path.join(static_dir, "css"), exist_ok=True)
os.makedirs(os.path.join(static_dir, "js"), exist_ok=True)
app.mount("/static", StaticFiles(directory=static_dir), name="static")

templates_dir = os.path.join(os.path.dirname(__file__), "templates")
templates = Jinja2Templates(directory=templates_dir)
# ==========================================

DATABASE_URL = os.getenv("DATABASE_URL")
STORAGE_PATH = "/storage"

@app.get("/")
def read_root():
    return {"status": "online", "message": "Autoscript API is running", "database_connected": DATABASE_URL is not None}

@app.get("/health")
def health_check():
    input_dir = os.path.join(STORAGE_PATH, "input_images")
    return {"storage_mounted": os.path.exists(input_dir)}

# ==========================================
# API: MASTER DATA CHO GIAO DIỆN QUẢN TRỊ
# ==========================================
@app.get("/api/master-data")
def get_master_data(db: Session = Depends(database.get_db)):
    """API Gom toàn bộ Master Data từ PostgreSQL để nạp vào Frontend State Manager"""
    products = db.query(models.Product).all()

    # 1. Lấy Concepts
    # 1. Lấy Concepts
    concepts = db.query(models.Concept).all()
    concepts_data = [{
        "id": c.id,
        "name": c.name,
        "basePromptImage": c.base_prompt_image, # Gọi đúng cột mới
        "basePromptVideo": c.base_prompt_video  # Gọi đúng cột mới
    } for c in concepts]

    # 2. Lấy Backgrounds
    backgrounds = db.query(models.Background).all()
    backgrounds_data = [{
        "id": b.id,
        "name": b.name,
        "text": b.text,
        "weight": b.weight,
        "allowedConcepts": b.allowed_concepts
    } for b in backgrounds]

    features = db.query(models.ProductFeature).all()
    features_data = {f.id: f.feature_name for f in features}

    # 4. Lấy Video Segments (Dùng s.id trực tiếp, map đúng cột required_feature_id)
    segments = db.query(models.VideoSegment).all()
    segments_data = [{
        "id": s.id,
        "concept_id": s.concept_id,
        "name": s.name,
        "text": s.text,
        "slots": json.loads(s.allowed_slots) if s.allowed_slots and s.allowed_slots.startswith('[') else [1,2,3,4],
        "feature": s.required_feature_id     # Đổi từ s.required_feature sang s.required_feature_id
    } for s in segments]

    # 5. Lấy Poses (Tư thế)
    poses = db.query(models.ConceptPose).all()
    poses_data = [{
        "id": p.id,
        "concept_id": p.concept_id,
        "body_part": p.body_part,
        "text": p.text,
        "weight": p.weight
    } for p in poses]

    return {
        "products": products,
        "concepts": concepts_data,
        "backgrounds": backgrounds_data,
        "features": features_data,
        "videoScenes": segments_data,
        "poses": poses_data
    }

# ==========================================
# API: VẬN HÀNH JOB (ẢNH & VIDEO)
# ==========================================
import os
import shutil
from fastapi import APIRouter, Depends, Form, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
# ... import models, database, generate_image_prompt của ông ...

@app.post("/jobs/image")
async def create_image_job(
    product_id: int = Form(...),     # 1. ĐỔI: Nhận ID số nguyên từ JS gửi lên
    concept_id: int = Form(...),   
    file: UploadFile = File(...),  
    db: Session = Depends(database.get_db)
):
    try:
        # 2. BỐC MÃ CHỮ (product_code) TỪ DB ĐỂ PHỤC VỤ ĐẶT TÊN FILE VẬT LÝ
        product = db.query(models.Product).filter(models.Product.id == product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail="Sản phẩm không tồn tại trên hệ thống!")

        product_code = product.product_code

        # 3. XỬ LÝ LƯU FILE ẢNH VÀO STORAGE
        input_dir = os.path.join(STORAGE_PATH, "input_images")
        os.makedirs(input_dir, exist_ok=True)
        file_ext = file.filename.split(".")[-1]
        
        # Đặt tên file kết hợp job_id tương lai hoặc timestamp để tránh đè ảnh gốc đầu vào
        safe_filename = f"{product_code}_{int(os.getpid())}.{file_ext}"
        file_path = os.path.join(input_dir, safe_filename)

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # 4. TẠO BẢN GHI MEDIA ASSET (Đã sửa sang product_id chuẩn khóa ngoại mới)
        new_media = models.MediaAsset(
            product_id=product_id, 
            media_type="image_input", 
            file_path=file_path
        )
        db.add(new_media)
        db.flush() # Lấy tạm ID của media mà chưa commit hẳn
        
        # 5. SINH PROMPT TỪ CONCEPT ID
        try:
            final_prompt = generate_image_prompt(db, concept_id)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Lỗi gen prompt: {str(e)}")

        # 6. TẠO GENERATION JOB MỚI (Đổi sang product_id chuẩn chỉ)
        new_job = models.GenerationJob(
            product_id=product_id,    # Khóa ngoại số nguyên chuẩn đét
            job_type="image",
            concept_id=concept_id,
            status="pending",        # Để 'pending' cho con worker_image của ông nhảy vào bốc job nhé!
            prompt_text=final_prompt
        )
        db.add(new_job)
        db.flush() # Lấy ID của job vừa tạo

        # Link ngược lại job_id cho asset đầu vào
        new_media.job_id = new_job.id
        
        # Commit toàn bộ transaction an toàn chống rác DB
        db.commit()
        db.refresh(new_job)

        return {
            "message": "Đã đẩy lệnh sinh ảnh vào hàng đợi thành công!", 
            "job_id": new_job.id, 
            "status": new_job.status
        }

    except HTTPException as http_err:
        db.rollback()
        raise http_err
    except Exception as e:
        db.rollback()
        # Bọc thép trả về lỗi 500 kèm detail rõ ràng để JS không bị treo Luồng "Đang đẩy..."
        raise HTTPException(status_code=500, detail=f"Lỗi Server: {str(e)}")

@app.get("/jobs")
def get_list_jobs(db: Session = Depends(database.get_db)):
    # Lấy 20 jobs mới nhất, load kèm thông tin product để tránh lỗi N+1
    jobs = db.query(models.GenerationJob).order_by(models.GenerationJob.id.desc()).limit(20).all()
    
    # Serialize để frontend dễ đọc
    return [
        {
            "id": job.id,
            "product_code": job.product.product_code if job.product else "N/A",
            "job_type": job.job_type,
            "status": job.status,
            "updated_at": job.updated_at.isoformat() if job.updated_at else None
        } for job in jobs
    ]

# ==========================================
# CÁC ROUTE SUBPATH TRẢ VỀ GIAO DIỆN UI (JINJA2)
# ==========================================
@app.get("/ui", response_class=HTMLResponse)
def redirect_default_ui(request: Request):
    return templates.TemplateResponse("image.html", {"request": request})

@app.get("/ui/image", response_class=HTMLResponse)
def get_image_ui(request: Request):
    return templates.TemplateResponse("image.html", {"request": request})

@app.get("/ui/video", response_class=HTMLResponse)
def get_video_ui(request: Request):
    return templates.TemplateResponse("video.html", {"request": request})

@app.get("/ui/admin", response_class=HTMLResponse)
def get_admin_ui(request: Request):
    return templates.TemplateResponse("admin.html", {"request": request})

@app.post("/jobs/video/{image_job_id}")
def create_video_job(image_job_id: int, req: QAReviewRequest, db: Session = Depends(database.get_db)):
    image_job = db.query(models.GenerationJob).filter(
        models.GenerationJob.id == image_job_id, 
        models.GenerationJob.job_type == "image"
    ).first()
    
    if not image_job:
        raise HTTPException(status_code=404, detail="Không tìm thấy Job ảnh gốc")
    if not req.approved_indexes:
        raise HTTPException(status_code=400, detail="Phải có ít nhất 1 ảnh được duyệt!")

    # Dọn rác
    for i in range(1, 5):
        if i not in req.approved_indexes:
            file_to_delete = os.path.join(STORAGE_PATH, f"output_images/{image_job.product_code}_{image_job.id}_0{i}.jpg")
            if os.path.exists(file_to_delete):
                os.remove(file_to_delete)

    # Sinh Prompt
    segments = db.query(models.VideoSegment).filter(models.VideoSegment.concept_id == image_job.concept_id).all()
    video_timeline_text = " ".join([seg.text for seg in segments])
    
    approved_str = ",".join(map(str, req.approved_indexes))
    final_video_prompt = f"[REF_JOB:{image_job.id}][IDX:{approved_str}] Tạo video thời trang 10s. {video_timeline_text}. Đảm bảo mute video, không có âm thanh."

    new_job = models.GenerationJob(
        product_code=image_job.product_code,
        job_type="video",
        concept_id=image_job.concept_id,
        status="pending",
        prompt_text=final_video_prompt
    )
    db.add(new_job)
    db.commit()
    
    return {"message": "Đã dọn dẹp ảnh lỗi và tạo luồng Video", "job_id": new_job.id}

# ==========================================
# API: MUTATION CHO ADMIN PANEL (CẬP NHẬT DB)
# ==========================================
@app.post("/api/concepts")
def create_concept(req: ConceptCreate, db: Session = Depends(database.get_db)):
    new_concept = models.Concept(
        name=req.name,
        # Thay thế hoàn toàn base_prompt cũ bằng 2 dòng này:
        base_prompt_image=f"Ảnh thời trang dọc 9:16, chất lượng 4k. Bối cảnh: {req.name}.",
        base_prompt_video=f"Video thời trang dọc 9:16, chất lượng cinematic 4k. Bối cảnh: {req.name}. Đảm bảo mute video, không có âm thanh."
    )
    db.add(new_concept)
    db.commit()
    return {"message": "Khởi tạo Concept mới thành công"}

@app.post("/api/backgrounds")
def create_background(req: BackgroundCreate, db: Session = Depends(database.get_db)):
    new_bg = models.Background(
        name=req.name,
        text=req.text,
        weight=req.weight,
        allowed_concepts="all"
    )
    db.add(new_bg)
    db.commit()
    return {"message": "Tạo Background thành công"}

# API cập nhật sửa Background (Dùng lại schema BackgroundCreate)
@app.put("/api/backgrounds/{bg_id}")
def update_background(bg_id: int, req: BackgroundCreate, db: Session = Depends(database.get_db)):
    bg = db.query(models.Background).filter(models.Background.id == bg_id).first()
    if not bg:
        raise HTTPException(status_code=404, detail="Background không tồn tại")
    
    # Đồng bộ cập nhật cả 3 trường
    bg.name = req.name
    bg.text = req.text
    bg.weight = req.weight
    
    db.commit()
    return {"message": "Cập nhật Background thành công"}

@app.put("/api/concepts/{concept_id}/base-prompt")
def update_base_prompt(concept_id: int, req: BasePromptUpdate, db: Session = Depends(database.get_db)):
    concept = db.query(models.Concept).filter(models.Concept.id == concept_id).first()
    
    # Báo 404 nếu không tìm thấy Concept trong DB
    if not concept:
        raise HTTPException(status_code=404, detail="Concept không tồn tại")
    
    # Cập nhật 2 trường mới
    concept.base_prompt_image = req.base_prompt_image
    concept.base_prompt_video = req.base_prompt_video
    db.commit()
    
    return {"message": "Đã lưu Base Prompts thành công"}

@app.post("/api/backgrounds/{bg_id}/toggle-concept/{concept_id}")
def toggle_bg_concept(bg_id: int, concept_id: int, db: Session = Depends(database.get_db)):
    bg = db.query(models.Background).filter(models.Background.id == bg_id).first()
    if not bg: return {"error": "Not found"}

    if bg.allowed_concepts == "all":
        all_concept_ids = [c.id for c in db.query(models.Concept).all()]
        allowed_list = [cid for cid in all_concept_ids if cid != concept_id]
        bg.allowed_concepts = json.dumps(allowed_list)
    else:
        try:
            allowed_list = json.loads(bg.allowed_concepts)
            if concept_id in allowed_list:
                allowed_list.remove(concept_id)
            else:
                allowed_list.append(concept_id)
            bg.allowed_concepts = json.dumps(allowed_list)
        except:
            bg.allowed_concepts = "all"
            
    db.commit()
    return {"message": "Toggled"}

@app.put("/api/backgrounds/{bg_id}/weight")
def update_bg_weight(bg_id: int, req: WeightUpdate, db: Session = Depends(database.get_db)):
    bg = db.query(models.Background).filter(models.Background.id == bg_id).first()
    if bg:
        bg.weight = req.weight
        db.commit()
    return {"message": "Updated"}

@app.put("/api/poses/{pose_id}")
def update_pose(pose_id: int, req: PoseUpdate, db: Session = Depends(database.get_db)):
    pose = db.query(models.ConceptPose).filter(models.ConceptPose.id == pose_id).first()
    if pose:
        pose.text = req.text
        pose.weight = req.weight
        db.commit()
    return {"message": "Updated"}

@app.put("/api/video-segments/{segment_id}")
# 1. Sửa kiểu dữ liệu từ 'int' thành 'str' để nhận chuỗi 'scene_vuot_toc'
def update_video_segment(segment_id: int, req: VideoSegmentUpdate, db: Session = Depends(database.get_db)):
    
    # 1. Đoạn sửa lại cho chuẩn Schema mới (Sử dụng trực tiếp id dạng Số)
    segment = db.query(models.VideoSegment).filter(models.VideoSegment.id == segment_id).first()
    
    if not segment:
        raise HTTPException(status_code=404, detail="Không tìm thấy phân cảnh")

    # 3. Đồng bộ cập nhật các trường từ request schema vào DB
    segment.name = req.name
    segment.text = req.text
    segment.required_feature = req.required_feature
    segment.allowed_slots = req.allowed_slots
    
    db.commit()
    return {"message": "Cập nhật phân cảnh thành công"}

@app.get("/api/video-segments")
def get_video_segments(
    concept_id: int, 
    sort_by: str = "updated_at",  # Mặc định sort theo updated_at
    order: str = "desc",          # Mặc định mới nhất lên đầu
    db: Session = Depends(get_db)
):
    query = db.query(VideoSegment).filter(VideoSegment.concept_id == concept_id)
    sort_column = getattr(VideoSegment, sort_by, VideoSegment.updated_at)
    
    # 3. Áp dụng ORDER BY ASC hoặc DESC trong SQL
    if order == "desc":
        query = query.order_by(sort_column.desc())
    else:
        query = query.order_by(sort_column.asc())
        
    return query.all()

@app.delete("/api/video-segments/{segment_id}")
def delete_video_segment(segment_id: int, db: Session = Depends(get_db)):
    # Query theo ID số chuẩn schema mới
    segment = db.query(models.VideoSegment).filter(models.VideoSegment.id == segment_id).first()
    
    if not segment:
        raise HTTPException(status_code=404, detail="Không tìm thấy phân cảnh để xóa")
        
    db.delete(segment)
    db.commit()
    return {"status": "success", "message": f"Đã xóa phân cảnh {segment_id}"}

@app.delete("/api/poses/{pose_id}")
def delete_pose(pose_id: int, db: Session = Depends(get_db)):
    pose = db.query(models.ConceptPose).filter(models.ConceptPose.id == pose_id).first()
    if not pose:
        raise HTTPException(status_code=404, detail="Không tìm thấy tư thế")
    db.delete(pose)
    db.commit()
    return {"status": "success"}

@app.post("/api/poses")
def create_pose(payload: dict, db: Session = Depends(get_db)):
    db_pose = models.ConceptPose(
        concept_id=payload["concept_id"],
        body_part=payload["body_part"],
        text=payload["text"],
        weight=payload["weight"]
    )
    db.add(db_pose)
    db.commit()
    return {"status": "success"}

