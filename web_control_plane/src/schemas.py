from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date

# ==========================================
# 1. CÁC SCHEMA CŨ (Giữ nguyên hoặc cập nhật nhẹ)
# ==========================================

class QAReviewRequest(BaseModel):
    approved_indexes: List[int]

class BasePromptUpdate(BaseModel):
    base_prompt_image: str
    base_prompt_video: str

class BackgroundCreate(BaseModel):
    name: str
    text: str
    weight: int = 10
    allowed_concepts: Optional[str] = "all"

class VideoSegmentUpdate(BaseModel):
    name: str
    text: str
    # CẬP NHẬT: Đổi thành required_feature_id (int) để khớp với ForeignKey trong DB
    required_feature_id: Optional[int] = None 
    allowed_slots: str
    mute_audio_enforced: Optional[bool] = True # Bổ sung field mới
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class ConceptCreate(BaseModel):
    name: str

class WeightUpdate(BaseModel):
    weight: int

class PoseUpdate(BaseModel):
    text: str
    weight: int

class ProductCreate(BaseModel):
    product_code: str
    product_name: str
    feature_id: Optional[int] = None
    feature_name: Optional[str] = None

class PromptVariableResponse(BaseModel):
    tag_code: str
    label: str
    insert_text: str

    class Config:
        from_attributes = True


# ==========================================
# 2. CÁC SCHEMA MỚI BỔ SUNG (Vận hành, Phân phối, Phân tích)
# ==========================================

class GenerationJobStatusUpdate(BaseModel):
    # Trạng thái nay dùng int: 0=Pending, 1=Processing, 2=Completed, 3=Failed
    status: int 
    error_log: Optional[str] = None

class TiktokVideoCreate(BaseModel):
    product_code: str
    concept_code: str
    scheduled_at: Optional[datetime] = None
    # Không cần truyền concept_order vì logic backend sẽ tự đếm (query max order + 1)
    
class TiktokVideoUpdate(BaseModel):
    tiktok_video_id: str
    status: int # 1=Published, 2=Failed, 3=Banned
    published_at: Optional[datetime] = None

class VideoMetricCreate(BaseModel):
    # API Tool Playwright gửi View hàng ngày lên sẽ dùng schema này
    tiktok_video_id: str # Hứng bằng ID video của tiktok để dễ dò
    record_date: date
    views: int = 0
    likes: int = 0
    shares: int = 0
    comments: int = 0
    orders: int = 0

class VideoSegmentCreate(BaseModel):
    name: str
    text: str
    required_feature_id: Optional[int] = None
    is_must_have: bool = False
    allowed_slots: str = "[]"

class PoseCreate(BaseModel):
    pose_name: str
    prompt_label: str  
    text: str
    weight: int = 10