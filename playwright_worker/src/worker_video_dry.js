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
// const CHROME_WS_ENDPOINT = process.env.CHROME_WS_ENDPOINT || 'http://host.docker.internal:9521';

async function processJob(job) {
    console.log(`\n==========================================`);
    console.log(`🧪 [DRY RUN] BẮT ĐẦU JOB VIDEO ID: ${job.id} | SP: ${job.product_code}`);
    console.log(`==========================================`);
    
    // Cập nhật trạng thái job sang processing như thật
    await client.query("UPDATE generation_jobs SET status = 'processing', updated_at = NOW() WHERE id = $1", [job.id]);

    try {
        // --- 1. LẤY DANH SÁCH ẢNH TẠM ---
        const productImgDir = path.join(OUTPUT_IMG_DIR, job.product_code);
        let filesToProcess = [];
        
        if (fs.existsSync(productImgDir)) {
            const subDirs = fs.readdirSync(productImgDir);
            for (const subDir of subDirs) {
                const conceptDirPath = path.join(productImgDir, subDir);
                if (fs.statSync(conceptDirPath).isDirectory()) {
                    const imgFiles = fs.readdirSync(conceptDirPath).filter(f => f.endsWith('.jpg') || f.endsWith('.png'));
                    for (const img of imgFiles) {
                        filesToProcess.push({
                            fileName: img,
                            fullPath: path.join(conceptDirPath, img)
                        });
                    }
                }
            }
        }

        if (filesToProcess.length > 0) {
            console.log(`🔍 [DRY RUN] Phát hiện thấy ${filesToProcess.length} ảnh tạm. Bắt đầu xử lý...`);
            console.log(`📝 [PROMPT VIDEO]: ${job.prompt_text}`);

            for (let i = 0; i < filesToProcess.length; i++) {
                const { fileName: file, fullPath: imageFilePath } = filesToProcess[i];
                console.log(`\n  🔄 [DRY RUN] Đang xử lý ảnh ${i + 1}/${filesToProcess.length}: ${file}`);

                // --- 2. PHÂN GIẢI MÃ SP VÀ CONCEPT TỪ TÊN FILE ---
                // Tên file mẫu: sp003_job19_concept-4_(3).jpg
                // Regex tìm: chuỗi đầu tiên trước dấu _, và số sau chữ concept-
                const regex = /^([a-zA-Z0-9]+)_job\d+_concept-(\d+)/;
                const match = file.match(regex);
                
                let parsedProductCode = job.product_code; // Fallback
                let parsedConceptId = 'unknown';

                if (match) {
                    parsedProductCode = match[1]; // Vd: sp003
                    parsedConceptId = match[2];   // Vd: 4
                    console.log(`  🎯 [PARSE] Bóc tách thành công -> Sản phẩm: ${parsedProductCode} | Concept: ${parsedConceptId}`);
                }

                // Tạo thư mục video xuất ra đồng bộ với cấu trúc ảnh (vd: output_videos/sp003/concept-4)
                const productVidDir = path.join(OUTPUT_VID_DIR, job.product_code, `concept-${parsedConceptId}`);
                if (!fs.existsSync(productVidDir)) fs.mkdirSync(productVidDir, { recursive: true });

                // Giả lập thời gian render
                console.log(`  ⏳ [DRY RUN] Đang render frame...`);
                await new Promise(resolve => setTimeout(resolve, 3000)); 

                // Tạo tên file video đầu ra
                const fileNameWithoutExt = path.parse(file).name;
                const targetVidPath = path.join(productVidDir, `${fileNameWithoutExt}_dryrun.mp4`);
                
                // Tạo file video ảo
                if (!fs.existsSync(targetVidPath)) {
                    fs.writeFileSync(targetVidPath, `MOCK_VIDEO_DATA_FOR_${file}`, 'utf-8');
                    console.log(`  🎬 [DRY RUN] Đã tạo video ảo: ${targetVidPath}`);
                }

                // Insert vào DB
                await client.query(
                    "INSERT INTO media_assets (product_id, media_type, file_path, job_id) VALUES ($1, $2, $3, $4)", 
                    [job.product_id, 'video', targetVidPath, job.id]
                );
                console.log(`  💾 [DRY RUN] Đã lưu DB Video Asset.`);

                // Xóa ảnh gốc
                if (fs.existsSync(imageFilePath)) {
                    fs.unlinkSync(imageFilePath);
                    console.log(`  🗑️ [CLEANUP] Đã xóa ảnh mồi: ${file}`);
                }
            }
        }

        // --- 3. DỌN DẸP THƯ MỤC TRỐNG CẤP 2 ---
        if (fs.existsSync(productImgDir)) {
            // Xóa các thư mục concept-X rỗng trước
            const subDirs = fs.readdirSync(productImgDir);
            for (const subDir of subDirs) {
                const conceptDirPath = path.join(productImgDir, subDir);
                if (fs.statSync(conceptDirPath).isDirectory()) {
                    if (fs.readdirSync(conceptDirPath).length === 0) {
                        fs.rmdirSync(conceptDirPath);
                        console.log(`  🧹 [CLEANUP] Đã xóa thư mục con rỗng: ${subDir}`);
                    }
                }
            }
            
            // Nếu thư mục gốc (sp003) không còn thư mục con nào nữa thì xóa nốt
            if (fs.readdirSync(productImgDir).length === 0) {
                fs.rmdirSync(productImgDir); 
                console.log(`\n🧹 [CLEANUP] Đã xóa thư mục rỗng của SP: ${job.product_code}`);
            } else {
                console.log(`\n⚠️ [CLEANUP] Thư mục ${job.product_code} vẫn còn chứa file/thư mục khác.`);
            }
        }

        // Cập nhật trạng thái job thành công
        await client.query("UPDATE generation_jobs SET status = 'success', updated_at = NOW() WHERE id = $1", [job.id]);
        console.log(`✅ [DRY RUN SUCCESS] Hoàn thành Job Video ${job.id}\n`);

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