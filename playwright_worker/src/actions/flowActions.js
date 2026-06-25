const config = require('./config');
const path = require('path');
let referenceTileId = null;
const DELAY_SHORT = 500;
/**
 * Kiểm tra trạng thái URL hiện tại và điều hướng vào workspace
 */
async function handleProjectNavigation(page) {
    const currentUrl = page.url();
    console.log(`🌐 URL hiện tại: ${currentUrl}`);

    if (currentUrl.includes('/tools/flow/project/')) {
        console.log('⚡ Đang ở sẵn trong dự án. Bỏ qua bước điều hướng và tạo mới.');
        return page;
    } 
    
    if (!currentUrl.includes('/tools/flow')) {
        console.log('🌐 Đang điều hướng tới Google Labs Flow...');
        await page.goto('https://labs.google/fx/vi/tools/flow', { waitUntil: 'domcontentloaded' });
    } else {
        console.log('⚡ Đang ở sẵn trang chủ Flow, không cần load lại trang.');
    }

    console.log('👉 Đang tìm và click nút "Dự án mới"...');
    const newProjectBtn = page.locator('button:has-text("Dự án mới"), [role="button"]:has-text("Dự án mới")').first();
    await newProjectBtn.waitFor({ state: 'visible', timeout: 15000 });
    await newProjectBtn.click();
    console.log('🎉 Đã click thành công nút "Dự án mới"!');
    
    return page;
}

/**
 * Đính kèm hình ảnh từ máy tính cục bộ lên workspace
 */
async function uploadInitialImage(page) {
    try {
        // Giải phóng không gian, đóng các menu dropdown còn kẹt
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500); 
    } catch (e) {}

    console.log('👉 1. Đang mở menu và đính kèm ảnh...');
    const plusBtn = page.locator('button:has(i:text-is("add_2"))').first();
    await plusBtn.waitFor({ state: 'visible', timeout: 5000 });
    await plusBtn.click();
    
    const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        page.locator('text="Tải nội dung nghe nhìn lên"').last().click()
    ]);
    
    await fileChooser.setFiles(config.TEST_IMAGE);
    console.log(`   ⏳ Đợi ${config.DELAY_LONG / 1000}s để tệp tin ảnh load xong...`);
    await page.waitForTimeout(config.DELAY_LONG);
    await page.keyboard.press('Escape');
}

/**
 * Thiết lập cấu hình chuyên sâu và điền prompt tạo Ảnh (Image Mode)
 */
async function configureAndFillImagePrompt(page, promptText) {
    console.log('👉 2. Điền prompt tạo ảnh...');
    const chatBox = page.locator('div[contenteditable="true"][role="textbox"]').first();
    await chatBox.waitFor({ state: 'visible', timeout: 5000 });
    await chatBox.click();
    await chatBox.fill(promptText); 
    await page.waitForTimeout(config.DELAY_MEDIUM);

    console.log('👉 Đang tìm và click nút cấu hình mô hình...');
    const configBtn = page.locator('button[aria-haspopup="menu"]').filter({ hasText: /Banana|Nano|Video/i }).first();
    await configBtn.waitFor({ state: 'visible', timeout: 10000 });
    await configBtn.click({ force: true });
    
    console.log('⏳ Đang chờ menu cấu hình bung ra...');
    const menuContainer = page.locator('[role="menu"], [data-radix-menu-content]').last();
    await menuContainer.waitFor({ state: 'visible', timeout: 10000 });
    
    console.log('👉 Chọn tab Hình ảnh...');
    await menuContainer.locator('button[role="tab"]:has-text("Hình ảnh")').first().click();
    await page.waitForTimeout(100);

    console.log('👉 Chọn khung hình dọc 9:16...');
    await menuContainer.locator('button[role="tab"]:has-text("9:16")').first().click();
    await page.waitForTimeout(100);

    console.log('👉 Chọn số lượng x4...');
    await menuContainer.locator('button[role="tab"]:text-is("x4")').first().click();
    await page.waitForTimeout(100);

    console.log(`👉 Kiểm tra và chọn mô hình: ${config.TARGET_MODEL}...`);
    const modelDropdown = menuContainer.locator('button[aria-haspopup="menu"]').first();
    if (await modelDropdown.isVisible()) {
        const currentModelText = await modelDropdown.innerText();
        if (!currentModelText.includes(config.TARGET_MODEL)) {
            await modelDropdown.click();
            await page.waitForTimeout(100);
            await page.locator('button, [role="menuitem"], [role="option"]').filter({ hasText: config.TARGET_MODEL }).last().click();
        }
    }
    await page.waitForTimeout(100);
    
    console.log('👉 Đang đóng menu...');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
}

