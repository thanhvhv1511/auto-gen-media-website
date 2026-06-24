// =========================================================================
// static/js/main.js - ĐIỂM NEO KHỞI ĐỘNG HỆ THỐNG (TỔNG ĐÀI ĐỊNH TUYẾN)
// =========================================================================

document.addEventListener("DOMContentLoaded", () => {
    console.log("🚀 Autoscript Media Platform Starting...");
    
    // 1. Tự động nạp dữ liệu Master Data ngầm vào RAM (State.js) trước
    initMasterData().then(() => {
        console.log("📊 Master Data Loaded Successfully.");
        
        // Lấy subpath hiện tại của trình duyệt để định tuyến chuẩn
        const currentPath = window.location.pathname;

        // ---------------------------------------------------------
        // KHỐI 1: KHỞI TẠO WORKSPACE ẢNH (/ui/image)
        // ---------------------------------------------------------
        if (currentPath.includes("/ui/image") || document.getElementById("productId")) {
            console.log("📸 Initializing Workspace Image Module...");
            try {
                // Đổ dữ liệu Sản phẩm & Concept động vào Form (Hàm nằm trong workspace_image.js)
                if (typeof initJobFormSelects === 'function') {
                    initJobFormSelects();
                }
                // Khởi chạy vòng lặp quét đồng bộ hàng đợi (Hàm nằm trong jobs.js)
                if (document.getElementById('imageTableBody') && typeof fetchJobs === 'function') {
                    fetchJobs();
                    setInterval(fetchJobs, 3000);
                }
            } catch (error) {
                console.error("❌ Lỗi khi khởi tạo Workspace Ảnh:", error);
            }
        }
        
        // ---------------------------------------------------------
        // KHỐI 2: KHỞI TẠO WORKSPACE VIDEO (/ui/video)
        // ---------------------------------------------------------
        else if (currentPath.includes("/ui/video") || document.getElementById("vidSmartSelector")) {
            console.log("🎬 Initializing Workspace Video Module...");
            try {
                // Khởi tạo form lắp ráp kịch bản, mapping slot (Hàm nằm trong workspace_video.js)
                if (typeof initVideoWorkspaceForm === 'function') {
                    initVideoWorkspaceForm();
                }
                // Khởi chạy vòng lặp quét hàng đợi video (Hàm nằm trong jobs.js)
                if (document.getElementById('videoTableBody') && typeof fetchJobs === 'function') {
                    fetchJobs();
                    setInterval(fetchJobs, 3000);
                }
            } catch (error) {
                console.error("❌ Lỗi khi khởi tạo Workspace Video:", error);
            }
        }

        // ---------------------------------------------------------
        // KHỐI 3: KHỞI TẠO ADMIN PANEL (/ui/admin)
        // ---------------------------------------------------------
        else if (currentPath.includes("/ui/admin") || document.getElementById('conceptSidebarList')) {
            console.log("🛠️ Initializing Admin Panel Module...");
            try {
                // Render cột trái concept và tự động chọn thằng đầu tiên (Hàm nằm trong admin.js)
                if (GLOBAL_DB && GLOBAL_DB.concepts && GLOBAL_DB.concepts.length > 0) {
                    if (typeof renderAdminConcepts === 'function') renderAdminConcepts();
                    if (typeof selectAdminConcept === 'function') selectAdminConcept(GLOBAL_DB.concepts[0].id);
                } else {
                    console.warn("⚠️ Không có dữ liệu Concept nào trong Database để render!");
                }
            } catch (error) {
                console.error("❌ Lỗi khi hiển thị dữ liệu Admin:", error);
            }
        }
        
        // ---------------------------------------------------------
        // KHỐI 4: KHỞI TẠO VIDEO BUILDER MẪU (/ui/builder)
        // ---------------------------------------------------------
        else if (currentPath.includes("/ui/builder") || document.getElementById('videoBuilderStation')) {
            console.log("🏗️ Initializing Video Builder Station...");
            try {
                if (typeof populateVideoSourceDropdown === 'function') {
                    populateVideoSourceDropdown();
                }
            } catch (error) {
                console.error("❌ Lỗi khi khởi tạo Trạm Builder:", error);
            }
        }
        
    }).catch(err => {
        console.error("🚨 Hệ thống kẹt cứng: Lỗi mạng không thể tải Master Data!", err);
    });
});
