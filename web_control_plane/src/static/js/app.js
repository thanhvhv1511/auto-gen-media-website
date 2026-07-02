// ==========================================
// 0. KHỞI TẠO CẤU TRÚC HỆ THỐNG & MODALS
// ==========================================
let qaModal;
let videoModal;
let builderModal;

document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById('qaModal')) qaModal = new bootstrap.Modal(document.getElementById('qaModal'));
    if (document.getElementById('videoModal')) videoModal = new bootstrap.Modal(document.getElementById('videoModal'));
    if (document.getElementById('builderModal')) builderModal = new bootstrap.Modal(document.getElementById('builderModal'));
});

let activeImageJobId = null;
let currentActiveFeatures = [];
let currentTimeline = { slot1: '', slot2: '', slot3: '', slot4: '' };

// State Manager Toàn Cục: Sẽ được nạp đầy bằng dữ liệu từ API
let GLOBAL_DB = {
    products: [],
    concepts: [],
    backgrounds: [],
    features: {},
    videoScenes: [],
    poses: [],
    jobStatuses: {} // <--- Đã thêm để hứng map trạng thái từ Backend
};

// ==========================================
// 1. FETCH API MASTER DATA (KHỞI ĐỘNG HỆ THỐNG)
// ==========================================
async function initMasterData() {
    try {
        const res = await fetch('/api/master-data');
        if (!res.ok) throw new Error("Failed to fetch Master Data");
        
        GLOBAL_DB = await res.json();
        console.log("✅ [System Ready] Master Data Loaded:", GLOBAL_DB);
        
        // Tự động render Sidebar của Admin Panel nếu có data (Logic nằm ở file concept.js)
        if(document.getElementById('admin-pane') && GLOBAL_DB.concepts.length > 0 && typeof renderAdminConcepts === 'function') {
            renderAdminConcepts();
            selectAdminConcept(GLOBAL_DB.concepts[0].id); 
        }

        // Tự động nạp danh sách Product Source vào Form Video từ DB thực tế
        populateVideoSourceDropdown();
    } catch (err) {
        console.error("❌ Lỗi tải Master Data:", err);
    }
}

function populateVideoSourceDropdown() {
    const selector = document.getElementById('vidSmartSelector');
    if (!selector) return;
    
    selector.innerHTML = '<option value="">-- Chọn sản phẩm đã duyệt --</option>';
    
    if (GLOBAL_DB.products && GLOBAL_DB.products.length > 0) {
        GLOBAL_DB.products.forEach(p => {
            // Lưu kèm ID và Feature gốc của sản phẩm vào dataset
            selector.innerHTML += `<option value="${p.id}" data-code="${p.product_code}" data-feature="${p.feature_id || ''}">📦 ${p.product_code} - ${p.product_name}</option>`;
        });
    } else {
        selector.innerHTML += '<option value="" disabled>Chưa có sản phẩm nào trên hệ thống</option>';
    }
}

// ==========================================
// 2. LUỒNG KHỞI TẠO & THEO DÕI JOB QUEUE (ẢNH/VIDEO)
// ==========================================
document.getElementById('jobForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Đang xử lý...';

    const pCodeInput = document.getElementById('productCode').value.trim().toLowerCase();
    
    // Đổi từ Product Code sang Product ID để gửi xuống Backend
    const targetProduct = GLOBAL_DB.products.find(p => p.product_code === pCodeInput);
    if (!targetProduct) {
        alert("Mã sản phẩm không tồn tại trên hệ thống. Vui lòng thêm ở Master Data trước!");
        btn.disabled = false; btn.innerHTML = 'Đẩy Lệnh Vào Hàng Đợi';
        return;
    }

    const formData = new FormData();
    formData.append('product_id', targetProduct.id); // Chuẩn Backend mới
    formData.append('concept_id', document.getElementById('conceptId').value);
    formData.append('file', document.getElementById('imageFile').files[0]);

    try {
        const response = await fetch('/jobs/image', { method: 'POST', body: formData });
        if (!response.ok) throw new Error("Lỗi khi đẩy lệnh");
        
        e.target.reset(); 
        fetchJobs();
    } catch (error) {
        alert("Có lỗi xảy ra: " + error.message);
    } finally {
        btn.disabled = false; btn.innerHTML = 'Đẩy Lệnh Vào Hàng Đợi';
    }
});