/**
 * Định vị thẻ Tile mới nhất ở index 0 và kích hoạt hành động "Thêm vào câu lệnh"
 */
async function addLatestTileToPrompt(page) {
    try {
        // Giải phóng không gian, đóng các menu dropdown còn kẹt
        await page.keyboard.press('Escape');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500); 
    } catch (e) {}
    console.log('👉 Đang giám sát ô phần tử mới nhất để Thêm vào câu lệnh...');
    const tileBoxPrompt = page.locator('div[data-testid="virtuoso-item-list"] > div[data-item-index="0"] div[data-tile-id]').first();
    const imgPrompt = tileBoxPrompt.locator('img[alt="Hình ảnh được tạo"]');
    
    await imgPrompt.waitFor({ state: 'visible', timeout: 120000 });
    await page.waitForTimeout(config.DELAY_SHORT); 

    await tileBoxPrompt.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await tileBoxPrompt.hover();
    await page.waitForTimeout(500);
    await imgPrompt.hover({ force: true });
    await page.waitForTimeout(config.DELAY_SHORT); 

    console.log('   Đang định vị nút 3 chấm...');
    const visibleToolbar = page.locator('div[role="toolbar"]').filter({ state: 'visible' }).first();
    const threeDotsBtn = visibleToolbar.locator('button[id^="radix-"]').filter({ has: page.locator('i:text-is("more_vert")') }).first();
    
    await threeDotsBtn.waitFor({ state: 'visible', timeout: 10000 });
    await threeDotsBtn.hover({ force: true });
    await page.waitForTimeout(config.DELAY_SHORT); 
    await threeDotsBtn.click({ force: true });
    await page.waitForTimeout(config.DELAY_SHORT); 

    console.log('   Kích hoạt: "Thêm vào câu lệnh"...');
    await page.locator('text="Thêm vào câu lệnh"').last().click({ force: true });
    await page.waitForTimeout(config.DELAY_SHORT);
}

/**
 * Nhấp nút gửi câu lệnh kích hoạt AI xử lý thế hệ tài nguyên tiếp theo
 */
async function submitPrompt(page) {
    console.log('👉 Đang bấm nút Gửi để AI sinh nội dung...');
    const sendBtn = page.locator('button:has(i:text-is("arrow_forward"))').first();
    await sendBtn.waitFor({ state: 'visible', timeout: 5000 });
    await sendBtn.click();
    await page.waitForTimeout(config.DELAY_LONG);
}

/**
 * Thiết lập cấu hình nâng cao và nhập prompt tạo Video (Video Mode) với Omni Flash
 */
