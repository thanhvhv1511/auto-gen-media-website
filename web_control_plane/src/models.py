from sqlalchemy import Column, Integer, String, Text, Boolean, ForeignKey, DateTime, SmallInteger, Index, Date, Table, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

# ==========================================
# 1. NHÓM BẢNG QUẢN LÝ SẢN PHẨM & THUỘC TÍNH
# ==========================================

class ProductFeature(Base):
    __tablename__ = "product_features"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True) 
    feature_name = Column(String(255), nullable=False) # VD: Có Túi, Có Mũ
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Các mối quan hệ liên kết
    products = relationship("Product", back_populates="feature")
    video_segments = relationship("VideoSegment", back_populates="feature")


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    product_code = Column(String(50), nullable=False, unique=True, index=True) # Mã sản phẩm (VD: SP001)
    product_name = Column(String(255), nullable=False) # Tên sản phẩm (VD: Áo Thun Polo Premium)

    # Khóa ngoại liên kết tính năng (nullable=True để chấp nhận không sở hữu feature nào)
    feature_id = Column(Integer, ForeignKey("product_features.id"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Mối quan hệ liên kết
    feature = relationship("ProductFeature", back_populates="products")
    generation_jobs = relationship("GenerationJob", back_populates="product")
    media_assets = relationship("MediaAsset", back_populates="product")
    

# ==========================================
# 2. NHÓM BẢNG MASTER DATA (QUẢN LÝ PROMPT)
# ==========================================

class PromptVariable(Base):
    __tablename__ = "prompt_variables"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    tag_code = Column(String(50), nullable=False, unique=True, index=True) 
    
    # Thêm unique=True để làm target cho ForeignKey từ bảng concept_poses
    label = Column(String(100), nullable=False, unique=True, index=True) 
    
    insert_text = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship ngược lại ConceptPose
    concept_poses = relationship("ConceptPose", back_populates="prompt_var")


# --- CÁC BẢNG TRUNG GIAN (MANY-TO-MANY) ---

concept_pose_link = Table(
    "concept_pose_link",
    Base.metadata,
    Column("concept_id", Integer, ForeignKey("concepts.id", ondelete="CASCADE"), primary_key=True),
    Column("pose_id", Integer, ForeignKey("concept_poses.id", ondelete="CASCADE"), primary_key=True)
)

concept_video_segment_link = Table(
    "concept_video_segment_link",
    Base.metadata,
    Column("concept_id", Integer, ForeignKey("concepts.id", ondelete="CASCADE"), primary_key=True),
    Column("segment_id", Integer, ForeignKey("video_segments.id", ondelete="CASCADE"), primary_key=True)
)

background_concept_link = Table(
    "background_concept_link",
    Base.metadata,
    Column("background_id", Integer, ForeignKey("backgrounds.id", ondelete="CASCADE"), primary_key=True),
    Column("concept_id", Integer, ForeignKey("concepts.id", ondelete="CASCADE"), primary_key=True)
)


# --- CÁC MODEL CHÍNH ---

class Concept(Base):
    __tablename__ = "concepts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    base_prompt_image = Column(Text, nullable=True) 
    base_prompt_video = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Quan hệ Nhiều - Nhiều qua bảng trung gian
    poses = relationship("ConceptPose", secondary=concept_pose_link, back_populates="concepts")
    video_segments = relationship("VideoSegment", secondary=concept_video_segment_link, back_populates="concepts")
    backgrounds = relationship("Background", secondary=background_concept_link, back_populates="concepts")


class Background(Base):
    __tablename__ = "backgrounds"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    text = Column(Text, nullable=False)
    weight = Column(Integer, default=10) 
    
    is_active = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Quan hệ Nhiều - Nhiều
    concepts = relationship("Concept", secondary=background_concept_link, back_populates="backgrounds")


class ConceptPose(Base):
    __tablename__ = "concept_poses"

    id = Column(Integer, primary_key=True, autoincrement=True)
    
    pose_name = Column(String(255), nullable=False) 
    
    prompt_label = Column(String(100), ForeignKey("prompt_variables.label"), nullable=False) 
    
    text = Column(Text, nullable=False)
    weight = Column(Integer, default=10) 
    is_active = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    concepts = relationship("Concept", secondary=concept_pose_link, back_populates="poses")
    prompt_var = relationship("PromptVariable", back_populates="concept_poses")


class VideoSegment(Base):
    __tablename__ = "video_segments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    text = Column(Text, nullable=False)
    
    # Đã nâng cấp lên kiểu JSON
    allowed_slots = Column(JSON, default=[1, 2, 3, 4]) 
    
    required_feature_id = Column(Integer, ForeignKey("product_features.id"), nullable=True) 
    weight = Column(Integer, default=10) 
    is_must_have = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    concepts = relationship("Concept", secondary=concept_video_segment_link, back_populates="video_segments")
    feature = relationship("ProductFeature", back_populates="video_segments")


# ==========================================
# 3. NHÓM BẢNG VẬN HÀNH (MEDIA & JOB QUEUE)
# ==========================================

class GenerationJob(Base):
    __tablename__ = "generation_jobs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    job_type = Column(String(10), nullable=False) 
    concept_id = Column(Integer, ForeignKey("concepts.id"), nullable=True)
    ai_model = Column(String(50), default="flow", nullable=False)
    
    # 0: Pending, 1: Processing, 2: Completed, 3: Failed
    status = Column(SmallInteger, default=0, nullable=False) 
    
    prompt_text = Column(Text, nullable=True)
    loop_count = Column(Integer, default=1, nullable=False)
    retry_count = Column(Integer, default=0)
    error_log = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    product = relationship("Product", back_populates="generation_jobs")

    __table_args__ = (
        Index('idx_generation_status', 'status'),
    )


class MediaAsset(Base):
    __tablename__ = "media_assets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    media_type = Column(String(20), nullable=False) 
    file_path = Column(String(500), nullable=False)
    job_id = Column(Integer, ForeignKey("generation_jobs.id"), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    product = relationship("Product", back_populates="media_assets")


# ==========================================
# 4. NHÓM BẢNG PHÂN PHỐI & PHÂN TÍCH TIKTOK
# ==========================================

class TiktokVideo(Base):
    __tablename__ = "videos"

    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # Kiến trúc Decoupled: Lưu mã dạng chuỗi để Playwright truy vấn độc lập
    product_code = Column(String(50), nullable=False) 
    concept_code = Column(String(50), nullable=False) 
    concept_order = Column(Integer, default=1, nullable=False) 
    
    tiktok_video_id = Column(String(100), unique=True, index=True, nullable=True) 
    
    # 0: Pending, 1: Published, 2: Failed, 3: Banned
    status = Column(SmallInteger, default=0, nullable=False) 
    
    scheduled_at = Column(DateTime, nullable=True)
    published_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    metrics = relationship("VideoMetric", back_populates="video", cascade="all, delete-orphan")

    __table_args__ = (
        Index('idx_video_status_scheduled', 'status', 'scheduled_at'),
        Index('idx_product_concept', 'product_code', 'concept_code'),
    )


class VideoMetric(Base):
    __tablename__ = "video_metrics"

    id = Column(Integer, primary_key=True, autoincrement=True)
    video_id = Column(Integer, ForeignKey("videos.id"), nullable=False)
    
    # Gom dữ liệu quét theo ngày
    record_date = Column(Date, default=datetime.utcnow().date, nullable=False)
    
    views = Column(Integer, default=0, nullable=False)
    likes = Column(Integer, default=0, nullable=False)
    shares = Column(Integer, default=0, nullable=False)
    comments = Column(Integer, default=0, nullable=False)
    orders = Column(Integer, default=0, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)

    video = relationship("TiktokVideo", back_populates="metrics")

    __table_args__ = (
        # Unique Index ngăn Playwright insert trùng data trong 1 ngày
        Index('idx_unique_video_date', 'video_id', 'record_date', unique=True),
        Index('idx_metric_date', 'record_date'),
    )