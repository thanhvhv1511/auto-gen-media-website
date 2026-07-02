import os
from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from fastapi import FastAPI

# Giả sử đây là file chính của bạn (main.py)
app = FastAPI()
# Khởi tạo 2 Router riêng biệt
ui_router = APIRouter(prefix="/ui", tags=["UI Templates"])
api_router = APIRouter(prefix="/api", tags=["API Data"])

# Cấu hình templates
templates_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "templates")
templates = Jinja2Templates(directory=templates_dir)

# ==========================================
# CÁC ROUTE UI (SỬ DỤNG ui_router)
# ==========================================

@ui_router.get("", response_class=RedirectResponse)
def redirect_default_ui(request: Request):
    return RedirectResponse(url="/ui/image")

@ui_router.get("/image", response_class=HTMLResponse)
def get_image_ui(request: Request):
    return templates.TemplateResponse("image.html", {"request": request})

@ui_router.get("/video", response_class=HTMLResponse)
def get_video_ui(request: Request):
    return templates.TemplateResponse("video.html", {"request": request})

@ui_router.get("/admin", response_class=HTMLResponse)
def get_admin_ui(request: Request):
    return templates.TemplateResponse("admin.html", {"request": request})

@ui_router.get("/product", response_class=HTMLResponse)
def get_product_ui(request: Request):
    return templates.TemplateResponse("product.html", {"request": request})

@ui_router.get("/prompt", response_class=HTMLResponse)
def get_video_segments_ui(request: Request):
    return templates.TemplateResponse("prompt.html", {"request": request})

@ui_router.get("/backgrounds", response_class=HTMLResponse)
def get_backgrounds_ui(request: Request):
    return templates.TemplateResponse("backgrounds.html", {"request": request})

@ui_router.get("/video-segments", response_class=HTMLResponse)
def get_video_segments_ui(request: Request):
    return templates.TemplateResponse("video_segments.html", {"request": request})

@ui_router.get("/poses", response_class=HTMLResponse)
def get_video_segments_ui(request: Request):
    return templates.TemplateResponse("poses.html", {"request": request})


# ==========================================
# CÁC ROUTE API (SỬ DỤNG api_router)
# ==========================================

@api_router.get("/concepts/{concept_id}/backgrounds")
def get_backgrounds_for_concept(concept_id: int):
    return []