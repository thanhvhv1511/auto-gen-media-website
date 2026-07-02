import os
import shutil
import time
from fastapi import APIRouter, Depends, Form, UploadFile, File, HTTPException
from sqlalchemy.orm import Session

# Import custom modules
from src import models
from src.database import get_db
from src.schemas import QAReviewRequest

router = APIRouter(
    prefix="/jobs",
    tags=["Jobs Operations"]
)

STORAGE_PATH = "/storage"

STATUS_MAP = {
    0: "pending",
    1: "processing",
    2: "completed",
    3: "failed"
}

@router.post("/image")
async def create_image_job(
    product_id: int = Form(...),
    loop_count: int = Form(1),
    concept_id: int = Form(...),   
    file: UploadFile = File(...),  
    db: Session = Depends(get_db)
):
    try:
        product = db.query(models.Product).filter(models.Product.id == product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail="Sản phẩm không tồn tại trên hệ thống!")

        product_code = product.product_code

        input_dir = os.path.join(STORAGE_PATH, "input_images")
        os.makedirs(input_dir, exist_ok=True)
        file_ext = file.filename.split(".")[-1]
        
        # Tạo tên file tuyệt đối không trùng lặp dựa trên timestamp
        safe_filename = f"{product_code}_{int(time.time() * 1000)}.{file_ext}"
        file_path = os.path.join(input_dir, safe_filename)

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        new_media = models.MediaAsset(
            product_id=product_id, 
            media_type="image_input", 
            file_path=file_path
        )
        db.add(new_media)
        db.flush()

        # Tạo Job trống phần prompt để Node.js Worker tự sinh trong vòng lặp
        new_job = models.GenerationJob(
            product_id=product_id,
            job_type="image",
            concept_id=concept_id,
            status=0, 
            prompt_text="", 
            loop_count=loop_count
        )
        db.add(new_job)
        db.flush()

        new_media.job_id = new_job.id
        db.commit()
        db.refresh(new_job)

        return {
            "message": "Đã đẩy lệnh sinh ảnh vào hàng đợi thành công!", 
            "job_id": new_job.id, 
            "status": STATUS_MAP.get(new_job.status, "unknown") 
        }
    except HTTPException as http_err:
        db.rollback()
        raise http_err
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi Server: {str(e)}")

@router.get("")
def get_list_jobs(db: Session = Depends(get_db)):
    jobs = db.query(models.GenerationJob).order_by(models.GenerationJob.id.desc()).limit(20).all()
    return [
        {
            "id": job.id,
            "product_code": job.product.product_code if job.product else "N/A",
            "job_type": job.job_type,
            
            # [SỬA LẠI]: Trả thẳng số nguyên về cho Frontend tự map
            "status": int(job.status) if job.status is not None else -1, 
            
            "updated_at": job.updated_at.isoformat() if job.updated_at else None
        } for job in jobs
    ]

@router.post("/video/{image_job_id}")
def create_video_job_from_image(image_job_id: int, req: QAReviewRequest, db: Session = Depends(get_db)):
    image_job = db.query(models.GenerationJob).filter(
        models.GenerationJob.id == image_job_id, 
        models.GenerationJob.job_type == "image"
    ).first()
    
    if not image_job:
        raise HTTPException(status_code=404, detail="Không tìm thấy Job ảnh gốc")
    if not req.approved_indexes:
        raise HTTPException(status_code=400, detail="Phải có ít nhất 1 ảnh được duyệt!")

    job_product_code = image_job.product.product_code if image_job.product else "UNKNOWN"

    for i in range(1, 5):
        if i not in req.approved_indexes:
            file_to_delete = os.path.join(STORAGE_PATH, f"output_images/{job_product_code}_{image_job.id}_0{i}.jpg")
            if os.path.exists(file_to_delete):
                os.remove(file_to_delete)

    # Đảm bảo thứ tự timeline kịch bản được sắp xếp chuẩn xác từ đầu đến cuối
    segments = db.query(models.VideoSegment)\
        .filter(models.VideoSegment.concept_id == image_job.concept_id)\
        .order_by(models.VideoSegment.id.asc())\
        .all()
        
    video_timeline_text = " ".join([seg.text for seg in segments])
    
    approved_str = ",".join(map(str, req.approved_indexes))
    final_video_prompt = f"[REF_JOB:{image_job.id}][IDX:{approved_str}] Tạo video thời trang 10s. {video_timeline_text}. Đảm bảo mute video, không có âm thanh."

    new_job = models.GenerationJob(
        product_id=image_job.product_id, 
        job_type="video",
        concept_id=image_job.concept_id,
        status=0, 
        prompt_text=final_video_prompt
    )
    db.add(new_job)
    db.commit()
    
    return {"message": "Đã dọn dẹp ảnh lỗi và tạo luồng Video", "job_id": new_job.id}

@router.post("/video")
async def create_video_job_direct(
    product_code: str = Form(...),
    ai_model: str = Form("flow"),
    db: Session = Depends(get_db)
):
    try:
        actual_product_code = product_code
        target_concept_id = None
        
        if "/" in product_code:
            parts = product_code.split("/")
            actual_product_code = parts[0]
            target_concept_id = parts[1].replace("concept-", "")

        product = db.query(models.Product).filter(models.Product.product_code == actual_product_code).first()
        if not product:
            raise HTTPException(status_code=404, detail="Không tìm thấy sản phẩm!")

        new_job = models.GenerationJob(
            product_id=product.id,
            job_type="video",
            ai_model=ai_model,
            status=0, 
            concept_id=target_concept_id
        )
        db.add(new_job)
        db.commit()
        
        return {"message": "Đã đẩy lệnh video vào hàng đợi!", "job_id": new_job.id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))