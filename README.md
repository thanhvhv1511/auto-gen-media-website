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
