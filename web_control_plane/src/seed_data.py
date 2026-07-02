import json
import os
from sqlalchemy.orm import Session
from src.database import SessionLocal, engine
from src import models

def seed():
    models.Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # Kiểm tra dữ liệu trùng lặp
    if db.query(models.Concept).first():
        print("⚡ Data đã tồn tại trong Database, bỏ qua bước Seed.")
        db.close()
        return

    # Xác định đường dẫn tuyệt đối đến file data.json
    current_dir = os.path.dirname(__file__)
    json_path = os.path.join(current_dir, "data.json")

    if not os.path.exists(json_path):
        print(f"❌ Không tìm thấy file data.json tại đường dẫn: {json_path}")
        db.close()
        return

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    print("🌱 Bắt đầu tiến trình Seeding Master Data theo cấu trúc mới...")

    # 1. SEED BACKGROUNDS Matrix (Cấu trúc mới)
    for bg in data.get("backgrounds", []):
        db.add(models.Background(
            name=bg["name"], 
            text=bg["text"],
            weight=10,               # Trọng số random mặc định cho UI mới
            allowed_concepts="all"   # Mặc định allow all như thiết kế
        ))
    db.commit()
    print("   ↳ Done: Seeded Backgrounds.")

    # 2. SEED CONCEPTS & ĐỒNG BỘ PHÂN PHỐI (POSES / VIDEO SEGMENTS)
    concepts_data = data.get("concepts", {})
    
    # Dict dùng để map từ chuỗi key trong json (vd: 'has_pocket') sang ID số thực tế trong DB
    feature_mapping = {}

    for c_id, c_data in concepts_data.items():
        # Khởi tạo Concept gốc (Có bổ sung base_prompt bản lề)
        concept = models.Concept(
            name=c_data["name"],
            base_prompt_image="Ảnh thời trang dọc 9:16, chất lượng cinematic 4k, ánh sáng studio mềm mại.",
            base_prompt_video="Video thời trang dọc 9:16, chất lượng cinematic 4k, ánh sáng studio mềm mại. Đảm bảo mute video, không có âm thanh."
        )
        db.add(concept)
        db.commit() # Commit để lấy được concept.id tự tăng luôn

        # Seed Tư thế ảnh (ConceptPose) chia theo cấu trúc giải phẫu cơ thể
        poses = c_data.get("poses", {})
        for pose_name, pose_list in poses.items():
            for pose in pose_list:
                db.add(models.ConceptPose(
                    concept_id=concept.id,
                    pose_name=pose_name,
                    text=pose["text"],
                    weight=pose.get("weight", 10)
                ))
        
        # Seed Phân cảnh Video (VideoSegment) & Trích xuất Feature Flag độc lập
        for seg in c_data.get("videoSegments", []):
            req_feat_string = seg.get("requiredFeature")
            current_feature_id = None
            
            # Nếu phân cảnh yêu cầu feature (vd: has_pocket) -> Xử lý lưu và lấy ID số
            if req_feat_string:
                # Nếu chuỗi key này chưa có trong DB, tiến hành tạo mới
                if req_feat_string not in feature_mapping:
                    feat_name = "Có Túi Quần/Áo" if req_feat_string == "has_pocket" else req_feat_string.replace("has_", "Có ").title()
                    
                    db_feature = models.ProductFeature(
                        feature_name=feat_name
                    )
                    db.add(db_feature)
                    db.commit() # Commit để sinh ra db_feature.id
                    
                    # Lưu lại map: 'has_pocket' -> id số (vd: 1)
                    feature_mapping[req_feat_string] = db_feature.id
                
                # Bốc cái ID số từ dict ra để tí nữa ném vào khóa ngoại của VideoSegment
                current_feature_id = feature_mapping[req_feat_string]

            # ĐÃ UPDATE CHUẨN SCHEMA: Xóa segment_key, map chuẩn sang required_feature_id dạng Số
            db.add(models.VideoSegment(
                concept_id=concept.id,
                name=seg["name"],
                text=seg["text"],
                allowed_slots="[1,2,3,4]", # Mặc định cho phép xuất hiện ở cả 4 slot thời gian của video 10s
                required_feature_id=current_feature_id, # Đổi sang ID số hợp lệ hoặc None
                mute_audio_enforced=True
            ))

    db.commit()
    db.close()
    print("🎉 [SUCCESS] Hệ thống đã thông quan Master Data thành công 100%!")

if __name__ == "__main__":
    seed()