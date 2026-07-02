const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const flowActions = require('./actions/flowActions');

// ==========================================
// CẤU HÌNH DATABASE, ĐƯỜNG DẪN & TRẠNG THÁI
// ==========================================
const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://root:rootpassword@db:5432/autoscript_media'
});

const STORAGE_DIR = '/storage';
const OUTPUT_IMG_DIR = path.join(STORAGE_DIR, 'output_images');
const OUTPUT_VID_DIR = path.join(STORAGE_DIR, 'output_videos');
const CHROME_WS_ENDPOINT = process.env.CHROME_WS_ENDPOINT || 'http://host.docker.internal:9521';

// Định nghĩa Mapping Trạng thái DB (Dành cho cột kiểu smallint)
const JOB_STATUS = {
    PENDING: 0,
    PROCESSING: 1,
    SUCCESS: 2,
    FAILED: 3
};

// ==========================================
// XỬ LÝ CHÍNH TỪNG JOB
// ==========================================
async function processJob(job) {
    console.log(`\n==========================================`);
    console.log(`🚀 [FLOW AI] BẮT ĐẦU JOB VIDEO ID: ${job.id} | SP: ${job.product_code}`);
    console.log(`==========================================`);
    
    // Đã chuyển 'processing' thành JOB_STATUS.PROCESSING
    await client.query("UPDATE generation_jobs SET status = $1, updated_at = NOW() WHERE id = $2", [JOB_STATUS.PROCESSING, job.id]);

    let browser;
    try {
        // 1. KẾT NỐI TRÌNH DUYỆT (Logic đã tách ra action)
        browser = await flowActions.connectToChrome(CHROME_WS_ENDPOINT);
        const context = browser.contexts()[0];
        let page = context.pages().find(p => p.url().toLowerCase().includes('labs.google')) || context.pages()[0] || await context.newPage();

        // 2. QUÉT LẤY DỮ LIỆU ĐẦU VÀO (Logic đã tách)
        const productImgDir = path.join(OUTPUT_IMG_DIR, job.product_code);
        const filesToProcess = flowActions.scanInputImages(productImgDir);

        if (filesToProcess.length > 0) {
            console.log(`🔍 Phát hiện thấy ${filesToProcess.length} ảnh làm tư liệu đầu vào. Bắt đầu xử lý...`);
            page = await flowActions.handleProjectNavigation(page);

            // 3. VÒNG LẶP RENDER
            for (let i = 0; i < filesToProcess.length; i++) {
                const { fileName: file, fullPath: imageFilePath } = filesToProcess[i];
                console.log(`\n  🔄 Đang xử lý ảnh ${i + 1}/${filesToProcess.length}: ${file}`);

                // Phân giải thông tin từ tên file
                const { parsedProductCode, parsedConceptId } = flowActions.parseFilenameInfo(file, job.product_code, job.concept_id);

                // Tạo thư mục đích
                const productVidDir = path.join(OUTPUT_VID_DIR, job.product_code, `concept-${parsedConceptId}`);
                if (!fs.existsSync(productVidDir)) fs.mkdirSync(productVidDir, { recursive: true });

                const fileNameWithoutExt = path.parse(file).name;
                const targetVidPath = path.join(productVidDir, `${fileNameWithoutExt}.mp4`);

                // === GỌI ACTION PLAYWRIGHT CHẠY THẬT ===
                const initialVideoCount = await page.evaluate(() => document.querySelectorAll('video').length);

                await flowActions.uploadInitialMultipleImage(page, imageFilePath);
                await flowActions.addLatestTileToPrompt(page); 
                await flowActions.configureAndFillVideoPrompt(page, job.prompt_text);
                console.log(`\n  Done ${job.prompt_text}`);
                console.log(`\n  Ok ${file}`);
                // await flowActions.submitPrompt(page);
                // await flowActions.downloadLatestVideo(page, initialVideoCount, targetVidPath, 3);
                await flowActions.deleteLatestTile(page); 

                // LƯU DB
                await client.query(
                    "INSERT INTO media_assets (product_id, media_type, file_path, job_id) VALUES ($1, $2, $3, $4)", 
                    [job.product_id, 'video', targetVidPath, job.id]
                );
                
                // Xóa ảnh mồi
                if (fs.existsSync(imageFilePath)) fs.unlinkSync(imageFilePath);

                // F5 trang chuẩn bị cho ảnh tiếp theo
                if (i < filesToProcess.length - 1) {
                    await page.reload({ waitUntil: 'domcontentloaded' });
                    await page.waitForTimeout(3000); 
                }
            }
        } else {
            console.log(`⚠️ Không tìm thấy ảnh tạm nào cho SP ${job.product_code}. Bỏ qua render.`);
        }

        // 4. DỌN DẸP & KẾT THÚC (Logic đã tách)
        flowActions.cleanupEmptyDirectories(productImgDir, job.product_code);

        console.log('\n🔄 Đang F5 dọn dẹp UI lần cuối...');
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(3000); 

        // Đánh dấu thành công (chuyển 'success' thành JOB_STATUS.SUCCESS)
        await client.query("UPDATE generation_jobs SET status = $1, updated_at = NOW() WHERE id = $2", [JOB_STATUS.SUCCESS, job.id]);
        console.log(`✅ [SUCCESS] Hoàn thành Job Video ${job.id}`);

    } catch (error) {
        console.error(`❌ [ERROR] Job ${job.id}:`, error.message);
        // Đánh dấu thất bại (chuyển 'failed' thành JOB_STATUS.FAILED)
        await client.query("UPDATE generation_jobs SET status = $1, error_log = $2, updated_at = NOW() WHERE id = $3", [JOB_STATUS.FAILED, error.message, job.id]);
    } finally {
        if (browser) await browser.close().catch(() => {});
    }
}

// ==========================================
// VÒNG LẶP WORKER (POLLING DATABASE)
// ==========================================
async function workerLoop() {
    await client.connect();
    console.log("👷 [FLOW MODEL] Video Worker đã kết nối Database. Đang chờ Job Sinh Video mới...");
    while (true) {
        try {
            // Chuyển 'pending' thành nội suy biến ${JOB_STATUS.PENDING}
            const res = await client.query(`
                SELECT j.id, j.product_id, j.job_type, j.prompt_text, j.concept_id, j.ai_model, p.product_code 
                FROM generation_jobs j
                JOIN products p ON j.product_id = p.id
                WHERE j.status = ${JOB_STATUS.PENDING} AND j.job_type = 'video' AND j.ai_model = 'flow'
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