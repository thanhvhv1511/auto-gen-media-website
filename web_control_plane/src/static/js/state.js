// State Manager Toàn Cục
let GLOBAL_DB = { 
    products: [],       // <-- THÊM: Quản lý danh sách sản phẩm
    concepts: [], 
    backgrounds: [], 
    features: {}, 
    videoScenes: [], 
    poses: [],
    jobStatuses: {}     // <-- THÊM: Map trạng thái động từ Backend
};

// Trạng thái chia sẻ giữa các module
let activeImageJobId = null;
let currentContextConceptId = null;
let currentActiveFeatures = [];
let currentTimeline = { slot1: '', slot2: '', slot3: '', slot4: '' };

// Khởi tạo các Modal Bootstrap dùng chung
let qaModal, videoModal, builderModal;

document.addEventListener("DOMContentLoaded", () => {
    // THÊM `if`: Tránh crash JS ở những trang không chứa các Modal này (ví dụ trang Master Data)
    if (document.getElementById('qaModal')) {
        qaModal = new bootstrap.Modal(document.getElementById('qaModal'));
    }
    if (document.getElementById('videoModal')) {
        videoModal = new bootstrap.Modal(document.getElementById('videoModal'));
    }
    if (document.getElementById('builderModal')) {
        builderModal = new bootstrap.Modal(document.getElementById('builderModal'));
    }
});

// Hàm gọi API lấy Master Data
async function initMasterData() {
    try {
        const res = await fetch('/api/master-data');
        if (!res.ok) throw new Error("Failed to fetch Master Data");
        
        GLOBAL_DB = await res.json();
        console.log("✅ [System Ready] Master Data Loaded:", GLOBAL_DB);
        
        // THÊM: Kích hoạt render giao diện phụ thuộc vào DB sau khi tải xong
        
        // 1. Render dropdown chọn sản phẩm ở trang Video (nếu có hàm này)
        if (typeof populateVideoSourceDropdown === 'function') {
            populateVideoSourceDropdown();
        }
        
        // 2. Render cột Admin Concept ở trang Admin (nếu đang đứng ở Admin UI)
        if (document.getElementById('admin-pane') && typeof renderAdminConcepts === 'function') {
            renderAdminConcepts();
            if(GLOBAL_DB.concepts.length > 0) {
                selectAdminConcept(GLOBAL_DB.concepts[0].id); 
            }
        }
        if (typeof initJobFormSelects === 'function') {
            initJobFormSelects();
        }

    } catch (err) {
        console.error("❌ Lỗi tải Master Data:", err);
    }
}