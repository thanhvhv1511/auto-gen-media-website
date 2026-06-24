// State Manager Toàn Cục
let GLOBAL_DB = { concepts: [], backgrounds: [], features: {}, videoScenes: [], poses: [] };

// Trạng thái chia sẻ giữa các module
let activeImageJobId = null;
let currentContextConceptId = null;
let currentActiveFeatures = [];
let currentTimeline = { slot1: '', slot2: '', slot3: '', slot4: '' };

// Khởi tạo các Modal Bootstrap dùng chung
let qaModal, videoModal, builderModal;

document.addEventListener("DOMContentLoaded", () => {
    qaModal = new bootstrap.Modal(document.getElementById('qaModal'));
    videoModal = new bootstrap.Modal(document.getElementById('videoModal'));
    builderModal = new bootstrap.Modal(document.getElementById('builderModal'));
});

// Hàm gọi API lấy Master Data
async function initMasterData() {
    try {
        const res = await fetch('/api/master-data');
        if (!res.ok) throw new Error("Failed to fetch Master Data");
        GLOBAL_DB = await res.json();
        console.log("✅ [System Ready] Master Data Loaded");
    } catch (err) {
        console.error("❌ Lỗi tải Master Data:", err);
    }
}