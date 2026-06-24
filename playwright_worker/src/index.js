const { chromium } = require('playwright');
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const http = require('http'); // Đã thêm module http lõi
const flowActions = require('./actions/flowActions');

const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://root:rootpassword@db:5432/autoscript_media'
});

const STORAGE_DIR = '/storage';
const INPUT_DIR = path.join(STORAGE_DIR, 'input_images');
const OUTPUT_IMG_DIR = path.join(STORAGE_DIR, 'output_images');
const OUTPUT_VID_DIR = path.join(STORAGE_DIR, 'output_videos');

const CHROME_WS_ENDPOINT = process.env.CHROME_WS_ENDPOINT || 'http://host.docker.internal:9522';

async function processJob(job) {
    console.log(`\n==========================================`);
    console.log(`🚀 BẮT ĐẦU JOB ID: ${job.id} | TYPE: ${job.job_type.toUpperCase()} | SP: ${job.product_code}`);
    console.log(`==========================================`);
    
    await client.query("UPDATE generation_jobs SET status = 'processing', updated_at = NOW() WHERE id = $1", [job.id]);

    let browser;
    try {
        // --- GIẢI PHÁP ĐÓNG ĐINH: DÙNG HTTP LÕI ĐỂ BẮT TOKEN UUID TRÁNH LỖI 404 ---
        let endpoint = CHROME_WS_ENDPOINT;
        let cdpPort = 9522; // Khai báo port mặc định
        
        if (endpoint.startsWith('http')) {
            console.log(`🔍 Đang dùng HTTP Bypass để dò Token WebSocket của Chrome...`);
            const targetHost = endpoint.includes('host.docker.internal') ? 'host.docker.internal' : endpoint.split('://')[1].split(':')[0];
            cdpPort = endpoint.split(':')[2] ? endpoint.split(':')[2].replace(/\//g, '') : 9522;

            // Sử dụng module http lõi để ép buộc thay đổi Header, vượt mặt hệ thống bảo mật
            const wsUrl = await new Promise((resolve, reject) => {
                const req = http.request({
                    hostname: targetHost,
                    port: cdpPort,
                    path: '/json/version',
                    method: 'GET',
                    // BƠM THÊM PORT VÀO ĐÂY ĐỂ CHROME KHÔNG TRẢ VỀ URL BỊ THIẾU PORT
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

            // Thay localhost bằng tên miền của Docker
            endpoint = wsUrl.replace(/localhost|127\.0\.0\.1/, targetHost);
            console.log(`🎯 Bắt Token thành công! Endpoint thực tế: ${endpoint}`);
        }

        // Kết nối Playwright với endpoint đầy đủ Token và Port
        browser = await chromium.connectOverCDP(endpoint, {
            headers: {
                'Host': `localhost:${cdpPort}`
            }
        });
        
        const context = browser.contexts()[0];
        let page = context.pages().find(p => p.url().toLowerCase().includes('labs.google')) || context.pages()[0] || await context.newPage();

        // 1. Vào trang dự án
        page = await flowActions.handleProjectNavigation(page);

        // --- NHÁNH 1: XỬ LÝ SINH ẢNH ---
        if (job.job_type === 'image') {
            const mediaRes = await client.query("SELECT file_path FROM media_assets WHERE job_id = $1 AND media_type = 'image_input' LIMIT 1", [job.id]);
            if (mediaRes.rows.length === 0) throw new Error("Không tìm thấy ảnh gốc đầu vào.");
            
            await flowActions.uploadInitialMultipleImage(page, mediaRes.rows[0].file_path);
            await flowActions.configureAndFillImagePrompt(page, job.prompt_text);
            await flowActions.submitPrompt(page);
            
            const downloadedFiles = await flowActions.downloadLatestImages(page, job.product_code, job.id, OUTPUT_IMG_DIR);
            
            for (const filename of downloadedFiles) {
                const finalPath = path.join(OUTPUT_IMG_DIR, filename);
                await client.query("INSERT INTO media_assets (product_code, media_type, file_path, job_id) VALUES ($1, $2, $3, $4)", 
                    [job.product_code, 'image_output', finalPath, job.id]);
            }
        } 
        // --- NHÁNH 2: XỬ LÝ SINH VIDEO ---
        else if (job.job_type === 'video') {
            const initialVideoCount = await page.evaluate(() => document.querySelectorAll('video').length);
            
            await flowActions.addLatestTileToPrompt(page);
            await flowActions.configureAndFillVideoPrompt(page, job.prompt_text);
            await flowActions.submitPrompt(page);
            
            const productVidDir = path.join(OUTPUT_VID_DIR, job.product_code);
            if (!fs.existsSync(productVidDir)) fs.mkdirSync(productVidDir, { recursive: true });
            
            const targetVidPath = path.join(productVidDir, `${job.product_code}_${job.id}_01.mp4`);
            await flowActions.downloadLatestVideo(page, initialVideoCount, targetVidPath, 3);
            
            await client.query("INSERT INTO media_assets (product_code, media_type, file_path, job_id) VALUES ($1, $2, $3, $4)", 
                [job.product_code, 'video', targetVidPath, job.id]);
        }

        console.log('🔄 Đang F5 dọn dẹp UI để chuẩn bị cho Job tiếp theo...');
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(3000); 

        await client.query("UPDATE generation_jobs SET status = 'success', updated_at = NOW() WHERE id = $1", [job.id]);
        console.log(`✅ [SUCCESS] Hoàn thành Job ${job.id}`);

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
    console.log("👷 Worker đã kết nối Database. Đang chờ Job mới...");
    while (true) {
        try {
            const res = await client.query(`
                SELECT id, product_code, job_type, prompt_text 
                FROM generation_jobs 
                WHERE status = 'pending' 
                ORDER BY created_at ASC 
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
if (!fs.existsSync(OUTPUT_VID_DIR)) fs.mkdirSync(OUTPUT_VID_DIR, { recursive: true });
workerLoop();