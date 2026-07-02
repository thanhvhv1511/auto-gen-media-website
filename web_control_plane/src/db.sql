-- ==========================================
-- 1. BẢNG prompt_variables (Xóa lặp, giữ lại 1 bản duy nhất)
-- ==========================================
INSERT INTO public.prompt_variables (tag_code, "label", insert_text, is_active, created_at, updated_at) VALUES
     ('BACKGROUND', 'Bối Cảnh', '{{SELECTED_BACKGROUND}}', true, '2026-06-24 09:59:58', '2026-06-24 09:59:58'),
     ('UPPER_BODY', 'Thân Trên', '{{SELECTED_UPPER_BODY}}', true, '2026-06-24 09:59:58', '2026-06-24 09:59:58'),
     ('LEG', 'Dáng Chân', '{SELECTED_LEG}}', true, '2026-06-24 09:59:58', '2026-06-24 09:59:58'),
     ('HAND', 'Dáng Tay', '{{SELECTED_HAND}}', true, '2026-06-24 09:59:58', '2026-06-24 09:59:58'),
     ('HAIR_COLOR', 'Màu tóc', '{{SELECTED_HAIR_COLOR}}', true, '2026-06-24 09:59:58', '2026-06-24 09:59:58'),
     ('BRACELET', 'Vòng Tay', '{{SELECTED_BRACELET}}', true, '2026-06-24 09:59:58', '2026-06-24 09:59:58'),
     ('NECKLACE', 'Vòng Cổ', '{{SELECTED_NECKLACE}}', true, '2026-06-24 09:59:58', '2026-06-24 09:59:58');

-- ==========================================
-- 2. BẢNG concepts (Cố định ID 1, 2, 3)
-- ==========================================
INSERT INTO public.concepts (id, name, base_prompt_image, base_prompt_video, is_active, created_at, updated_at) VALUES
     (1, 'Đứng Full', 'Ảnh thời trang dọc 9:16, chất lượng cinematic 4k, ánh sáng studio mềm mại. sadasd{{SELECTED_LEG}}{{SELECTED_LEG}}', 'Video thời trang dọc 9:16, chất lượng cinematic 4k, ánh sáng studio mềm mại. Đảm bảo mute video, không có âm thanh.{{SELECTED_UPPER_BODY}}{{SELECTED_UPPER_BODY}}', true, '2026-06-24 09:59:58.336', '2026-06-25 07:29:53.064'),
     (2, 'Đứng quay quần che mặt', 'Ảnh thời trang dọc 9:16, chất lượng cinematic 4k, ánh sáng studio mềm mại. ádsa{{SELECTED_UPPER_BODY}}{{SELECTED_UPPER_BODY}}{{SELECTED_LEG}}{{SELECTED_LEG}}', 'Video thời trang dọc 9:16, chất lượng cinematic 4k, ánh sáng studio mềm mại. Đảm bảo mute video, không có âm thanh.', true, '2026-06-24 09:59:58.337', '2026-06-25 07:30:36.978'),
     (3, 'Ngồi Selfie', 'THAY ĐỔI BACKGROUND VÀ GÓC QUAY NHẸ NHÀNG, KHÔNG THAY ĐỔI NGƯỜI MẪU, TRANG PHỤC... IMPORTANT: Keep the subject scale identical to the original image...', 'Video thời trang dọc 9:16, chất lượng cinematic 4k, ánh sáng studio mềm mại. Đảm bảo mute video, không có âm thanh.', true, '2026-06-24 09:59:58.321', '2026-06-30 03:25:19.730');

-- ==========================================
-- 3. BẢNG product_features (Cố định ID 1, 2)
-- ==========================================
INSERT INTO public.product_features (id, feature_name, created_at, updated_at) VALUES
     (1, 'Có Túi Quần/Áo', '2026-06-24 09:59:58.331', '2026-06-24 09:59:58.331'),
     (2, 'Có mũ', '2026-06-25 03:14:25.501', '2026-06-25 03:14:25.501');

-- ==========================================
-- 4. BẢNG products
-- ==========================================
INSERT INTO public.products (product_code, product_name, feature_id, created_at, updated_at) VALUES
     ('sp001', 'Áo Thun Polo Premium V1', NULL, '2026-06-24 10:01:06.366', '2026-06-24 10:01:06.366'),
     ('sp003', 'Nước Hoa Unisex Mirror Selfie', NULL, '2026-06-24 10:01:06.366', '2026-06-24 10:01:06.366'),
     ('sp002', 'Quần Short Kaki Co Giãn 4 Chiều', 1, '2026-06-24 10:01:06.366', '2026-06-24 10:01:06.366'),
     ('sp004', 'Demo sản phẩm', 2, '2026-06-25 03:14:25.520', '2026-06-25 03:14:25.520');