async function fetchJobs() {
    try {
        const res = await fetch('/jobs'); 
        const jobs = await res.json();
        
        const imageTbody = document.getElementById('imageTableBody');
        const videoTbody = document.getElementById('videoTableBody');
        if (imageTbody) imageTbody.innerHTML = ''; 
        if (videoTbody) videoTbody.innerHTML = '';

        jobs.forEach(job => {
            const timeStr = new Date(job.updated_at).toLocaleTimeString('en-GB');
            let actionBtn = '-';
            
            // LẤY MAP TỪ GLOBAL_DB, KHÔNG DÙNG HARDCODE NỮA
            // Nếu Backend chưa trả về hoặc có status lạ, fallback về class 'secondary'
            const statusInfo = GLOBAL_DB.jobStatuses[job.status] || { class: 'secondary', text: 'UNKNOWN' };
            
            // Đã sửa điều kiện check status dạng số nguyên (2 = Completed)
            if (job.status === 2 && job.job_type === 'image') {
                actionBtn = `<button class="btn btn-sm btn-outline-info tech-font px-3 shadow-sm" onclick="openQA('${job.product_code}', ${job.id})"><i class="bi bi-shield-check me-1"></i> QA Review</button>`;
            } else if (job.status === 2 && job.job_type === 'video') {
                actionBtn = `<button class="btn btn-sm btn-outline-success tech-font px-3 shadow-sm" onclick="openVideo('${job.product_code}', ${job.id})"><i class="bi bi-play-circle-fill me-1"></i> Xem Video</button>`;
            }

            const trHtml = `
                <tr>
                    <td class="ps-4 tech-font text-muted">#${job.id}</td>
                    <td class="fw-bold text-light">${job.product_code}</td>
                    <td>
                        <span class="status-badge status-${statusInfo.class}">
                            <span class="status-dot"></span>${statusInfo.text}
                        </span>
                    </td>
                    <td class="tech-font text-muted">${timeStr}</td>
                    <td class="text-end pe-4">${actionBtn}</td>
                </tr>`;
                
            if (job.job_type === 'image' && imageTbody) imageTbody.innerHTML += trHtml;
            if (job.job_type === 'video' && videoTbody) videoTbody.innerHTML += trHtml;
        });
    } catch (err) { 
        console.error("Lỗi fetch Jobs:", err); 
    }
}

// ==========================================
// 3. LUỒNG KIỂM DUYỆT ẢNH THỦ CÔNG (QA)
// ==========================================
function openQA(productCode, jobId) {
    activeImageJobId = jobId;
    document.getElementById('qaModalTitle').innerHTML = `QA Review - <span class="text-primary">${productCode}</span>`;
    const grid = document.getElementById('qaImageGrid'); grid.innerHTML = '';
    const urls = [1, 2, 3, 4].map(i => `/media/output_images/${productCode}_${jobId}_0${i}.jpg`);

    urls.forEach((url, index) => {
        grid.innerHTML += `<div class="col-3"><div class="qa-image-card" id="img-card-${index}" onclick="toggleImage(${index})"><button class="btn-toggle-img shadow"><i class="bi bi-trash-fill"></i></button><img src="${url}" onerror="this.src='https://via.placeholder.com/400x700?text=Rendering...'"></div></div>`;
    });
    updateQaStatus(); 
    if(qaModal) qaModal.show();
}

function toggleImage(index) {
    const card = document.getElementById(`img-card-${index}`);
    const icon = card.querySelector('.btn-toggle-img i');
    if (card.classList.contains('rejected')) {
        card.classList.remove('rejected'); icon.className = 'bi bi-trash-fill';
    } else {
        card.classList.add('rejected'); icon.className = 'bi bi-arrow-counterclockwise';
    }
    updateQaStatus();
}

function updateQaStatus() {
    const rejected = document.querySelectorAll('.qa-image-card.rejected').length;
    const active = 4 - rejected;
    document.getElementById('qaStatusCount').innerHTML = `Active nodes: <span class="text-light fw-bold">${active}/4</span>`;
    document.getElementById('btnTriggerVideo').disabled = (active === 0);
}