async function configureAndFillVideoPrompt(page, promptText) {
    console.log('👉 Điền prompt tạo cấu trúc Video...');
    const chatBox = page.locator('div[contenteditable="true"][role="textbox"]').first();
    await chatBox.waitFor({ state: 'visible', timeout: 5000 });
    await chatBox.click();
    await chatBox.fill(promptText); 
    await page.waitForTimeout(config.DELAY_SHORT);

    console.log('👉 Đang tìm và mở menu cấu hình...');
    const configBtn = page.locator('button[aria-haspopup="menu"]').filter({ hasText: /Banana|Nano|Video/i }).first();
    await configBtn.waitFor({ state: 'visible', timeout: 10000 });
    await configBtn.click({ force: true });
    
    const menuContainer = page.locator('[role="menu"], [data-radix-menu-content]').last();
    await menuContainer.waitFor({ state: 'visible', timeout: 10000 });

    console.log('👉 Chọn tab Video...');
    await menuContainer.locator('button[role="tab"]:has-text("Video")').first().click();
    await page.waitForTimeout(100);

    console.log('👉 Chọn phân loại Thành phần...');
    await menuContainer.locator('button[role="tab"]:has-text("Thành phần")').first().click();
    await page.waitForTimeout(100);

    console.log('👉 Chọn khung hình dọc 9:16...');
    await menuContainer.locator('button[role="tab"]:has-text("9:16")').first().click();
    await page.waitForTimeout(100);

    console.log('👉 Chọn số lượng 1x...');
    await menuContainer.locator('button[role="tab"]:text-is("1x")').first().click();
    await page.waitForTimeout(100);

    console.log('👉 Cấu hình chọn mô hình Omni Flash...');
    const modelDropdown = menuContainer.locator('button[aria-haspopup="menu"]').first();
    if (await modelDropdown.isVisible()) {
        const currentModelText = await modelDropdown.innerText();
        if (!currentModelText.includes("Omni Flash")) {
            await modelDropdown.click();
            await page.waitForTimeout(100);
            await page.locator('button, [role="menuitem"], [role="option"]').filter({ hasText: 'Omni Flash' }).last().click();
        }
    }
    await page.waitForTimeout(100);

    console.log('👉 Chọn giới hạn thời lượng 10s...');
    await menuContainer.locator('button[role="tab"]:has-text("10s")').first().click();
    await page.waitForTimeout(100);
    
    console.log('👉 Đang đóng menu cấu hình...');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
}

/**
 * Chờ đợi render Video hoàn chỉnh, xử lý view hiển thị và tải tệp tin với cơ chế thử lại tối đa 3 lần
 * @param {Object} page - Đối tượng Page của Playwright
 * @param {number} initialVideoCount - Số lượng video trước khi nhấn gửi
 * @param {string} targetPath - Đường dẫn lưu file
 * @param {number} maxRetries - Số lần thử lại tối đa (Mặc định là 3)
 */
async function downloadLatestVideo(page, initialVideoCount, targetPath, maxRetries = 3) {
    console.log('👉 8. Đang giám sát trạng thái render tệp tin video mới...');
    
    // Bước 8.1: Chờ video mới xuất hiện trên DOM (Chỉ cần chờ 1 lần duy nhất vì đây là thời gian AI xử lý)
    try {
        await page.waitForFunction(
            (old_count) => document.querySelectorAll('video').length > old_count,
            initialVideoCount,
            { timeout: 300000 } // Đợi tối đa 5 phút cho AI tạo video
        );
        console.log('✅ Video kết quả đã xuất hiện, bắt đầu tiến trình tải...');
    } catch (error) {
        throw new Error(`Quá thời gian 5 phút nhưng không thấy video mới xuất hiện: ${error.message}`);
    }
    await page.waitForTimeout(config.DELAY_MEDIUM);
    // Bước 8.2: Vòng lặp thử lại cho công đoạn click tương tác và tải file xuống
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`   📥 [Lần thử ${attempt}/${maxRetries}] Tiến hành tương tác tải xuống...`);

            const tileBoxVideo = page.locator('div[data-testid="virtuoso-item-list"] > div[data-item-index="0"] div[data-tile-id]').first();
            
            // Ép phần tử hiển thị để trình duyệt kích hoạt render
            await tileBoxVideo.scrollIntoViewIfNeeded();
            await page.waitForTimeout(config.DELAY_SHORT);
            await tileBoxVideo.hover({ force: true });

            // Tìm nút 3 chấm
            const visibleToolbarVideo = page.locator('div[role="toolbar"]').filter({ state: 'visible' }).first();
            const threeDotsBtnVideo = visibleToolbarVideo.locator('button[id^="radix-"]').filter({ has: page.locator('i:text-is("more_vert")') }).first();
            
            await threeDotsBtnVideo.waitFor({ state: 'visible', timeout: 10000 });
            await threeDotsBtnVideo.hover({ force: true });
            await page.waitForTimeout(config.DELAY_SHORT); 
            await threeDotsBtnVideo.click({ force: true });
            await page.waitForTimeout(config.DELAY_SHORT);

            console.log('   👉 Mở rộng menu con "Tải xuống"...');
            await page.locator('text="Tải xuống"').last().hover();
            await page.waitForTimeout(config.DELAY_SHORT);

            console.log(`   👉 Thực hiện lệnh kích hoạt tải phiên bản 1080p...`);
            const resolution1080 = page.getByText(/1080/i).last();
            await resolution1080.waitFor({ state: 'visible', timeout: 5000 });

            // Đồng bộ hóa sự kiện click và bắt sự kiện download của hệ thống
            const [download] = await Promise.all([
                page.waitForEvent('download', { timeout: 180000 }), // Giới hạn đợi tải file 3 phút/lần
                resolution1080.click({ force: true })           
            ]);

            // Lưu file thành công
            await download.saveAs(targetPath);
            console.log(`   ✅ Tải xuống thành công ở lần thử thứ ${attempt}!`);
            return; // Thoát khỏi hàm ngay lập tức khi tải thành công
            
        } catch (error) {
            console.error(`   ⚠️ Lần thử ${attempt} thất bại với lỗi: ${error.message}`);
            
            // ĐỘNG TÁC QUAN TRỌNG: Nhấn Escape để đóng các menu đang bị treo/mở dở
            // Giúp giao diện sạch sẽ trước khi bước vào lần thử lại (attempt) tiếp theo
            await page.keyboard.press('Escape');
            await page.waitForTimeout(config.DELAY_MEDIUM); // Chờ 2s để giao diện ổn định lại

            // Nếu đã chạm mốc giới hạn 3 lần thử mà vẫn lỗi thì mới ném lỗi ra ngoài để vòng lặp lớn (index.js) xử lý
            if (attempt === maxRetries) {
                throw new Error(`Đã thử tải xuống tổng cộng ${maxRetries} lần nhưng đều thất bại.`);
            }
        }
    }
}

