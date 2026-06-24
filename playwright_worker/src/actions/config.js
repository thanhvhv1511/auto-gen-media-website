const path = require('path');

module.exports = {
    // Cấu hình kết nối trình duyệt
    CDP_URL: 'http://localhost:9522',
    
    // Cấu hình luồng lặp
    LOOP_COUNT: 3,
    TARGET_MODEL: 'Nano Banana 2', // Hoặc 'Nano Banana Pro'
    BASE_FILE_NAME: 'cr7_1080_video',
    
    // Quản lý đường dẫn tài nguyên
    TEST_IMAGE: path.resolve(__dirname, 'sample.jpeg'), 
    PROMPT_FILE_IMAGE: path.resolve(__dirname, 'prompt-img.txt'),
    PROMPT_FILE_VIDEO: path.resolve(__dirname, 'prompt-video.txt'),
    OUTPUT_DIR: path.resolve(__dirname, 'output_images'),
    
    // Hệ thống thời gian chờ (ms)
    DELAY_SHORT: 100,
    DELAY_MEDIUM: 2000,
    DELAY_LONG: 5000
};