const path = require('path');
const fs = require('fs');
const promptBuilder = require('./prompt/promptBuilder');
const { Client } = require('pg');

(async () => {
    // Tách biệt file output cho Ảnh và Video để tool đọc song song
    const FILE_OUTPUT_IMAGE = path.join(__dirname, 'prompt', 'current_prompt_img.txt');
    const FILE_OUTPUT_VIDEO = path.join(__dirname, 'prompt', 'current_prompt_video.txt');
    
    // -----------------------------------------------------------------
    // ĐIỀU CHỈNH THÔNG SỐ TẠI ĐÂY
    // -----------------------------------------------------------------
    const ID_CONCEPT_CAN_CHAY = 1; 

    // Cấu hình tính năng sản phẩm dựa trên ID trong bảng `product_features`
    // Giả sử: ID 1 = "Có túi" (has_pocket). Nếu không có tính năng nào thì để rỗng: []
    const PRODUCT_FEATURE_IDS = [1];

    console.log('=== TRÌNH KIỂM TRA PROMPT TỪ DATABASE (POSTGRESQL) ===\n');

    let db; // Khởi tạo biến connection

    try {
        console.log('🔄 Đang kết nối Database...');
        // ĐIỀN THÔNG TIN KẾT NỐI DATABASE CỦA BẠN VÀO ĐÂY
        db = new Client({
            host: 'localhost',
            port: 5432,
            user: 'root', // Lưu ý: Postgres thường mặc định là 'postgres', hãy đổi lại nếu cần
            password: 'rootpassword',
            database: 'autoscript_media'
        });

        // ❗️ BƯỚC QUAN TRỌNG: Mở kết nối tới Database
        await db.connect();
        console.log('✅ Đã kết nối Database thành công!\n');

        // 1. Kéo dữ liệu và trộn Prompt từ DB (Truyền connection db vào)
        const dataRandom = await promptBuilder.generateFromDB(db, ID_CONCEPT_CAN_CHAY, PRODUCT_FEATURE_IDS);
        console.log(`🎯 Đang chạy Concept: [${dataRandom.conceptName}]`);
        
        // -----------------------------------------------------------------
        // 📸 XỬ LÝ GENERATE PROMPT CHO ẢNH (IMAGE)
        // -----------------------------------------------------------------
        // Template text giờ lấy thẳng từ DB (dataRandom.imageTemplateText)
        const finalImagePrompt = promptBuilder.buildPromptText(dataRandom.imageTemplateText, dataRandom, 'image');
        fs.writeFileSync(FILE_OUTPUT_IMAGE, finalImagePrompt, 'utf8');

        // -----------------------------------------------------------------
        // 🎬 XỬ LÝ GENERATE PROMPT CHO TIMELINE VIDEO (10 GIÂY)
        // -----------------------------------------------------------------
        // Template text giờ lấy thẳng từ DB (dataRandom.videoTemplateText)
        const finalVideoPrompt = promptBuilder.buildPromptText(dataRandom.videoTemplateText, dataRandom, 'video');
        fs.writeFileSync(FILE_OUTPUT_VIDEO, finalVideoPrompt, 'utf8');
        
        // LOG KẾT QUẢ
        console.log('\n--- 📸 KẾT QUẢ TRỘN ẢNH (IMAGE) ---');
        console.log(`• Background:  ${dataRandom.selectedBgName}`);
        if (dataRandom.selectedUpperBody) console.log(`• Thân trên:   ${dataRandom.selectedUpperBody}`);
        if (dataRandom.selectedLeg)       console.log(`• Dáng chân:   ${dataRandom.selectedLeg}`);
        if (dataRandom.selectedHand)      console.log(`• Dáng tay:    ${dataRandom.selectedHand}`);
        
        console.log('\n--- 🎬 KẾT QUẢ TIMELINE VIDEO (LOẠI TRỪ & ĐẶT GẠCH) ---');
        console.log(`• [0.0 - 2.5s] Phân cảnh 1: ${dataRandom.segment_1_name || 'Trống'}`);
        console.log(`• [2.5 - 5.0s] Phân cảnh 2: ${dataRandom.segment_2_name || 'Trống'}`);
        console.log(`• [5.0 - 7.5s] Phân cảnh 3: ${dataRandom.segment_3_name || 'Trống'}`);
        console.log(`• [7.5 - 10.s] Phân cảnh 4: ${dataRandom.segment_4_name || 'Trống'}`);
        console.log('-------------------------------------------\n');

        console.log(`💾 Đã ghi đè toàn bộ file kịch bản thành công!`);

    } catch (error) {
        console.error('\n❌ Lỗi hệ thống:', error.message);
    } finally {
        // Luôn nhớ đóng kết nối DB sau khi chạy xong để giải phóng tài nguyên
        if (db) {
            await db.end();
            console.log('🔌 Đã ngắt kết nối Database.');
        }
    }
})();