/**
 * Đính kèm hình ảnh từ máy tính cục bộ lên workspace
 * @param {Object} page - Playwright page
 * @param {string} targetImagePath - Đường dẫn file ảnh động muốn tải lên
 */
async function uploadInitialMultipleImage(page, targetImagePath) {
    try {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500); 
    } catch (e) {}

    console.log(`👉 1. Đang mở menu và đính kèm ảnh: ${path.basename(targetImagePath)}...`);
    const plusBtn = page.locator('button:has(i:text-is("add_2"))').first();
    await plusBtn.waitFor({ state: 'visible', timeout: 5000 });
    await plusBtn.click();
    
    const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        page.locator('text="Tải nội dung nghe nhìn lên"').last().click()
    ]);
    
    // TRUYỀN BIẾN MỚI VÀO ĐÂY
    await fileChooser.setFiles(targetImagePath);
    console.log(`   ⏳ Đợi tệp tin ảnh load xong...`);
    await page.waitForTimeout(config.DELAY_LONG);
    await page.keyboard.press('Escape');
}

async function downloadAndDeleteImages(page, getFilePathCallback, expectedCount = 4, maxTimeout = 180000, ignoreTileId = null) {
    console.log(`👉 Đang giám sát khung kết quả, sẵn sàng tải và dọn dẹp ${expectedCount} ảnh...`);
    
    // Tăng vùng quét lên +1 vì có thể quét trúng ảnh gốc (bị skip)
    const scanLimit = ignoreTileId ? expectedCount + 1 : expectedCount;

    const startTime = Date.now();
    let downloadedCount = 0; 

    // Vòng lặp radar quét liên tục
    while (Date.now() - startTime < maxTimeout) {
        // Đủ KPI thì thoát
        if (downloadedCount >= expectedCount) {
            console.log(`✅ Đã tải và dọn dẹp trọn vẹn ${expectedCount} khung ảnh!`);
            return true; 
        }

        // Quét các ô đầu tiên trên cùng
        for (let j = 0; j < scanLimit; j++) {
            if (downloadedCount >= expectedCount) break;

            // Quét tìm div có data-tile-id
            const currentTile = page.locator('div[data-tile-id]').nth(j);
            if (await currentTile.count() === 0) continue;

            // Lấy ID của khung hiện tại
            const tileId = await currentTile.getAttribute('data-tile-id');

            // 🛡️ BƯỚC KIỂM TRA QUAN TRỌNG: Nếu trùng ID ảnh mẫu thì bỏ qua ngay lập tức
            if (ignoreTileId && tileId === ignoreTileId) {
                continue;
            }

            const imgElement = currentTile.locator('img[alt="Hình ảnh được tạo"]');
            
            // Nếu ảnh đã render và hiển thị
            if (await imgElement.count() > 0 && await imgElement.isVisible()) {
                console.log(`\n⏳ Ảnh ở Khung (ID: ${tileId}) đã nặn xong! Tiến hành tải...`);
                
                // 🎯 Tạo locator cố định theo ID, bất chấp DOM bị xô lệch
                const exactTile = page.locator(`div[data-tile-id="${tileId}"]`).first();
                const exactImg = exactTile.locator('img[alt="Hình ảnh được tạo"]').first();

                try {
                    // Giải phóng không gian, đóng các menu dropdown còn kẹt
                    await page.keyboard.press('Escape');
                    await page.keyboard.press('Escape');
                    await page.waitForTimeout(500); 
                } catch (e) {}

                try {
                    // --- HÀNH ĐỘNG 1: TẢI XUỐNG ---
                    await exactTile.scrollIntoViewIfNeeded();
                    await page.waitForTimeout(500);
                    await exactTile.hover();
                    await page.waitForTimeout(500);
                    await exactImg.hover({ force: true });
                    await page.waitForTimeout(500);

                    const visibleToolbar = page.locator('div[role="toolbar"]').filter({ state: 'visible' }).first();
                    const threeDotsBtn = visibleToolbar.locator('button[id^="radix-"]').filter({ has: page.locator('i:text-is("more_vert")') }).first();
                    
                    await threeDotsBtn.waitFor({ state: 'visible', timeout: 5000 });
                    await threeDotsBtn.click({ force: true });
                    await page.waitForTimeout(500);

                    await page.locator('text="Tải xuống"').last().hover();
                    await page.waitForTimeout(500);

                    const resolution2K = page.getByText('1K', { exact: true }).last();
                    await resolution2K.waitFor({ state: 'visible', timeout: 5000 });

                    // Lấy đường dẫn file thông qua callback truyền từ file chính
                    const finalFilePath = getFilePathCallback(downloadedCount);

                    const [download] = await Promise.all([
                        page.waitForEvent('download', { timeout: 30000 }), 
                        resolution2K.click()           
                    ]);

                    await download.saveAs(finalFilePath);
                    console.log(`   ✅ Đã tải thành công -> 📁 ${finalFilePath}`);
                    
                    downloadedCount++;

                    // Đóng Toast thông báo nếu có
                    try {
                        const toastCloseBtn = page.locator('li[data-sonner-toast] button:has-text("Đóng")').first();
                        await toastCloseBtn.waitFor({ state: 'visible', timeout: 3000 });
                        await toastCloseBtn.click();
                        await page.waitForTimeout(500);
                    } catch (e) {}

                    // --- HÀNH ĐỘNG 2: XÓA ẢNH ĐỂ DỌN CHỖ ---
                    console.log(`   🗑️ Đang tiến hành xóa ảnh...`);
                    // Hover lại vào ĐÚNG ID ảnh vừa tải
                    await exactImg.hover({ force: true });
                    await page.waitForTimeout(500);
                    
                    // Quét lại Toolbar mới do cái cũ đã bị đóng
                    const newVisibleToolbar = page.locator('div[role="toolbar"]').filter({ state: 'visible' }).first();
                    const newThreeDotsBtn = newVisibleToolbar.locator('button[id^="radix-"]').filter({ has: page.locator('i:text-is("more_vert")') }).first();
                    
                    await newThreeDotsBtn.waitFor({ state: 'visible', timeout: 5000 });
                    await newThreeDotsBtn.click({ force: true });
                    await page.waitForTimeout(500);

                    const deleteBtn = page.locator('text="Xoá"').or(page.locator('text="Chuyển vào thùng rác"')).last();
                    await deleteBtn.waitFor({ state: 'visible', timeout: 5000 });
                    await deleteBtn.click({ force: true });
                    console.log(`   ✅ Đã phi tang ảnh vào thùng rác!`);
                    
                    // Chờ DOM cập nhật và ảnh dưới bị đẩy lên
                    await page.waitForTimeout(1000); 

                    // Break vòng lặp FOR để radar quay lại quét từ Khung đầu tiên
                    break; 

                } catch (error) {
                    console.error(`   ⚠️ Tương tác tải/xóa bị lỗi: ${error.message}`);
                    console.log('   -> Sẽ thử lại ở vòng quét tiếp theo.');
                    await page.keyboard.press('Escape');
                    await page.waitForTimeout(1000);
                }
            }
        }

        // Nghỉ ngơi giữa các lần quét radar
        await page.waitForTimeout(1500);
    }

    // Nếu hết giờ mà chưa tải đủ KPI
    if (downloadedCount < expectedCount) {
        console.log('\n⏰ ĐÃ HẾT TIMEOUT!');
        console.log(`Chỉ dọn dẹp được ${downloadedCount}/${expectedCount} ảnh. Chuyển sang tiến trình khác...`);
        await page.keyboard.press('Escape'); 
        return false;
    }
}