-- ==========================================
-- 5. BẢNG concept_poses (Cập nhật thêm prompt_label và is_active)
-- ==========================================
INSERT INTO public.concept_poses (id, pose_name, prompt_label, text, weight, is_active, created_at, updated_at) VALUES
     -- Các pose gốc của Concept 1 (ID: 1 -> 12)
     (1, 'Thân Trên', 'Thân Trên', 'Thân trên hơi nghiêng nhẹ sang trái, tạo cảm giác mềm mại.', 10, true, '2026-06-24 09:59:58.326', '2026-06-24 09:59:58.326'),
     (2, 'Thân Trên', 'Thân Trên', 'Thân trên hơi nghiêng nhẹ sang phải, ánh mắt hướng xuống nhẹ.', 10, true, '2026-06-24 09:59:58.326', '2026-06-24 09:59:58.326'),
     (3, 'Dáng Chân', 'Dáng Chân', 'Một chân duỗi nhẹ, chân còn lại co tự nhiên.', 10, true, '2026-06-24 09:59:58.326', '2026-06-24 09:59:58.326'),
     (4, 'Dáng Chân', 'Dáng Chân', 'Hai gối khép tự nhiên và hơi nghiêng sang một bên.', 10, true, '2026-06-24 09:59:58.326', '2026-06-24 09:59:58.326'),
     (5, 'Dáng Chân', 'Dáng Chân', 'Hai chân đặt song song nhưng lệch nhau một chút.', 10, true, '2026-06-24 09:59:58.326', '2026-06-24 09:59:58.326'),
     (6, 'Dáng Tay', 'Dáng Tay', 'Tay còn lại đặt nhẹ trên đùi.', 10, true, '2026-06-24 09:59:58.326', '2026-06-24 09:59:58.326'),
     (7, 'Dáng Tay', 'Dáng Tay', 'Tay còn lại chạm nhẹ lên ngực.', 10, true, '2026-06-24 09:59:58.326', '2026-06-24 09:59:58.326'),
     (8, 'Dáng Tay', 'Dáng Tay', 'Tay còn lại đặt lên eo.', 10, true, '2026-06-24 09:59:58.326', '2026-06-24 09:59:58.326'),
     (9, 'Dáng Tay', 'Dáng Tay', 'Tay còn lại giữ nhẹ mép áo.', 10, true, '2026-06-24 09:59:58.326', '2026-06-24 09:59:58.326'),
     (10, 'Dáng Tay', 'Dáng Tay', 'Tay còn lại chống nhẹ lên ghế.', 10, true, '2026-06-24 09:59:58.326', '2026-06-24 09:59:58.326'),
     (11, 'Thân Trên', 'Thân Trên', 'Thân trên xoay nhẹ sang một bên khoảng 15 độ.sss', 9, true, '2026-06-24 09:59:58.326', '2026-06-29 17:52:15.159'),
     (12, 'Dáng Chân', 'Dáng Chân', 'Bắt chéo chân tự nhiên.', 6, true, '2026-06-24 09:59:58.326', '2026-06-29 17:52:22.530'),
     
     -- Các pose gốc của Concept 2 (ID: 13 -> 18)
     (13, 'Thân Trên', 'Thân Trên', 'Thân trên đứng thẳng tự nhiên, vai thả lỏng.', 70, true, '2026-06-24 09:59:58.338', '2026-06-24 09:59:58.338'),
     (14, 'Thân Trên', 'Thân Trên', 'Thân trên hơi xoay nhẹ sang một bên tạo góc nghiêng.', 30, true, '2026-06-24 09:59:58.338', '2026-06-24 09:59:58.338'),
     (15, 'Dáng Chân', 'Dáng Chân', 'Hai chân khép nhẹ tự nhiên.', 40, true, '2026-06-24 09:59:58.338', '2026-06-24 09:59:58.338'),
     (16, 'Dáng Chân', 'Dáng Chân', 'Một chân bước lên phía trước một chút tạo dáng chữ A.', 60, true, '2026-06-24 09:59:58.338', '2026-06-24 09:59:58.338'),
     (17, 'Dáng Tay', 'Dáng Tay', 'Tay còn lại buông thõng tự nhiên dọc theo cơ thể.', 50, true, '2026-06-24 09:59:58.338', '2026-06-24 09:59:58.338'),
     (18, 'Dáng Tay', 'Dáng Tay', 'Tay còn lại đút hờ vào túi quần.', 50, true, '2026-06-24 09:59:58.338', '2026-06-24 09:59:58.338'),
     
     -- Các pose gốc của Concept 3 (ID: 19 -> 22)
     (19, 'Dáng Chân', 'Dáng Chân', 'Hai chân đặt song song, cách nhau một khoảng nhỏ để lộ rõ form quần.', 50, true, '2026-06-24 09:59:58.340', '2026-06-24 09:59:58.340'),
     (20, 'Dáng Chân', 'Dáng Chân', 'Một chân hơi chùng gối nhẹ để khoe độ co giãn và nếp gấp của vải quần.', 50, true, '2026-06-24 09:59:58.340', '2026-06-24 09:59:58.340'),
     (21, 'Dáng Tay', 'Dáng Tay', 'Cả hai tay đút vào túi quần trước.', 50, true, '2026-06-24 09:59:58.340', '2026-06-24 09:59:58.340'),
     (22, 'Dáng Tay', 'Dáng Tay', 'Một tay buông thả lỏng, một tay giữ nhẹ cạp quần.', 50, true, '2026-06-24 09:59:58.340', '2026-06-24 09:59:58.340');

