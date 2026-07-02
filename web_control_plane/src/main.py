from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
import os
from fastapi.responses import RedirectResponse
from src import models
from src.database import engine
from src.routers import ui, jobs, products, prompt, backgrounds, video_segments, poses

# Tạo bảng DB (nếu chưa có)
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Autoscript Media Control Plane", version="1.0.0")

# ==========================================
# CẤU HÌNH MOUNT STATIC & MEDIA
# ==========================================
os.makedirs("/storage/output_images", exist_ok=True)
os.makedirs("/storage/output_videos", exist_ok=True)
app.mount("/media", StaticFiles(directory="/storage"), name="media")

static_dir = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(os.path.join(static_dir, "css"), exist_ok=True)
os.makedirs(os.path.join(static_dir, "js"), exist_ok=True)
app.mount("/static", StaticFiles(directory=static_dir), name="static")
# ==========================================

# ==========================================
# ĐĂNG KÝ ROUTERS
# ==========================================
app.include_router(ui.ui_router)
app.include_router(ui.api_router)
app.include_router(jobs.router)
app.include_router(products.router)
app.include_router(prompt.router)
app.include_router(backgrounds.router)
app.include_router(video_segments.router)
app.include_router(poses.router)
# ==========================================

DATABASE_URL = os.getenv("DATABASE_URL")
STORAGE_PATH = "/storage"

@app.get("/", include_in_schema=False)
def redirect_to_ui():
    return RedirectResponse(url="/ui/image")

@app.get("/health")
def health_check():
    input_dir = os.path.join(STORAGE_PATH, "input_images")
    return {"storage_mounted": os.path.exists(input_dir)}