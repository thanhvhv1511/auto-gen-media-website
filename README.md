# AUTOSCRIPT MEDIA

AUTHOR THANHVHV

# Seed data
docker exec -it autoscript_web python -m src.seed_data 

# JS
web_control_plane/src/static/js/
├── state.js        # Giữ nguyên: Chứa GLOBAL_DB và initMasterData()
├── jobs.js         # Tinh gọn: Chỉ chứa logic xử lý chung của Job Hàng đợi (Bảng Pipeline, Sync trạng thái 3s)
├── workspace_image.js # Chuyên trị Form Đẩy lệnh sinh ảnh, Upload file gốc, Validate input ảnh
├── workspace_video.js # Chuyên trị Form Đẩy lệnh sinh video, bốc tách Slot thời gian (1,2,3,4) theo Sản phẩm
├── builder.js      # Giữ nguyên: Trạm cấu hình Video & Lắp ráp kịch bản mẫu
├── admin.js        # Giữ nguyên: Quản trị Prompt (Concept, Bg, Poses, Scenes)
└── main.js         # Giữ nguyên: Điểm neo khởi động, lắng nghe sự kiện trang để kích hoạt hàm# auto-gen-media-website

# BE
project_root/
├── main.py              # File gốc: Khởi tạo app, mount static/media, include routers.
├── database.py          # Kết nối DB (Bạn đã có).
├── models.py            # Các class SQLAlchemy (Bạn đã có).
├── schemas.py           # Chứa TOÀN BỘ các class Pydantic (BaseModel).
├── prompt_builder.py    # Xử lý logic (Bạn đã có).
├── routers/             # Thư mục chứa các API được nhóm theo tính năng.
│   ├── __init__.py
│   ├── ui.py            # Chứa các route render giao diện (/ui/...).
│   ├── jobs.py          # Chứa các tác vụ xử lý /jobs.
│   ├── admin.py         # Chứa API CRUD cho Concept, Background, Segment, Pose.
│   └── products.py      # Chứa API /api/products và /api/master-data.
├── static/              
└── templates/

# SQL
SELECT setval(
    pg_get_serial_sequence('concept_poses', 'id'), 
    coalesce(max(id), 0) + 1, 
    false
) FROM concept_poses;

SELECT setval(pg_get_serial_sequence('concepts', 'id'), coalesce(max(id), 1)) FROM concepts;