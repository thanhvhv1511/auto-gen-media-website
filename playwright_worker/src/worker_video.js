const { chromium } = require('playwright');
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const http = require('http'); 
const flowActions = require('./actions/flowActions');

const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://root:rootpassword@db:5432/autoscript_media'
});

const STORAGE_DIR = '/storage';
const OUTPUT_IMG_DIR = path.join(STORAGE_DIR, 'output_images');
const OUTPUT_VID_DIR = path.join(STORAGE_DIR, 'output_videos');

const CHROME_WS_ENDPOINT = process.env.CHROME_WS_ENDPOINT || 'http://host.docker.internal:9522';

async function processJob(job) {
    console.log(`\n==========================================`);
    console.log(`🚀 BẮT ĐẦU JOB VIDEO ID: ${job.id} | SP: ${job.product_code}`);
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

        // --- XỬ LÝ QUÉT ẢNH TẠM LÀM TƯ LIỆU ĐẦU VÀO CHO VIDEO ---
        const productImgDir = path.join(OUTPUT_IMG_DIR, job.product_code);
        if (fs.existsSync(productImgDir)) {
            const files = fs.readdirSync(productImgDir).filter(f => f.endsWith('.jpg') || f.endsWith('.png'));
            if (files.length > 0) {
                // Thường lấy tấm ảnh đầu tiên (_1.jpg) làm tư liệu nạp vào prompt sinh video
                const inputImgPath = path.join(productImgDir, files[0]);
                console.log(`🔍 Phát hiện ${files.length} ảnh tạm. Dùng làm đầu vào video: ${inputImgPath}`);
                
                // Kích hoạt hàm nạp tư liệu nếu kịch bản của ông yêu cầu ảnh nền đầu vào:
                // await flowActions.uploadInitialMultipleImage(page, inputImgPath);
            }
        }

        // --- XỬ LÝ SINH VIDEO ---
        const initialVideoCount = await page.evaluate(() => document.querySelectorAll('video').length);
        
        await flowActions.addLatestTileToPrompt(page);
        await flowActions.configureAndFillVideoPrompt(page, job.prompt_text);
        await flowActions.submitPrompt(page);
        
        // Tạo thư mục lưu video theo mã sản phẩm
        const productVidDir = path.join(OUTPUT_VID_DIR, job.product_code);
        if (!fs.existsSync(productVidDir)) fs.mkdirSync(productVidDir, { recursive: true });
        
        const targetVidPath = path.join(productVidDir, `${job.product_code}_${job.id}_01.mp4`);
        await flowActions.downloadLatestVideo(page, initialVideoCount, targetVidPath, 3);
        
        // Lưu video thành phẩm vào DB bảng media_assets liên kết qua product_id số nguyên
        await client.query("INSERT INTO media_assets (product_id, media_type, file_path, job_id) VALUES ($1, $2, $3, $4)", 
            [job.product_id, 'video', targetVidPath, job.id]);

        // 🔥 [CLEANUP LOCAL] Xóa sạch thư mục chứa ảnh tạm sau khi video kết xuất thành công
        if (fs.existsSync(productImgDir)) {
            fs.rmSync(productImgDir, { recursive: true, force: true });
            console.log(`🧹 [CLEANUP] Đã xóa sạch thư mục ảnh tạm của SP: ${job.product_code}`);
        }

        console.log('🔄 Đang F5 dọn dẹp UI để chuẩn bị cho Job tiếp theo...');
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(3000); 

        await client.query("UPDATE generation_jobs SET status = 'success', updated_at = NOW() WHERE id = $1", [job.id]);
        console.log(`✅ [SUCCESS] Hoàn thành Job Video ${job.id}`);

    } catch (error) {
        console.error(`❌ [ERROR] Job ${job.id}:`, error.message);
        await client.query("UPDATE generation_jobs SET status = 'failed', error_log = $1, updated_at = NOW() WHERE id = $2", [error.message, job.id]);
    } finally {
        if (browser) {
            await browser.close().catch(() => {});
        }
    }
}

async function workerLoop() {
    await client.connect();
    console.log("👷 Video Worker đã kết nối Database. Đang chờ Job Sinh Video mới...");
    while (true) {
        try {
            // Chỉ query những job có job_type là 'video'
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