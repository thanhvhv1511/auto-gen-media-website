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
const INPUT_DIR = path.join(STORAGE_DIR, 'input_images');
const OUTPUT_IMG_DIR = path.join(STORAGE_DIR, 'output_images');
// Đã xóa OUTPUT_VID_DIR vì luồng video chuyển đi nơi khác

const CHROME_WS_ENDPOINT = process.env.CHROME_WS_ENDPOINT || 'http://host.docker.internal:9522';

async function processJob(job) {
    console.log(`\n==========================================`);
    console.log(`🚀 BẮT ĐẦU JOB ẢNH ID: ${job.id} | SP: ${job.product_code}`);
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

        // --- XỬ LÝ SINH ẢNH ---
        const mediaRes = await client.query("SELECT file_path FROM media_assets WHERE job_id = $1 AND media_type = 'image_input' LIMIT 1", [job.id]);
        if (mediaRes.rows.length === 0) throw new Error("Không tìm thấy ảnh gốc đầu vào.");
        
        await flowActions.uploadInitialMultipleImage(page, mediaRes.rows[0].file_path);
        await flowActions.configureAndFillImagePrompt(page, job.prompt_text);
        await flowActions.submitPrompt(page);
        
        // Tạo thư mục gom theo mã sản phẩm
        const productImgDir = path.join(OUTPUT_IMG_DIR, job.product_code);
        if (!fs.existsSync(productImgDir)) fs.mkdirSync(productImgDir, { recursive: true });

        // Tải ảnh về thư mục của sản phẩm
        const downloadedFiles = await flowActions.downloadLatestImages(page, job.product_code, job.id, productImgDir);
        await flowActions.downloadAndDeleteImages(page, getFilePathCallback, 4, 180000, safeRefTileId);
        
        // Đổi tên file theo index để chống đè (vd: sp001_job12_1.jpg)
        downloadedFiles.forEach((oldFilename, index) => {
            const oldPath = path.join(productImgDir, oldFilename);
            const newFilename = `${job.product_code}_job${job.id}_${index + 1}.jpg`;
            const newPath = path.join(productImgDir, newFilename);
            
            if (fs.existsSync(oldPath)) {
                fs.renameSync(oldPath, newPath);
                console.log(`📸 Đã lưu ảnh: ${newFilename}`);
            }
        });

        console.log('🔄 Đang F5 dọn dẹp UI để chuẩn bị cho Job tiếp theo...');
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(3000); 

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

async function workerLoop() {
    await client.connect();
    console.log("👷 Image Worker đã kết nối Database. Đang chờ Job Sinh Ảnh mới...");
    while (true) {
        try {
            // Chỉ query những job có job_type là 'image'
            const res = await client.query(`
                SELECT j.id, j.product_id, j.job_type, j.prompt_text, p.product_code 
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

if (!fs.existsSync(OUTPUT_IMG_DIR)) fs.mkdirSync(OUTPUT_IMG_DIR, { recursive: true });
workerLoop();