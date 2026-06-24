const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://root:rootpassword@db:5432/autoscript_media'
});

const STORAGE_DIR = '/storage';
const OUTPUT_IMG_DIR = path.join(STORAGE_DIR, 'output_images');
const OUTPUT_VID_DIR = path.join(STORAGE_DIR, 'output_videos');

// Tạm thời comment CHROME_WS_ENDPOINT vì Dry Run không cần dùng đến trình duyệt Playwright
// const CHROME_WS_ENDPOINT = process.env.CHROME_WS_ENDPOINT || 'http://host.docker.internal:9522';

async function processJob(job) {
    console.log(`\n==========================================`);
    console.log(`🧪 [DRY RUN] BẮT ĐẦU JOB VIDEO ID: ${job.id} | SP: ${job.product_code}`);
    console.log(`==========================================`);
    
    // Cập nhật trạng thái job sang processing như thật
    await client.query("UPDATE generation_jobs SET status = 'processing', updated_at = NOW() WHERE id = $1", [job.id]);

    try {
        // --- 1. MÔ PHỎNG QUÉT ẢNH TẠM LÀM TƯ LIỆU ĐẦU VÀO ---
        const productImgDir = path.join(OUTPUT_IMG_DIR, job.product_code);
        if (fs.existsSync(productImgDir)) {
            const files = fs.readdirSync(productImgDir).filter(f => f.endsWith('.jpg') || f.endsWith('.png'));
            if (files.length > 0) {
                console.log(`🔍 [DRY RUN] Phát hiện thấy ${files.length} ảnh tạm trong folder.`);
                console.log(`📸 [DRY RUN] Đọc file đầu tiên: ${files[0]} làm input.`);
            } else {
                console.log(`⚠️ [DRY RUN] Thư mục ảnh tạm của sản phẩm rỗng.`);
            }
        } else {
            console.log(`ℹ️ [DRY RUN] Không tìm thấy thư mục ảnh tạm cho mã sản phẩm này.`);
        }

        // --- 2. GIẢ LẬP THỜI GIAN ENGINE RENDER VIDEO (3 giây) ---
        console.log(`⏳ [DRY RUN] Đang giả lập xử lý render prompt kịch bản...`);
        console.log(`📝 [PROMPT VIDEO]: ${job.prompt_text}`);
        await new Promise(resolve => setTimeout(resolve, 3000)); 

        // --- 3. MÔ PHỎNG TẠO FILE VIDEO KẾT QUẢ THÀNH PHẨM LÀM MẪU ---
        const productVidDir = path.join(OUTPUT_VID_DIR, job.product_code);
        if (!fs.existsSync(productVidDir)) fs.mkdirSync(productVidDir, { recursive: true });
        
        const targetVidPath = path.join(productVidDir, `${job.product_code}_${job.id}_dryrun.mp4`);
        
        // Tạo một file text rỗng giả làm file .mp4 để frontend có cái map đường dẫn (không tốn dung lượng)
        if (!fs.existsSync(targetVidPath)) {
            fs.writeFileSync(targetVidPath, 'MOCK_VIDEO_DATA_FOR_DRY_RUN', 'utf-8');
            console.log(`🎬 [DRY RUN] Đã tạo file video ảo tại: ${targetVidPath}`);
        }

        // --- 4. INSERT THÀNH PHẨM VÀO DATABASE ---
        await client.query(
            "INSERT INTO media_assets (product_id, media_type, file_path, job_id) VALUES ($1, $2, $3, $4)", 
            [job.product_id, 'video', targetVidPath, job.id]
        );
        console.log(`💾 [DRY RUN] Đã đồng bộ bản ghi Video Asset ảo vào DB.`);

        // --- 5. 🔥 [CLEANUP] XÓA SẠCH ẢNH TẠM ĐÚNG THEO YÊU CẦU ---
        if (fs.existsSync(productImgDir)) {
            fs.rmSync(productImgDir, { recursive: true, force: true });
            console.log(`🧹 [CLEANUP] [DRY RUN] Đã dọn cỏ sạch sẽ thư mục ảnh tạm của SP: ${job.product_code}`);
        }

        // Cập nhật trạng thái job thành công rực rỡ
        await client.query("UPDATE generation_jobs SET status = 'success', updated_at = NOW() WHERE id = $1", [job.id]);
        console.log(`✅ [DRY RUN SUCCESS] Hoàn thành Job Video ${job.id}`);

    } catch (error) {
        console.error(`❌ [DRY RUN ERROR] Job ${job.id}:`, error.message);
        await client.query("UPDATE generation_jobs SET status = 'failed', error_log = $1, updated_at = NOW() WHERE id = $2", [error.message, job.id]);
    }
}

async function workerLoop() {
    await client.connect();
    console.log("👷 🚀 [DRY RUN ACTIVE] Video Worker đã kích hoạt luồng GIẢ LẬP. Không tốn credit!");
    while (true) {
        try {
            // Quét tìm job video ở trạng thái pending
            const res = await client.query(`
                SELECT j.id, j.product_id, j.job_type, j.prompt_text, p.product_code 
                FROM generation_jobs j
                JOIN products p ON j.product_id = p.id
                WHERE j.status = 'pending' AND j.job_type = 'video'
                ORDER BY j.created_at ASC 
                FOR UPDATE SKIP LOCKED LIMIT 1
            `);
            if (res.rows.length > 0) {
                await processJob(res.rows[0]);
            } else {
                await new Promise(r => setTimeout(r, 5000));
            }
        } catch (err) {
            console.error("Database polling error:", err);
            await new Promise(r => setTimeout(r, 5000));
        }
    }
}

if (!fs.existsSync(OUTPUT_VID_DIR)) fs.mkdirSync(OUTPUT_VID_DIR, { recursive: true });
workerLoop();