document.getElementById('btnTriggerVideo')?.addEventListener('click', async () => {
    const validIndexes = [];
    document.querySelectorAll('.qa-image-card:not(.rejected)').forEach(card => {
        validIndexes.push(parseInt(card.id.replace('img-card-', '')) + 1);
    });

    if(!confirm(`Xác nhận đánh dấu ${validIndexes.length} ảnh này đạt chuẩn?`)) return;

    await fetch(`/jobs/video/${activeImageJobId}`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved_indexes: validIndexes }) 
    });
    
    if(qaModal) qaModal.hide();
    fetchJobs();
    
    const videoTabEl = document.getElementById('video-tab');
    if (videoTabEl) {
        const videoTab = new bootstrap.Tab(videoTabEl);
        videoTab.show();
    }
});

// ==========================================
// 4. ENGINE TRẠM CẤU HÌNH & LẮP RÁP TIMELINE VIDEO
// ==========================================
let currentContextConceptId = null;

function loadProductContext() {
    const selector = document.getElementById('vidSmartSelector');
    const selectedOption = selector.options[selector.selectedIndex];
    const pId = selector.value;
    const container = document.getElementById('featureFlagsContainer');
    
    if (!pId) {
        container.innerHTML = '<p class="text-muted small mb-0 fst-italic">Vui lòng chọn sản phẩm...</p>';
        return;
    }

    // Tạm thời set Concept ID mặc định là 1 (hoặc bạn có thể thêm ô select Concept)
    currentContextConceptId = 1; 
    currentActiveFeatures = []; 

    // Tự động kích hoạt tính năng gốc của sản phẩm
    const originFeatureId = selectedOption.getAttribute('data-feature');
    if (originFeatureId) currentActiveFeatures.push(originFeatureId);

    document.getElementById('submitVideoBtn').disabled = false;

    // Render bộ công tắc Feature Flags từ DB thật
    let html = '';
    Object.keys(GLOBAL_DB.features).forEach(key => {
        const isChecked = currentActiveFeatures.includes(key) ? 'checked' : '';
        html += `<div class="form-check form-switch mb-2"><input class="form-check-input feature-toggle" type="checkbox" id="feat_${key}" value="${key}" ${isChecked} onchange="toggleFeature('${key}')"><label class="form-check-label text-light small" for="feat_${key}">${GLOBAL_DB.features[key]}</label></div>`;
    });
    container.innerHTML = html;

    // Reset timeline trống
    currentTimeline = { slot1: '', slot2: '', slot3: '', slot4: '' };
    updateLivePrompt();
}

function toggleFeature(featKey) {
    const cb = document.getElementById(`feat_${featKey}`);
    if (cb.checked) { if (!currentActiveFeatures.includes(featKey)) currentActiveFeatures.push(featKey); }
    else { currentActiveFeatures = currentActiveFeatures.filter(f => f !== featKey); }
    updateLivePrompt();
}

function updateLivePrompt() {
    if (!currentContextConceptId) return;

    const concept = GLOBAL_DB.concepts.find(c => c.id === currentContextConceptId);
    let finalPrompt = concept ? concept.basePromptVideo + ' ' : '';
    
    // Lọc ra các video segment thuộc concept hiện tại
    const conceptSegments = GLOBAL_DB.videoScenes.filter(s => s.concept_id === currentContextConceptId);
    
    for (let i = 1; i <= 4; i++) {
        const segId = currentTimeline[`slot${i}`];
        if (segId) {
            const sc = conceptSegments.find(s => s.id === parseInt(segId));
            // Kiểm tra xem cảnh này có yêu cầu feature không (dùng .feature thay cho string)
            const scFeatureId = sc.feature ? String(sc.feature) : null;
            if (sc && (!scFeatureId || currentActiveFeatures.includes(scFeatureId))) {
                finalPrompt += sc.text + " ";
            }
        }
    }
    const promptView = document.getElementById('vidLivePrompt');
    if (promptView) promptView.value = finalPrompt.trim();
}

