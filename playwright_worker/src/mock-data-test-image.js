const { chromium } = require('playwright');
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const http = require('http'); 

// Gọi các module hành động và prompt
const flowActions = require('./actions/flowActions');
const promptBuilder = require('./prompt/promptBuilder');

// ==========================================
// CẤU HÌNH DATABASE & ĐƯỜNG DẪN
// ==========================================
const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://root:rootpassword@localhost:5432/autoscript_media'
});

const STORAGE_DIR = '/storage';
const INPUT_DIR = path.join(STORAGE_DIR, 'input_images');
const OUTPUT_IMG_DIR = path.join(STORAGE_DIR, 'output_images');
const CHROME_WS_ENDPOINT = process.env.CHROME_WS_ENDPOINT || 'http://host.docker.internal:9521';

// ==========================================
// HÀM TIỆN ÍCH
// ==========================================
function getUniqueFilePath(dir, baseName, extension) {
    let fileName = `${baseName}${extension}`;
    let filePath = path.join(dir, fileName);
    let counter = 1;
    while (fs.existsSync(filePath)) {
        fileName = `${baseName}_(${counter})${extension}`;
        filePath = path.join(dir, fileName);
        counter++;
    }
    return filePath;
}

// ==========================================
// XỬ LÝ CHÍNH TỪNG JOB
// ==========================================
async function processJob(job) {
    // Lấy số vòng lặp từ job, nếu không có mặc định là 1
    const loopCount = job.loop_count || 1;

    console.log(`\n==========================================`);
    console.log(`🚀 BẮT ĐẦU JOB ẢNH ID: ${job.id} | SP: ${job.product_code} | SỐ VÒNG: ${loopCount}`);
    console.log(`==========================================`);
    
    await client.query("UPDATE generation_jobs SET status = 'processing', updated_at = NOW() WHERE id = $1", [job.id]);

    let browser;
    try {
        // --- GIẢI PHÁP HTTP LÕI BẮT TOKEN CHROME ---
        let endpoint = CHROME_WS_ENDPOINT;
        let cdpPort = 9521; 
        
        if (endpoint.startsWith('http')) {
            console.log(`🔍 Đang dùng HTTP Bypass để dò Token WebSocket của Chrome...`);
            const targetHost = endpoint.includes('host.docker.internal') ? 'host.docker.internal' : endpoint.split('://')[1].split(':')[0];
            cdpPort = endpoint.split(':')[2] ? endpoint.split(':')[2].replace(/\//g, '') : 9521;

            const wsUrl = await new Promise((resolve, reject) => {
                const req = http.request({
                    hostname: targetHost,
                    port: cdpPort,
                    path: '/json/version',
                    method: 'GET',
                    headers: { 'Host': `localhost:${cdpPort}` } 
                }, (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => {
                        if (res.statusCode !== 200) return reject(new Error(`Chrome từ chối với mã lỗi: ${res.statusCode}`));
                        try {
                            resolve(JSON.parse(data).webSocketDebuggerUrl);
                        } catch(e) {
                            reject(new Error("Không thể parse dữ liệu từ Chrome"));
                        }
                    });
                });
                req.on('error', reject);
                req.end();
            });

            endpoint = wsUrl.replace(/localhost|127\.0\.0\.1/, targetHost);
            console.log(`🎯 Bắt Token thành công! Endpoint thực tế: ${endpoint}`);
        }

        browser = await chromium.connectOverCDP(endpoint, {
            headers: { 'Host': `localhost:${cdpPort}` }
        });
        
        const context = browser.contexts()[0];
        let page = context.pages().find(p => p.url().toLowerCase().includes('labs.google')) || context.pages()[0] || await context.newPage();

        // Vào trang dự án
        page = await flowActions.handleProjectNavigation(page);

        // --- LẤY ẢNH ĐẦU VÀO TỪ DB ---
        const mediaRes = await client.query("SELECT file_path FROM media_assets WHERE job_id = $1 AND media_type = 'image_input' LIMIT 1", [job.id]);
        
        // Cú pháp Fallback: Nếu data fake không có ảnh trong DB, dùng một ảnh mặc định để test không bị crash
        let inputImagePath = mediaRes.rows.length > 0 ? mediaRes.rows[0].file_path : path.join(__dirname, 'sample.jpeg');
        if (!fs.existsSync(inputImagePath)) {
            console.warn(`⚠️ Cảnh báo: Không tìm thấy file ảnh tại ${inputImagePath}. Vui lòng tạo 1 file sample.jpeg để chạy giả lập.`);
        }

        // Tạo thư mục gom theo mã sản phẩm
        const productImgDir = path.join(OUTPUT_IMG_DIR, job.product_code);
        if (!fs.existsSync(productImgDir)) fs.mkdirSync(productImgDir, { recursive: true });

        // --- LẤY FEATURE ID CỦA SẢN PHẨM ---
        const prodRes = await client.query("SELECT feature_id FROM products WHERE id = $1", [job.product_id]);
        const featureIds = prodRes.rows[0]?.feature_id ? [prodRes.rows[0].feature_id] : [];

        // ==========================================
        // BƯỚC 1: TẢI ẢNH MẪU LÊN (CHỈ CHẠY 1 LẦN)
        // ==========================================
        console.log(`\n👉 BƯỚC 1: Đang tải ảnh Reference mẫu (${inputImagePath}) lên Workspace...`);
        await flowActions.uploadInitialMultipleImage(page, inputImagePath);

        // ==========================================
        // BƯỚC 2: VÒNG LẶP RENDER
        // ==========================================
        for (let i = 1; i <= loopCount; i++) {
            console.log(`\n------------------------------------------`);
            console.log(`🔄 ĐANG CHẠY VÒNG LẶP THỨ ${i}/${loopCount}`);
            console.log(`------------------------------------------`);

            // 1. Sinh Prompt từ DB
            console.log('🎲 Đang tạo mới kịch bản Prompt...');
            const dataRandom = await promptBuilder.generateFromDB(client, job.concept_id, featureIds);
            const promptText = promptBuilder.buildPromptText(dataRandom.imageTemplateText, dataRandom, 'image');

            console.log(`• Concept:     [${dataRandom.conceptName}]`);
            console.log(`• Background:  ${dataRandom.selectedBgName}`);
            if (dataRandom.selectedUpperBody) console.log(`• Thân trên:   ${dataRandom.selectedUpperBody}`);
            
            // 2. Gắn ảnh vào câu lệnh & Điền Prompt
            // Lưu ý: Đã sửa thành flowActions.addUploadedTileToPrompt để tránh lỗi devFuncs is not defined
            const safeRefTileId = await flowActions.addUploadedTileToPrompt(page); 
            await flowActions.configureAndFillImagePrompt(page, promptText);

            // 3. Gửi lệnh tạo ảnh
            await flowActions.submitPrompt(page);

            // 4. Download & Delete
            const paddedLoopNumber = String(i).padStart(3, '0');
            const getFilePathCallback = (downloadIndex) => {
                // Tên file: SP001_job12_loop001_sub1.jpg
                const baseNameForThisLoop = `${job.product_code}_job${job.id}_loop${paddedLoopNumber}_sub${downloadIndex}`;
                return getUniqueFilePath(productImgDir, baseNameForThisLoop, '.jpg');
            };

            console.log(`⏳ Đang chờ ảnh render và tiến hành tải xuống...`);
            await flowActions.downloadAndDeleteImages(page, getFilePathCallback, 4, 180000, safeRefTileId);
            
            console.log(`🎉 Hoàn tất trọn vẹn vòng lặp thứ ${i}!`);
            await page.waitForTimeout(2000); 
        }

        console.log('\n🔄 Đang F5 dọn dẹp UI để chuẩn bị cho Job tiếp theo...');
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(3000); 

        // Đánh dấu thành công
        await client.query("UPDATE generation_jobs SET status = 'success', updated_at = NOW() WHERE id = $1", [job.id]);
        console.log(`✅ [SUCCESS] Hoàn thành Job Ảnh ${job.id}`);

    } catch (error) {
        console.error(`❌ [ERROR] Job ${job.id}:`, error.message);
        await client.query("UPDATE generation_jobs SET status = 'failed', error_log = $1, updated_at = NOW() WHERE id = $2", [error.message, job.id]);
    } finally {
        if (browser) {
            await browser.close().catch(() => {});
        }
    }
}

