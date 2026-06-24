import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Lấy từ biến môi trường của Docker, nếu không có thì dùng default
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://root:rootpassword@db:5432/autoscript_media")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Hàm dependency để mở và đóng kết nối an toàn cho mỗi request
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()