/**
 * Hàm Tải và Xóa ảnh liên tục (Quét Radar, tải xong xóa ngay)
 * @param {Object} page - Đối tượng Page của Playwright
 * @param {Function} getFilePathCallback - Hàm callback sinh tên file động
 * @param {number} expectedCount - Số lượng ảnh cần tải (Mặc định: 4)
 * @param {number} maxTimeout - Thời gian đợi tối đa (Mặc định: 3 phút)
 * @param {string} ignoreTileId - ID của ảnh gốc không được phép tải/xóa
 */
async function downloadAndDeleteImages(page, getFilePathCallback, expectedCount = 4, maxTimeout = 180000, ignoreTileId = null) {
    console.log(`👉 Đang giám sát khung kết quả, sẵn sàng tải và dọn dẹp ${expectedCount} ảnh...`);
    
    // Tăng vùng quét lên +1 vì có thể quét trúng ảnh gốc (bị skip)
    const scanLimit = ignoreTileId ? expectedCount + 1 : expectedCount;

    const startTime = Date.now();
    let downloadedCount = 0; 

    // Vòng lặp radar quét liên tục
    while (Date.now() - startTime < maxTimeout) {
        // Đủ KPI thì thoát
        if (downloadedCount >= expectedCount) {
            console.log(`✅ Đã tải và dọn dẹp trọn vẹn ${expectedCount} khung ảnh!`);
            return true; 
        }

        // Quét các ô đầu tiên trên cùng
        for (let j = 0; j < scanLimit; j++) {
            if (downloadedCount >= expectedCount) break;

            // Quét tìm div có data-tile-id
            const currentTile = page.locator('div[data-tile-id]').nth(j);
            if (await currentTile.count() === 0) continue;

            // Lấy ID của khung hiện tại
            const tileId = await currentTile.getAttribute('data-tile-id');

            // 🛡️ BƯỚC KIỂM TRA QUAN TRỌNG: Nếu trùng ID ảnh mẫu thì bỏ qua ngay lập tức
            if (ignoreTileId && tileId === ignoreTileId) {
                continue;
            }

            const imgElement = currentTile.locator('img[alt="Hình ảnh được tạo"]');
            
            // Nếu ảnh đã render và hiển thị
            if (await imgElement.count() > 0 && await imgElement.isVisible()) {
                console.log(`\n⏳ Ảnh ở Khung (ID: ${tileId}) đã nặn xong! Tiến hành tải...`);
                
                // 🎯 Tạo locator cố định theo ID, bất chấp DOM bị xô lệch
                const exactTile = page.locator(`div[data-tile-id="${tileId}"]`).first();
                const exactImg = exactTile.locator('img[alt="Hình ảnh được tạo"]').first();

                try {
                    // Giải phóng không gian, đóng các menu dropdown còn kẹt
                    await page.keyboard.press('Escape');
                    await page.keyboard.press('Escape');
                    await page.waitForTimeout(500); 
                } catch (e) {}

                try {
                    // --- HÀNH ĐỘNG 1: TẢI XUỐNG ---
                    await exactTile.scrollIntoViewIfNeeded();
                    await page.waitForTimeout(500);
                    await exactTile.hover();
                    await page.waitForTimeout(500);
                    await exactImg.hover({ force: true });
                    await page.waitForTimeout(500);

                    const visibleToolbar = page.locator('div[role="toolbar"]').filter({ state: 'visible' }).first();
                    const threeDotsBtn = visibleToolbar.locator('button[id^="radix-"]').filter({ has: page.locator('i:text-is("more_vert")') }).first();
                    
                    await threeDotsBtn.waitFor({ state: 'visible', timeout: 5000 });
                    await threeDotsBtn.click({ force: true });
                    await page.waitForTimeout(500);

                    await page.locator('text="Tải xuống"').last().hover();
                    await page.waitForTimeout(500);

                    const resolution2K = page.getByText('2K', { exact: true }).last();
                    await resolution2K.waitFor({ state: 'visible', timeout: 5000 });

                    // Lấy đường dẫn file thông qua callback truyền từ file chính
                    const finalFilePath = getFilePathCallback(downloadedCount);

                    const [download] = await Promise.all([
                        page.waitForEvent('download', { timeout: 30000 }), 
                        resolution2K.click()           
                    ]);

                    await download.saveAs(finalFilePath);
                    console.log(`   ✅ Đã tải thành công -> 📁 ${finalFilePath}`);
                    
                    downloadedCount++;

                    // Đóng Toast thông báo nếu có
                    try {
                        const toastCloseBtn = page.locator('li[data-sonner-toast] button:has-text("Đóng")').first();
                        await toastCloseBtn.waitFor({ state: 'visible', timeout: 3000 });
                        await toastCloseBtn.click();
                        await page.waitForTimeout(500);
                    } catch (e) {}

                    // --- HÀNH ĐỘNG 2: XÓA ẢNH ĐỂ DỌN CHỖ ---
                    console.log(`   🗑️ Đang tiến hành xóa ảnh...`);
                    // Hover lại vào ĐÚNG ID ảnh vừa tải
                    await exactImg.hover({ force: true });
                    await page.waitForTimeout(500);
                    
                    // Quét lại Toolbar mới do cái cũ đã bị đóng
                    const newVisibleToolbar = page.locator('div[role="toolbar"]').filter({ state: 'visible' }).first();
                    const newThreeDotsBtn = newVisibleToolbar.locator('button[id^="radix-"]').filter({ has: page.locator('i:text-is("more_vert")') }).first();
                    
                    await newThreeDotsBtn.waitFor({ state: 'visible', timeout: 5000 });
                    await newThreeDotsBtn.click({ force: true });
                    await page.waitForTimeout(500);

                    const deleteBtn = page.locator('text="Xoá"').or(page.locator('text="Chuyển vào thùng rác"')).last();
                    await deleteBtn.waitFor({ state: 'visible', timeout: 5000 });
                    await deleteBtn.click({ force: true });
                    console.log(`   ✅ Đã phi tang ảnh vào thùng rác!`);
                    
                    // Chờ DOM cập nhật và ảnh dưới bị đẩy lên
                    await page.waitForTimeout(1000); 

                    // Break vòng lặp FOR để radar quay lại quét từ Khung đầu tiên
                    break; 

                } catch (error) {
                    console.error(`   ⚠️ Tương tác tải/xóa bị lỗi: ${error.message}`);
                    console.log('   -> Sẽ thử lại ở vòng quét tiếp theo.');
                    await page.keyboard.press('Escape');
                    await page.waitForTimeout(1000);
                }
            }
        }

        // Nghỉ ngơi giữa các lần quét radar
        await page.waitForTimeout(1500);
    }

    // Nếu hết giờ mà chưa tải đủ KPI
    if (downloadedCount < expectedCount) {
        console.log('\n⏰ ĐÃ HẾT TIMEOUT!');
        console.log(`Chỉ dọn dẹp được ${downloadedCount}/${expectedCount} ảnh. Chuyển sang tiến trình khác...`);
        await page.keyboard.press('Escape'); 
        return false;
    }
}

