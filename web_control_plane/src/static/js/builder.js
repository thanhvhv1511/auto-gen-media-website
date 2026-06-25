function populateVideoSourceDropdown() {
    const selector = document.getElementById('vidSmartSelector');
    if (!selector) return;
    selector.innerHTML = `<option value="">-- Chọn sản phẩm đã duyệt --</option><option value="sp001">📦 sp001 - Concept Ngồi Selfie</option><option value="sp002">📦 sp002 - Concept Đứng Full</option>`;
}

function loadProductContext() {
    const pCode = document.getElementById('vidSmartSelector').value;
    const container = document.getElementById('featureFlagsContainer');
    if (!pCode) {
        container.innerHTML = '<p class="text-muted small mb-0 fst-italic">Vui lòng chọn sản phẩm...</p>';
        return;
    }

    currentContextConceptId = pCode === "sp001" ? 1 : 2; 
    currentActiveFeatures = []; 
    document.getElementById('submitVideoBtn').disabled = false;

    let html = '';
    Object.keys(GLOBAL_DB.features).forEach(key => {
        html += `<div class="form-check form-switch mb-2"><input class="form-check-input feature-toggle" type="checkbox" id="feat_${key}" value="${key}" onchange="toggleFeature('${key}')"><label class="form-check-label text-light small" for="feat_${key}">${GLOBAL_DB.features[key]}</label></div>`;
    });
    container.innerHTML = html;
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
    let finalPrompt = concept ? concept.basePrompt + ' ' : '';
    const conceptSegments = GLOBAL_DB.videoScenes.filter(s => s.concept_id === currentContextConceptId);
    
    for (let i = 1; i <= 4; i++) {
        const segId = currentTimeline[`slot${i}`];
        if (segId) {
            const sc = conceptSegments.find(s => s.id === segId);
            if (sc && (!sc.feature || currentActiveFeatures.includes(sc.feature))) finalPrompt += sc.text + " ";
        }
    }
    const promptView = document.getElementById('vidLivePrompt');
    if (promptView) promptView.value = finalPrompt.trim();
}

function openTimelineBuilder() {
    if (!currentContextConceptId) { alert("Chọn sản phẩm Nguồn trước khi tùy chỉnh kịch bản!"); return; }
    const concept = GLOBAL_DB.concepts.find(c => c.id === currentContextConceptId);
    document.getElementById('basePromptText').value = concept ? concept.basePrompt : '';
    renderSceneLibrary(); renderTimelineSlots(); builderModal.show();
}

function renderSceneLibrary() {
    const lib = document.getElementById('sceneLibraryList'); if (!lib) return;
    lib.innerHTML = '';
    const conceptSegments = GLOBAL_DB.videoScenes.filter(s => s.concept_id === currentContextConceptId);

    conceptSegments.forEach(scene => {
        const isLocked = scene.feature && !currentActiveFeatures.includes(scene.feature);
        const cardStyle = isLocked ? 'opacity: 0.4; border-color: #ef4444;' : 'border-color: rgba(255,255,255,0.1);';
        lib.innerHTML += `<div class="card bg-dark mb-2" style="${cardStyle}"><div class="card-body p-2"><h6 class="card-title text-light small fw-bold">${scene.name} ${isLocked ? '🔒' : ''}</h6><p class="text-muted mb-1" style="font-size: 0.75rem;">${scene.text}</p><small class="text-secondary">Giới hạn Slot: ${scene.slots.join(',')}</small></div></div>`;
    });
}

function renderTimelineSlots() {
    const conceptSegments = GLOBAL_DB.videoScenes.filter(s => s.concept_id === currentContextConceptId);
    for (let i = 1; i <= 4; i++) {
        const slotEl = document.getElementById(`slot${i}`); if (!slotEl) continue;
        slotEl.innerHTML = '<option value="">-- Trống (Không diễn) --</option>';
        conceptSegments.forEach(scene => {
            if (scene.slots.includes(i)) {
                const isLocked = scene.feature && !currentActiveFeatures.includes(scene.feature);
                const isSelected = currentTimeline[`slot${i}`] === scene.id ? 'selected' : '';
                slotEl.innerHTML += `<option value="${scene.id}" ${isLocked ? 'disabled' : ''} ${isSelected}>${isLocked ? '[KHÓA] ': ''}${scene.name}</option>`;
            }
        });
        slotEl.onchange = (e) => { currentTimeline[`slot${i}`] = e.target.value; updateLivePrompt(); };
    }
}

function saveTimelineConfig() { updateLivePrompt(); builderModal.hide(); }

document.getElementById('videoJobForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const selector = document.getElementById('vidSmartSelector');
    const btn = e.target.querySelector('button[type="submit"]');
    
    if (!selector.value) {
        alert("Vui lòng chọn nguồn dữ liệu!");
        return;
    }

    // Hiệu ứng Loading
    const originalBtnText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Đang đẩy...';

    try {
        const formData = new FormData();
        formData.append('product_code', selector.value);
        
        // Gửi lệnh lên Backend
        const response = await fetch('/jobs/video', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (response.ok) {
            console.log("✅ Lệnh Video đã được tiếp nhận:", result);
            alert("Đã đẩy lệnh vào hàng đợi thành công!");
            
            // Refresh lại bảng danh sách job (nếu bạn có hàm fetchJobs)
            if (typeof fetchJobs === 'function') fetchJobs();
        } else {
            throw new Error(result.detail || "Có lỗi xảy ra");
        }
    } catch (err) {
        console.error("❌ Lỗi gửi Job Video:", err);
        alert("Lỗi: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalBtnText;
    }
});