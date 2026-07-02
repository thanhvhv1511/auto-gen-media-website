// ==========================================
// TRẠM CẤU HÌNH & LẮP RÁP TIMELINE VIDEO
// ==========================================

function populateVideoSourceDropdown() {
    const selector = document.getElementById('vidSmartSelector');
    if (!selector) return;
    
    selector.innerHTML = '<option value="">-- Chọn sản phẩm đã duyệt --</option>';
    
    // Nạp dữ liệu tự động từ Database
    if (GLOBAL_DB.products && GLOBAL_DB.products.length > 0) {
        GLOBAL_DB.products.forEach(p => {
            // Lưu kèm ID và Feature gốc để dùng khi chọn
            selector.innerHTML += `<option value="${p.id}" data-code="${p.product_code}" data-feature="${p.feature_id || ''}">📦 ${p.product_code} - ${p.product_name}</option>`;
        });
    } else {
        selector.innerHTML += '<option value="" disabled>Chưa có sản phẩm nào trên hệ thống</option>';
    }
}

function loadProductContext() {
    const selector = document.getElementById('vidSmartSelector');
    const pId = selector.value;
    const selectedOption = selector.options[selector.selectedIndex];
    const container = document.getElementById('featureFlagsContainer');
    
    if (!pId) {
        container.innerHTML = '<p class="text-muted small mb-0 fst-italic">Vui lòng chọn sản phẩm...</p>';
        return;
    }

    // Tạm thời gán mặc định Concept 1 (Có thể mở rộng cho user chọn Concept sau)
    currentContextConceptId = 1; 
    currentActiveFeatures = []; 
    
    // Tự động bật tính năng gốc của sản phẩm nếu có
    const originFeatureId = selectedOption.getAttribute('data-feature');
    if (originFeatureId && originFeatureId !== "null") {
        currentActiveFeatures.push(String(originFeatureId));
    }

    document.getElementById('submitVideoBtn').disabled = false;

    // Render danh sách công tắc từ DB
    let html = '';
    Object.keys(GLOBAL_DB.features).forEach(key => {
        const isChecked = currentActiveFeatures.includes(String(key)) ? 'checked' : '';
        html += `<div class="form-check form-switch mb-2">
                    <input class="form-check-input feature-toggle" type="checkbox" id="feat_${key}" value="${key}" ${isChecked} onchange="toggleFeature('${key}')">
                    <label class="form-check-label text-light small" for="feat_${key}">${GLOBAL_DB.features[key]}</label>
                 </div>`;
    });
    container.innerHTML = html;
    
    currentTimeline = { slot1: '', slot2: '', slot3: '', slot4: '' };
    updateLivePrompt();
}

function toggleFeature(featKey) {
    const cb = document.getElementById(`feat_${featKey}`);
    const keyStr = String(featKey);
    
    if (cb.checked) { 
        if (!currentActiveFeatures.includes(keyStr)) currentActiveFeatures.push(keyStr); 
    } else { 
        currentActiveFeatures = currentActiveFeatures.filter(f => f !== keyStr); 
    }
    updateLivePrompt();
}

function updateLivePrompt() {
    if (!currentContextConceptId) return;
    
    const concept = GLOBAL_DB.concepts.find(c => c.id === currentContextConceptId);
    let finalPrompt = concept ? (concept.basePromptVideo || '') + ' ' : '';
    
    const conceptSegments = GLOBAL_DB.videoScenes.filter(s => s.concept_id === currentContextConceptId);
    
    for (let i = 1; i <= 4; i++) {
        const segId = currentTimeline[`slot${i}`];
        if (segId) {
            const sc = conceptSegments.find(s => String(s.id) === String(segId));
            if (sc) {
                const scFeatureId = sc.feature ? String(sc.feature) : null;
                // Nếu cảnh không yêu cầu feature, HOẶC feature đó đang được bật -> Nhét vào text
                if (!scFeatureId || currentActiveFeatures.includes(scFeatureId)) {
                    finalPrompt += sc.text + " ";
                }
            }
        }
    }
    const promptView = document.getElementById('vidLivePrompt');
    if (promptView) promptView.value = finalPrompt.trim();
}

function openTimelineBuilder() {
    if (!currentContextConceptId) { 
        alert("Vui lòng chọn sản phẩm Nguồn trước khi tùy chỉnh kịch bản!"); 
        return; 
    }
    
    const concept = GLOBAL_DB.concepts.find(c => c.id === currentContextConceptId);
    document.getElementById('basePromptText').value = concept ? (concept.basePromptVideo || '') : '';
    
    renderSceneLibrary(); 
    renderTimelineSlots(); 
    if (typeof builderModal !== 'undefined') builderModal.show();
}

function renderSceneLibrary() {
    const lib = document.getElementById('sceneLibraryList'); 
    if (!lib) return;
    lib.innerHTML = '';
    
    const conceptSegments = GLOBAL_DB.videoScenes.filter(s => s.concept_id === currentContextConceptId);

    conceptSegments.forEach(scene => {
        const scFeatureId = scene.feature ? String(scene.feature) : null;
        // Kiểm tra xem cảnh này có bị khóa do thiếu feature không
        const isLocked = scFeatureId && !currentActiveFeatures.includes(scFeatureId);
        
        const cardStyle = isLocked ? 'opacity: 0.4; border-color: #ef4444;' : 'border-color: rgba(255,255,255,0.1);';
        
        lib.innerHTML += `
            <div class="card bg-dark mb-2" style="${cardStyle}">
                <div class="card-body p-2">
                    <h6 class="card-title text-light small fw-bold">${scene.name} ${isLocked ? '🔒' : ''}</h6>
                    <p class="text-muted mb-1" style="font-size: 0.75rem;">${scene.text}</p>
                    <small class="text-secondary">Giới hạn Slot: ${scene.slots.join(', ')}</small>
                </div>
            </div>`;
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
                const isSelected = String(currentTimeline[`slot${i}`]) === String(scene.id) ? 'selected' : '';
                
                slotEl.innerHTML += `<option value="${scene.id}" ${isLocked ? 'disabled' : ''} ${isSelected}>${isLocked ? '[KHÓA] ': ''}${scene.name}</option>`;
            }
        });
        slotEl.onchange = (e) => { currentTimeline[`slot${i}`] = e.target.value; updateLivePrompt(); };
    }
}

function saveTimelineConfig() { 
    updateLivePrompt(); 
    if (typeof builderModal !== 'undefined') builderModal.hide(); 
}