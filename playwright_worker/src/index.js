const { Client } = require('pg');
// Import module chứa logic (đảm bảo file kia tên là promptBuilder.js hoặc promptGenerator.js)
const promptBuilder = require('./prompt/promptBuilder'); 

// =========================================================================
// CẤU HÌNH DATABASE (Sử dụng Connection String)
// =========================================================================
const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://root:rootpassword@localhost:5432/autoscript_media'
});

async function runDemo() {
    console.log('🚀 Khởi động Demo Prompt Builder...\n');

    try {
        // 1. Kết nối DB
        await client.connect();
        console.log('✅ Đã kết nối Database thành công.\n');

        // 2. Giả lập dữ liệu đầu vào (Input)
        // Giả sử job.concept_id = 1 và sản phẩm có các tính năng id là [1]
        const mockConceptId = 1; 
        const mockFeatureIds = [1]; 

        console.log('🎲 Đang tạo mới kịch bản Prompt...');
        console.log(`   - Concept ID: ${mockConceptId}`);
        console.log(`   - Feature IDs: ${JSON.stringify(mockFeatureIds)}\n`);

        // 3. Gọi hàm sinh dữ liệu từ DB
        const dataRandom = await promptBuilder.generateFromDB(client, mockConceptId, mockFeatureIds);

        // 4. Lắp ráp văn bản Prompt cho IMAGE và VIDEO
        const imagePromptText = promptBuilder.buildPromptText(dataRandom.imageTemplateText, dataRandom, 'image');
        const videoPromptText = promptBuilder.buildPromptText(dataRandom.videoTemplateText, dataRandom, 'video');

        // =========================================================================
        // IN KẾT QUẢ RA CONSOLE
        // =========================================================================
        console.log('===================================================');
        console.log('🎨 KẾT QUẢ GENERATE (DỮ LIỆU THÔ)');
        console.log('===================================================');
        console.log(`• Concept:     [${dataRandom.conceptName}]`);
        console.log(`• Background:  ${dataRandom.selectedBgName || 'Không có background'}`);

        // [MỚI] In toàn bộ các biến thuộc tính động đã bốc được
        console.log('\n🧩 CÁC THUỘC TÍNH ĐỘNG (IMAGE VARIABLES):');
        if (dataRandom.imageVariables && Object.keys(dataRandom.imageVariables).length > 0) {
            let hasProps = false;
            for (const [tag, value] of Object.entries(dataRandom.imageVariables)) {
                if (value) { // Chỉ in ra những tag có giá trị, bỏ qua các tag rỗng
                    console.log(`  • ${tag.padEnd(25, ' ')}: ${value}`);
                    hasProps = true;
                }
            }
            if (!hasProps) console.log('  (Không có thuộc tính nào được chọn)');
        } else {
            console.log('  (Không có dữ liệu imageVariables)');
        }
        
        console.log('\n🎬 PHÂN CẢNH VIDEO CHỌN LỌC:');
        console.log(`  • Slot 1:      ${dataRandom.segment_1_name || 'Trống'}`);
        console.log(`  • Slot 2:      ${dataRandom.segment_2_name || 'Trống'}`);
        console.log(`  • Slot 3:      ${dataRandom.segment_3_name || 'Trống'}`);
        console.log(`  • Slot 4:      ${dataRandom.segment_4_name || 'Trống'}`);

        console.log('\n===================================================');
        console.log('🖼️  FINAL PROMPT (IMAGE)');
        console.log('===================================================');
        console.log(imagePromptText || '❌ Không có template hình ảnh');

        console.log('\n===================================================');
        console.log('🎥 FINAL PROMPT (VIDEO)');
        console.log('===================================================');
        console.log(videoPromptText || '❌ Không có template video');

    } catch (error) {
        console.error('\n❌ LỖI TRONG QUÁ TRÌNH CHẠY DEMO:');
        console.error(error.message);
    } finally {
        // Luôn nhớ đóng kết nối DB dù thành công hay thất bại
        await client.end();
        console.log('\n🔌 Đã ngắt kết nối Database.');
    }
}

// Thực thi demo
runDemo();