-- ==========================================
-- 6. BẢNG TRUNG GIAN concept_pose_link
-- ==========================================
INSERT INTO public.concept_pose_link (concept_id, pose_id) VALUES
     (1, 1), (1, 2), (1, 3), (1, 4), (1, 5), (1, 6), (1, 7), (1, 8), (1, 9), (1, 10), (1, 11), (1, 12),
     (2, 13), (2, 14), (2, 15), (2, 16), (2, 17), (2, 18),
     (3, 19), (3, 20), (3, 21), (3, 22);

-- ==========================================
-- 7. BẢNG video_segments (Cập nhật thêm weight)
-- ==========================================
INSERT INTO public.video_segments (id, name, text, allowed_slots, required_feature_id, weight, is_must_have, created_at, updated_at) VALUES
     (1, 'Kéo nhẹ gấu áo khoe chất liệu', 'Người phụ nữ vẫn ngồi trên ghế...', '[1, 2, 3, 4]'::jsonb, NULL, 10, true, '2026-06-24 09:59:58.332', '2026-06-24 09:59:58.332'),
     (2, 'Đứng dậy khỏi ghế', 'Người phụ nữ nhẹ nhàng đứng dậy...', '[1, 2, 3, 4]'::jsonb, NULL, 10, true, '2026-06-24 09:59:58.332', '2026-06-24 09:59:58.332'),
     (3, 'Đứng tạo dáng dồn trọng tâm', 'Người phụ nữ đứng tạo dáng...', '[1, 2, 3, 4]'::jsonb, NULL, 10, true, '2026-06-24 09:59:58.332', '2026-06-24 09:59:58.332'),
     (4, 'Xỏ tay vào túi khoe form (Có Túi)', 'Người mẫu hơi nghiêng người...', '[1, 2, 3, 4]'::jsonb, 1, 10, true, '2026-06-24 09:59:58.339', '2026-06-24 09:59:58.339');

-- ==========================================
-- 8. BẢNG TRUNG GIAN concept_video_segment_link
-- ==========================================
INSERT INTO public.concept_video_segment_link (concept_id, segment_id) VALUES
     (1, 1), 
     (1, 2), 
     (1, 3), 
     (2, 1), 
     (2, 3), 
     (2, 4);

-- ==========================================
-- 9. BẢNG backgrounds
-- ==========================================
INSERT INTO public.backgrounds (id, name, text, weight, is_active, created_at, updated_at) VALUES
    (1, 'Studio Hàn Quốc Tường Xi Măng Xám', 'Không gian là một studio...', 10, true, '2026-06-30 15:09:49', '2026-06-30 15:09:49'),
    (2, 'Căn hộ mini Tông Kem Phong Cách Việt', 'Background là không gian...', 10, true, '2026-06-30 15:09:49', '2026-06-30 15:09:49'),
    (3, 'Studio Hàn Quốc Phong Cách Căn Hộ', 'Background là một studio...', 10, true, '2026-06-30 15:09:49', '2026-06-30 15:09:49'),
    (4, 'Phòng Ngủ Nữ Tính Chung Cư Mini Việt Nam', 'Background là một studio...', 10, true, '2026-06-30 15:09:49', '2026-06-30 15:09:49'),
    (5, 'Ban công chung cư', 'Background là không gian ban công...', 10, true, '2026-06-30 15:09:49', '2026-06-30 15:09:49'),
    (6, 'Quán cà phê tối giản', 'Background là không gian một quán...', 10, true, '2026-06-30 15:09:49', '2026-06-30 15:09:49'),
    (7, 'Showroom thời trang', 'Background là một showroom thời trang...', 10, true, '2026-06-30 15:09:49', '2026-06-30 15:09:49'),
    (8, 'Góc cửa sổ ánh sáng tự nhiên', 'Background là một góc cửa sổ...', 10, true, '2026-06-30 15:09:49', '2026-06-30 15:09:49'),
    (9, 'Studio tông nâu cà phê', 'Background là một studio hiện đại...', 10, true, '2026-06-30 15:09:49', '2026-06-30 15:09:49'),
    (10, 'Góc Tường Gạch Cây Xanh Tối Giản', 'Background là một góc không gian...', 10, true, '2026-06-30 15:09:49', '2026-06-30 15:09:49'),
    (11, 'Phòng trọ sinh viên', 'Background là không gian phòng thuê...', 10, true, '2026-06-30 15:09:49', '2026-06-30 15:09:49'),
    (12, 'Sân thượng chung cư', 'Background là không gian sân thượng...', 10, true, '2026-06-30 15:09:49', '2026-06-30 15:09:49');

INSERT INTO public.background_concept_link (background_id, concept_id)
SELECT b.id, c.id 
FROM public.backgrounds b
CROSS JOIN public.concepts c;