async function addUploadedTileToPrompt(page) {
    console.log('👉 Đang xử lý ảnh mẫu (Reference Image) để Thêm vào câu lệnh...');
    let tileBoxPrompt;

    // Phân nhánh logic theo vòng lặp
    if (!referenceTileId) {
        // [Vòng 1] Quét ô đầu tiên và lưu ID lại
        tileBoxPrompt = page.locator('div[data-testid="virtuoso-item-list"] > div[data-item-index="0"] div[data-tile-id]').first();
        referenceTileId = await tileBoxPrompt.getAttribute('data-tile-id');
        console.log(`   [Vòng 1] Đã ghim ID ảnh mẫu: ${referenceTileId}`);
    } else {
        // [Vòng 2 trở đi] Gọi đích danh ảnh gốc bằng ID đã lưu
        console.log(`   [Vòng 2+] Khóa mục tiêu ảnh mẫu theo ID: ${referenceTileId}`);
        tileBoxPrompt = page.locator(`div[data-tile-id="${referenceTileId}"]`).first();
    }
    
    try {
        // Giải phóng không gian, đóng các menu dropdown còn kẹt
        await page.keyboard.press('Escape');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500); 
    } catch (e) {}

    const imgPrompt = tileBoxPrompt.locator('img[alt="Hình ảnh được tạo"]');
    
    await imgPrompt.waitFor({ state: 'visible', timeout: 120000 });
    await page.waitForTimeout(DELAY_SHORT); 
    
    console.log('   Đang định vị nút 3 chấm...');
    // Cuộn tới ảnh phòng trường hợp bị trôi khỏi khung nhìn
    // 2. 🎯 TUNG CHIÊU: GIẢ LẬP DI CHUỘT VẬT LÝ THEO TỌA ĐỘ
    const box = await tileBoxPrompt.boundingBox();
    if (box) {
        // Di chuyển chuột ra tọa độ (0,0) ở góc màn hình trước để "reset" trạng thái
        await page.mouse.move(0, 0); 
        await page.waitForTimeout(300);
        
        // Di chuột vật lý vào chính giữa khung ảnh (x + 1/2 rộng, y + 1/2 cao)
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 });
        await page.waitForTimeout(500);
        
        // Bắn thêm các Event ở mức DOM để đảm bảo đánh thức UI (phòng hờ)
        await tileBoxPrompt.dispatchEvent('mouseenter');
        await tileBoxPrompt.dispatchEvent('mouseover');
        await tileBoxPrompt.dispatchEvent('pointerenter');
    } else {
        // Phương án dự phòng nếu DOM bị lỗi không lấy được tọa độ
        await tileBoxPrompt.hover({ force: true });
        await imgPrompt.hover({ force: true });
    }
    
    await page.waitForTimeout(1000); // Đợi 1s cho animation của Toolbar trượt ra

    const visibleToolbar = page.locator('div[role="toolbar"]').filter({ state: 'visible' }).first();
    const threeDotsBtn = visibleToolbar.locator('button[id^="radix-"]').filter({ has: page.locator('i:text-is("more_vert")') }).first();
    
    await threeDotsBtn.waitFor({ state: 'visible', timeout: 10000 });
    await threeDotsBtn.hover({ force: true });
    await page.waitForTimeout(DELAY_SHORT); 
    await threeDotsBtn.click({ force: true });
    await page.waitForTimeout(DELAY_SHORT); 

    console.log('   Kích hoạt: "Thêm vào câu lệnh"...');
    await page.locator('text="Thêm vào câu lệnh"').last().click({ force: true });
    await page.waitForTimeout(DELAY_SHORT);

    // Trả về ID để dùng cho các hàm khác (như hàm xóa)
    return referenceTileId; 
}


module.exports = {
    handleProjectNavigation,
    uploadInitialImage,
    configureAndFillImagePrompt,
    addLatestTileToPrompt,
    submitPrompt,
    configureAndFillVideoPrompt,
    downloadLatestVideo,
    uploadInitialMultipleImage,
    downloadAndDeleteImages,
    addUploadedTileToPrompt
};