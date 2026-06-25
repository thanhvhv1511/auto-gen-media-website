const { chromium } = require('playwright');
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const http = require('http'); 

// Gọi các module hành động và prompt
const flowActions = require('./actions/flowActions');
// Nếu bạn tách hàm addUploadedTileToPrompt sang file devFuncs thì require ở đây. 
// Dưới đây mình giả định các hàm này đã được gom chung vào flowActions cho gọn.
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
const CHROME_WS_ENDPOINT = process.env.CHROME_WS_ENDPOINT || 'http://host.docker.internal:9522';

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
    const loopCount = job.loop_count || 5;

    console.log(`\n==========================================`);
    console.log(`🚀 BẮT ĐẦU JOB ẢNH ID: ${job.id} | SP: ${job.product_code} | SỐ VÒNG: ${loopCount}`);
    console.log(`==========================================`);
    
    await client.query("UPDATE generation_jobs SET status = 'processing', updated_at = NOW() WHERE id = $1", [job.id]);

    let browser;
    try {
        // --- GIẢI PHÁP HTTP LÕI BẮT TOKEN CHROME ---
        let endpoint = CHROME_WS_ENDPOINT;
        let cdpPort = 9522; 
        
        if (endpoint.startsWith('http')) {
            console.log(`🔍 Đang dùng HTTP Bypass để dò Token WebSocket của Chrome...`);
            const targetHost = endpoint.includes('host.docker.internal') ? 'host.docker.internal' : endpoint.split('://')[1].split(':')[0];
            cdpPort = endpoint.split(':')[2] ? endpoint.split(':')[2].replace(/\//g, '') : 9522;

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
        if (mediaRes.rows.length === 0) throw new Error("Không tìm thấy ảnh gốc đầu vào.");
        const inputImagePath = mediaRes.rows[0].file_path;

        // Tạo thư mục gom theo mã sản phẩm
        const productImgDir = path.join(OUTPUT_IMG_DIR, job.product_code);
        if (!fs.existsSync(productImgDir)) fs.mkdirSync(productImgDir, { recursive: true });

        // --- LẤY FEATURE ID CỦA SẢN PHẨM ---
        const prodRes = await client.query("SELECT feature_id FROM products WHERE id = $1", [job.product_id]);
        const featureIds = prodRes.rows[0]?.feature_id ? [prodRes.rows[0].feature_id] : [];

        // ==========================================
        // BƯỚC 1: TẢI ẢNH MẪU LÊN (CHỈ CHẠY 1 LẦN)
        // ==========================================
        console.log('\n👉 BƯỚC 1: Đang tải ảnh Reference mẫu lên Workspace...');
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
            // Sử dụng hàm addUploadedTileToPrompt từ file devFuncs (hoặc flowActions tùy bạn import)
            const safeRefTileId = await flowActions.addUploadedTileToPrompt(page); 
            await flowActions.configureAndFillImagePrompt(page, promptText);

            // 3. Gửi lệnh tạo ảnh
            await flowActions.submitPrompt(page);

            // 4. Download & Delete
            const paddedLoopNumber = String(i).padStart(3, '0');
            const getFilePathCallback = (downloadIndex) => {
                // Tên file: SP001_job12_loop001_sub1.jpg
                const baseNameForThisLoop = `${job.product_code}_job${job.id}_concept${job.concept_id}_sub${downloadIndex}`;
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
// VÒNG LẶP WORKER (POLLING DATABASE)
// ==========================================
async function workerLoop() {
    await client.connect();
    console.log("👷 Image Worker đã kết nối Database. Đang chờ Job Sinh Ảnh mới...");
    while (true) {
        try {
            // Thay thế câu SQL hiện tại của bạn thành:
            const res = await client.query(`
                SELECT j.id, j.product_id, j.job_type, j.prompt_text, j.concept_id, j.loop_count, p.product_code 
                FROM generation_jobs j
                JOIN products p ON j.product_id = p.id
                WHERE j.status = 'pending' AND j.job_type = 'image'
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

// Khởi chạy Worker
if (!fs.existsSync(OUTPUT_IMG_DIR)) fs.mkdirSync(OUTPUT_IMG_DIR, { recursive: true });
workerLoop();