// ==========================================
// CHẠY THỬ VỚI DATA GIẢ (MOCK DATA)
// ==========================================
async function runMockTest() {
    await client.connect();
    console.log("👷 Đã kết nối Database. Bắt đầu luồng Test với Mock Data...");

    // Object Mock Data của bạn. 
    // Bổ sung thêm trường `product_code` vì logic bên trong cần biến này để tạo thư mục chứa ảnh.
    const mockJob = {
        id: 4,
        product_id: 2,
        product_code: "SP_MOCK_TEST", 
        job_type: "image",
        concept_id: 2,
        status: "failed",
        retry_count: 0,
        error_log: "flowActions.downloadLatestImages is not a function",
        created_at: "2026-06-24T03:40:12.800Z",
        updated_at: "2026-06-24T03:40:29.471Z",
        loop_count: 10
    };

    try {
        await processJob(mockJob);
    } catch (err) {
        console.error("Lỗi trong quá trình chạy Mock Test:", err);
    } finally {
        console.log("🔌 Chạy xong Mock Data, đang ngắt kết nối Database...");
        await client.end();
    }
}

// Khởi chạy Worker giả lập
if (!fs.existsSync(OUTPUT_IMG_DIR)) fs.mkdirSync(OUTPUT_IMG_DIR, { recursive: true });
runMockTest();