function openTimelineBuilder() {
    if (!currentContextConceptId) {
        alert("Vui lòng chọn sản phẩm Nguồn ở Trạm Khởi Chạy trước khi tùy chỉnh kịch bản!");
        return;
    }
    
    const concept = GLOBAL_DB.concepts.find(c => c.id === currentContextConceptId);
    document.getElementById('basePromptText').value = concept ? concept.basePromptVideo : '';

    renderSceneLibrary(); 
    renderTimelineSlots(); 
    if(builderModal) builderModal.show();
}

function renderSceneLibrary() {
    const lib = document.getElementById('sceneLibraryList'); 
    if (!lib) return;
    lib.innerHTML = '';

    const conceptSegments = GLOBAL_DB.videoScenes.filter(s => s.concept_id === currentContextConceptId);

    conceptSegments.forEach(scene => {
        const scFeatureId = scene.feature ? String(scene.feature) : null;
        const isLocked = scFeatureId && !currentActiveFeatures.includes(scFeatureId);
        
        const cardStyle = isLocked ? 'opacity: 0.4; border-color: #ef4444;' : 'border-color: rgba(255,255,255,0.1);';
        const lockIcon = isLocked ? '🔒' : '';
        lib.innerHTML += `<div class="card bg-dark mb-2" style="${cardStyle}"><div class="card-body p-2"><h6 class="card-title text-light small fw-bold">${scene.name} ${lockIcon}</h6><p class="text-muted mb-1" style="font-size: 0.75rem;">${scene.text}</p><small class="text-secondary">Giới hạn Slot: ${scene.slots.join(', ')}</small></div></div>`;
    });
}

function renderTimelineSlots() {
    const conceptSegments = GLOBAL_DB.videoScenes.filter(s => s.concept_id === currentContextConceptId);
    
    for (let i = 1; i <= 4; i++) {
        const slotEl = document.getElementById(`slot${i}`); 
        if (!slotEl) continue;
        slotEl.innerHTML = '<option value="">-- Trống (Không diễn) --</option>';
        
        conceptSegments.forEach(scene => {
            if (scene.slots.includes(i)) {
                const scFeatureId = scene.feature ? String(scene.feature) : null;
                const isLocked = scFeatureId && !currentActiveFeatures.includes(scFeatureId);
                const isSelected = currentTimeline[`slot${i}`] === String(scene.id) ? 'selected' : '';
                
                slotEl.innerHTML += `<option value="${scene.id}" ${isLocked ? 'disabled' : ''} ${isSelected}>${isLocked ? '[KHÓA] ': ''}${scene.name}</option>`;
            }
        });
        slotEl.onchange = (e) => { currentTimeline[`slot${i}`] = e.target.value; updateLivePrompt(); };
    }
}

function saveTimelineConfig() { 
    updateLivePrompt();
    if(builderModal) builderModal.hide(); 
}

// Đẩy lệnh Custom Video
document.getElementById('videoJobForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    alert("Tính năng Custom Video Job đang phát triển!");
    console.log("PAYLOAD GỬI ĐI:", {
        source_product_id: document.getElementById('vidSmartSelector').value,
        features: currentActiveFeatures,
        timeline: currentTimeline,
        final_prompt: document.getElementById('vidLivePrompt').value
    });
});

// ==========================================
// 5. LUỒNG XEM VIDEO FINAL
// ==========================================
function openVideo(productCode, jobId) {
    document.getElementById('videoModalTitle').innerHTML = `Review Video - <span class="text-success">${productCode}</span>`;
    const modalBody = document.getElementById('videoModalBody');
    const vidUrl = `/media/output_videos/${productCode}/${productCode}_vid${jobId}_01.mp4`;
    modalBody.innerHTML = `<video width="100%" controls autoplay loop class="rounded shadow-lg" style="max-height: 65vh; max-width: 380px; border: 1px solid rgba(255,255,255,0.1);"><source src="${vidUrl}" type="video/mp4"></video>`;
    if(videoModal) videoModal.show();
}

document.getElementById('videoModal')?.addEventListener('hidden.bs.modal', () => {
    document.getElementById('videoModalBody').innerHTML = '';
});

// ==========================================
// BOOTSTRAP INIT
// ==========================================
initMasterData().then(() => {
    if (document.getElementById('imageTableBody')) {
        fetchJobs();
        setInterval(fetchJobs, 3000);
    }
});