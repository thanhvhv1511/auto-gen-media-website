from sqlalchemy import Column, Integer, String, Text, Boolean, ForeignKey, DateTime
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

    # FIX TẠI ĐÂY: Thêm khóa ngoại liên kết tính năng (nullable=True để chấp nhận không sở hữu feature nào)
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

class Background(Base):
    __tablename__ = "backgrounds"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    text = Column(Text, nullable=False)
    weight = Column(Integer, default=10) 
    allowed_concepts = Column(String(255), default="all") 
    is_active = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Concept(Base):
    __tablename__ = "concepts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    base_prompt_image = Column(Text, nullable=True) 
    base_prompt_video = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    poses = relationship("ConceptPose", back_populates="concept")
    video_segments = relationship("VideoSegment", back_populates="concept")


class ConceptPose(Base):
    __tablename__ = "concept_poses"

    id = Column(Integer, primary_key=True, autoincrement=True)
    concept_id = Column(Integer, ForeignKey("concepts.id"), nullable=False)
    body_part = Column(String(50), nullable=False) 
    text = Column(Text, nullable=False)
    weight = Column(Integer, default=10) 
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    concept = relationship("Concept", back_populates="poses")


class VideoSegment(Base):
    __tablename__ = "video_segments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    concept_id = Column(Integer, ForeignKey("concepts.id"), nullable=False)
    name = Column(String(255), nullable=False)
    text = Column(Text, nullable=False)
    allowed_slots = Column(String(255), default="[1,2,3,4]") 
    
    required_feature_id = Column(Integer, ForeignKey("product_features.id"), nullable=True) 
    mute_audio_enforced = Column(Boolean, default=True) 

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    concept = relationship("Concept", back_populates="video_segments")
    feature = relationship("ProductFeature", back_populates="video_segments")


# ==========================================
# 3. NHÓM BẢNG VẬN HÀNH (MEDIA & JOB QUEUE)
# ==========================================

class GenerationJob(Base):
    __tablename__ = "generation_jobs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # Đồng bộ dùng product_id liên kết trực tiếp bảng Product mới thay cho product_code chuỗi
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    
    job_type = Column(String(10), nullable=False) 
    concept_id = Column(Integer, ForeignKey("concepts.id"), nullable=True)
    status = Column(String(20), default="pending", index=True) 
    prompt_text = Column(Text, nullable=True)
    loop_count = Column(Integer, default=1, nullable=False)
    retry_count = Column(Integer, default=0)
    error_log = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    product = relationship("Product", back_populates="generation_jobs")


class MediaAsset(Base):
    __tablename__ = "media_assets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # Đồng bộ dùng product_id liên kết bảng Product mới
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    
    media_type = Column(String(20), nullable=False) 
    file_path = Column(String(500), nullable=False)
    job_id = Column(Integer, ForeignKey("generation_jobs.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    product = relationship("Product", back_populates="media_assets")