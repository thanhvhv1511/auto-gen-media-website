// ==========================================
// BIẾN TOÀN CỤC & KHỞI TẠO
// ==========================================
let activeConceptIdAdmin = null;
let conceptModal;
let editBgModal;
let addBgModal;
let addVideoSceneModal;
let deleteConfirmModal;
let sceneIdToDelete = null;
let addPoseModal
let saveWarningToast;

document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById('addConceptModal')) conceptModal = new bootstrap.Modal(document.getElementById('addConceptModal'));
    if (document.getElementById('editBgModal')) editBgModal = new bootstrap.Modal(document.getElementById('editBgModal'));
    if (document.getElementById('addBgModal')) addBgModal = new bootstrap.Modal(document.getElementById('addBgModal'));
    if (document.getElementById('addVideoSceneModal')) addVideoSceneModal = new bootstrap.Modal(document.getElementById('addVideoSceneModal'));
    if (document.getElementById('saveSuccessToast')) saveSuccessToast = new bootstrap.Toast(document.getElementById('saveSuccessToast'), { delay: 2500 });
    if (document.getElementById('deleteConfirmModal')) deleteConfirmModal = new bootstrap.Modal(document.getElementById('deleteConfirmModal'));
    if (document.getElementById('addPoseModal')) addPoseModal = new bootstrap.Modal(document.getElementById('addPoseModal'));
    if (document.getElementById('saveWarningToast')) saveWarningToast = new bootstrap.Toast(document.getElementById('saveWarningToast'), { delay: 2500 });
});

// ==========================================
// 1. NGHIỆP VỤ CONCEPT (CỘT TRÁI)
// ==========================================
function renderAdminConcepts() {
    const list = document.getElementById('conceptSidebarList');
    if(!list) return;
    list.innerHTML = '';
    
    GLOBAL_DB.concepts.forEach(c => {
        const isActive = c.id === activeConceptIdAdmin ? 'active' : '';
        const previewText = c.basePromptImage ? c.basePromptImage.substring(0, 35) + '...' : 'Chưa có prompt...';

        list.innerHTML += `
            <div class="card concept-card p-3 ${isActive}" onclick="selectAdminConcept(${c.id})">
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <span class="fw-bold text-light">${c.name}</span>
                    <span class="badge bg-secondary tech-font">ID: ${c.id}</span>
                </div>
                <small class="text-muted tech-font text-truncate d-block" style="max-width: 100%;">
                    <i class="bi bi-card-text"></i> ${previewText}
                </small>
            </div>`;
    });
}

function selectAdminConcept(id) {
    activeConceptIdAdmin = id;
    const concept = GLOBAL_DB.concepts.find(c => c.id === id);
    if (!concept) return;

    renderAdminConcepts(); 
    document.getElementById('activeConceptTitle').innerText = concept.name;
    document.getElementById('conceptBasePromptImage').value = concept.basePromptImage || '';
    document.getElementById('conceptBasePromptVideo').value = concept.basePromptVideo || '';
    
    const badge = document.getElementById('conceptSavedBadge');
    if(badge) badge.classList.add('d-none');
    
    renderBackgroundLinker(id);
    renderAdminVideoScenes(id);
    renderAdminPoses(id);
}

// ==========================================
// 2. NGHIỆP VỤ BASE PROMPTS
// ==========================================
async function saveBasePrompt() {
    if (!activeConceptIdAdmin) return alert("Vui lòng chọn 1 Concept trước!");
    
    const imagePrompt = document.getElementById('conceptBasePromptImage').value;
    const videoPrompt = document.getElementById('conceptBasePromptVideo').value;
    
    try {
        const response = await fetch(`/api/concepts/${activeConceptIdAdmin}/base-prompt`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ base_prompt_image: imagePrompt, base_prompt_video: videoPrompt })
        });

        if (!response.ok) throw new Error("Lỗi Server");

        const badge = document.getElementById('conceptSavedBadge');
        if(badge) {
            badge.classList.remove('d-none');
            setTimeout(() => badge.classList.add('d-none'), 3000);
        }
        await initMasterData(); 
    } catch (error) {
        alert("Lỗi khi lưu: Không thể kết nối tới server.");
    }
}

// ==========================================
// 3. NGHIỆP VỤ BACKGROUND
// ==========================================
function renderBackgroundLinker(conceptId) {
    const tbody = document.getElementById('bgLinkerTable'); if(!tbody) return;
    tbody.innerHTML = '';
    
    // Mặc định sắp xếp theo ID bối cảnh từ nhỏ đến lớn
    const sortedBackgrounds = [...GLOBAL_DB.backgrounds].sort((a, b) => a.id - b.id);

    sortedBackgrounds.forEach(bg => {
        let isLinked = false;
        if (bg.allowedConcepts === 'all') isLinked = true;
        else {
            try { 
                const parsedArr = JSON.parse(bg.allowedConcepts); 
                if (Array.isArray(parsedArr) && parsedArr.includes(conceptId)) isLinked = true; 
            } catch(e) {}
        }

        const safeText = (bg.text || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');

        tbody.innerHTML += `
            <tr class="bg-row border-bottom border-subtle" data-bg-id="${bg.id}" data-origin-weight="${bg.weight}" data-origin-linked="${isLinked}">
                <td class="text-light fw-bold tech-font ps-0" style="font-size:0.85rem;">${bg.name}</td>
                <td class="text-center"><input type="number" class="form-control form-control-sm text-center tech-font input-clean mx-auto text-warning" style="width: 70px;" value="${bg.weight}"></td>
                <td class="text-center">
                    <div class="switch-wrapper d-inline-block">
                        <label class="switch"><input type="checkbox" class="bg-toggle-input" ${isLinked ? 'checked' : ''}><span class="slider"></span></label>
                    </div>
                </td>
                <td class="text-end pe-3">
                    <button class="btn btn-sm btn-outline-warning tech-font px-2 py-0" style="font-size: 0.75rem;" onclick="openEditBgModal(${bg.id}, '${bg.name}', '${safeText}', ${bg.weight})">
                        <i class="bi bi-pencil-square"></i> Sửa
                    </button>
                </td>
            </tr>`;
    });
}

async function saveAllBackgrounds() {
    if (!activeConceptIdAdmin) return alert("Vui lòng chọn Concept!");
    
    const rows = document.querySelectorAll('#bgLinkerTable .bg-row');
    const apiPromises = []; 
    let hasChanges = false;

    rows.forEach(row => {
        const bgId = row.getAttribute('data-bg-id');
        const originWeight = row.getAttribute('data-origin-weight');
        const originLinked = row.getAttribute('data-origin-linked') === 'true';
        
        const currentWeight = row.querySelector('input[type="number"]').value;
        const currentLinked = row.querySelector('.bg-toggle-input').checked;

        if (currentWeight !== originWeight) {
            hasChanges = true;
            apiPromises.push(fetch(`/api/backgrounds/${bgId}/weight`, { 
                method: 'PUT', 
                headers: {'Content-Type': 'application/json'}, 
                body: JSON.stringify({weight: parseInt(currentWeight)})
            }));
        }
        if (currentLinked !== originLinked) {
            hasChanges = true;
            apiPromises.push(fetch(`/api/backgrounds/${bgId}/toggle-concept/${activeConceptIdAdmin}`, { 
                method: 'POST' 
            }));
        }
    });

    if (!hasChanges) {
        if (saveWarningToast) {
            saveWarningToast.show(); // Bắn toast vàng xịn mịn
        } else {
            alert("Không có thay đổi nào để lưu!"); // Fallback nếu quên chưa lưu file HTML
        }
        return;
    }

    try {
        await Promise.all(apiPromises);
        
        await initMasterData(); 
        renderBackgroundLinker(activeConceptIdAdmin); 

        // FIX TẠI ĐÂY: Thay thế alert quả phèn bằng Toast thông báo xịn mịn
        if (saveSuccessToast) {
            document.getElementById('toastMessage').innerText = "🎉 Đã lưu toàn bộ cấu hình Background thành công!";
            saveSuccessToast.show();
        }
        
    } catch (error) { 
        console.error(error); 
        alert("Có lỗi xảy ra trong quá trình lưu bối cảnh!");
    }
}


function addNewBackground() {
    document.getElementById('newBgName').value = '';
    document.getElementById('newBgText').value = '';
    document.getElementById('newBgWeight').value = '10';
    if(addBgModal) addBgModal.show();
}

async function submitNewBackground() {
    const bgName = document.getElementById('newBgName').value.trim();
    const bgText = document.getElementById('newBgText').value.trim();
    const bgWeight = parseInt(document.getElementById('newBgWeight').value) || 10;
    
    if (!bgName || !bgText) return alert("Vui lòng nhập đầy đủ!");
    try {
        const response = await fetch('/api/backgrounds', {
            method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ name: bgName, text: bgText, weight: bgWeight })
        });
        if (!response.ok) throw new Error(`Lỗi Backend`);
        
        if(addBgModal) addBgModal.hide();
        await initMasterData(); 
        if (activeConceptIdAdmin) renderBackgroundLinker(activeConceptIdAdmin);

        // FIX TẠI ĐÂY: Bắn Toast xanh mướt thông báo tạo mới thành công
        if (saveSuccessToast) {
            document.getElementById('toastMessage').innerText = `🎉 Đã tạo thành công bối cảnh mới: ${bgName}`;
            saveSuccessToast.show();
        }
    } catch (error) { 
        console.error(error); 
        alert("Lỗi khi thêm Background mới!");
    }
}

function openEditBgModal(id, name, text, weight) {
    document.getElementById('editBgId').value = id;
    document.getElementById('editBgName').value = name;
    document.getElementById('editBgText').value = text;
    document.getElementById('editBgWeight').value = weight;
    if(editBgModal) editBgModal.show();
}

async function submitEditBackground() {
    const id = document.getElementById('editBgId').value;
    const name = document.getElementById('editBgName').value.trim();
    const text = document.getElementById('editBgText').value.trim();
    const weight = parseInt(document.getElementById('editBgWeight').value) || 10;

    if (!name || !text) return alert("Vui lòng điền đủ!");
    try {
        const response = await fetch(`/api/backgrounds/${id}`, {
            method: 'PUT', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({ name: name, text: text, weight: weight }) 
        });
        if (!response.ok) throw new Error(`Lỗi backend`);
        
        if (editBgModal) editBgModal.hide();
        await initMasterData(); 
        if (activeConceptIdAdmin) renderBackgroundLinker(activeConceptIdAdmin); 

        // FIX TẠI ĐÂY: Bắn Toast xịn mịn thay vì im im không báo gì
        if (saveSuccessToast) {
            document.getElementById('toastMessage').innerText = `🎉 Đã cập nhật thành công bối cảnh: ${name}`;
            saveSuccessToast.show();
        }

    } catch (error) { 
        console.error(error); 
        alert("Lỗi khi cập nhật thông tin Background!");
    }
}
// ==========================================
// 4. NGHIỆP VỤ VIDEO SCENES (MANUAL & AUTO SAVE)
// ==========================================
function renderAdminVideoScenes(conceptId) {
    const list = document.getElementById('videoScenesList'); if(!list) return;
    list.innerHTML = '';
    
    // Lọc theo conceptId, mặc định xếp theo ID tăng dần
    const conceptSegments = GLOBAL_DB.videoScenes
        .filter(s => s.concept_id === conceptId)
        .sort((a, b) => a.id - b.id);

    let featureOptions = '<option value="">-- Không điều kiện --</option>';
    if (GLOBAL_DB && GLOBAL_DB.features) {
        Object.keys(GLOBAL_DB.features).forEach(id => { 
            featureOptions += `<option value="${id}">${GLOBAL_DB.features[id]}</option>';`; 
        });
    }

    conceptSegments.forEach(sc => {
        const currentFeatureId = sc.required_feature_id !== undefined ? sc.required_feature_id : sc.feature;
        const dynamicFeatureOptions = featureOptions.replace(`value="${currentFeatureId}"`, `value="${currentFeatureId}" selected`);
        
        let allowedSlots = [];
        try { allowedSlots = Array.isArray(sc.slots) ? sc.slots : (sc.allowed_slots ? JSON.parse(sc.allowed_slots) : []); } 
        catch(e) { allowedSlots = []; }

        list.innerHTML += `
            <div class="card scene-form-card p-3 mb-3" id="scene-card-${sc.id}" style="border: 1px solid rgba(255,255,255,0.1); transition: all 0.3s ease;">
                <div class="row g-3">
                    <div class="col-md-3">
                        <label class="form-label text-muted" style="font-size: 0.7rem;">ID PHÂN CẢNH</label>
                        <input type="text" class="form-control form-control-sm tech-font" value="${sc.id}" disabled>
                    </div>
                    <div class="col-md-9">
                        <label class="form-label text-muted" style="font-size: 0.7rem;">TÊN CẢNH</label>
                        <input type="text" class="form-control form-control-sm tech-font fw-bold scene-name" value="${sc.name || ''}" onchange="autoSaveScene('${sc.id}')">
                    </div>
                    <div class="col-md-8">
                        <label class="form-label text-muted" style="font-size: 0.7rem;">PROMPT CHI TIẾT</label>
                        <textarea class="form-control form-control-sm tech-font scene-text" rows="2" onchange="autoSaveScene('${sc.id}')">${sc.text || ''}</textarea>
                    </div>
                    <div class="col-md-4">
                        <label class="form-label text-muted" style="font-size: 0.7rem;">ĐIỀU KIỆN TÍNH NĂNG</label>
                        <select class="form-select form-select-sm border-warning text-warning scene-feature" onchange="autoSaveScene('${sc.id}')">
                            ${dynamicFeatureOptions}
                        </select>
                    </div>
                    <div class="col-12 mt-2 pt-2 border-top border-secondary d-flex align-items-center gap-4">
                        <span class="text-muted small">Cấp phép Slot:</span>
                        ${[1, 2, 3, 4].map(slot => `
                            <div class="form-check form-check-inline">
                                <input class="form-check-input slot-checkbox scene-slot-${slot}" 
                                       type="checkbox" 
                                       ${allowedSlots.includes(slot) ? 'checked' : ''} 
                                       onchange="autoSaveScene('${sc.id}')">
                                <label class="form-check-label small">${slot}</label>
                            </div>
                        `).join('')}
                        
                        <div class="ms-auto d-flex gap-2">
                            <button class="btn btn-sm btn-outline-danger" onclick="deleteVideoScene('${sc.id}')"><i class="bi bi-trash"></i> Xóa</button>
                            <button class="btn btn-sm btn-primary px-3" onclick="manualSaveScene('${sc.id}')"><i class="bi bi-save"></i> Lưu Thay Đổi</button>
                        </div>
                    </div>
                </div>
            </div>`;
    });
}

// 4.1 Auto Save Ngầm khi có onchange
async function autoSaveScene(sceneId) {
    const card = document.getElementById(`scene-card-${sceneId}`);
    if (!card) return;

    card.style.borderColor = "var(--bs-warning)";
    
    const name = card.querySelector('.scene-name').value.trim();
    const text = card.querySelector('.scene-text').value.trim();
    let feature = card.querySelector('.scene-feature').value;
    if (feature === "") feature = null;
    
    const slots = [];
    [1, 2, 3, 4].forEach(slot => {
        if (card.querySelector(`.scene-slot-${slot}`).checked) slots.push(slot);
    });

    try {
        const response = await fetch(`/api/video-segments/${sceneId}`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ name: name, text: text, required_feature_id: feature ? parseInt(feature) : null, allowed_slots: JSON.stringify(slots) })
        });
        if (!response.ok) throw new Error("Lỗi lưu ngầm");

        card.style.borderColor = "var(--bs-success)";
        setTimeout(() => { card.style.borderColor = "rgba(255,255,255,0.1)"; }, 1000);
        await initMasterData(); 
    } catch (error) {
        console.error("Auto Save Error:", error);
        card.style.borderColor = "var(--bs-danger)";
    }
}

// 4.2 Click Lưu Thủ Công
async function manualSaveScene(sceneId) {
    const card = document.getElementById(`scene-card-${sceneId}`);
    if (!card) return;

    card.style.borderColor = "var(--bs-warning)";
    const name = card.querySelector('.scene-name').value.trim();
    const text = card.querySelector('.scene-text').value.trim();
    let feature = card.querySelector('.scene-feature').value;
    
    const slots = [];
    [1, 2, 3, 4].forEach(slot => {
        if (card.querySelector(`.scene-slot-${slot}`).checked) slots.push(slot);
    });

    try {
        const response = await fetch(`/api/video-segments/${sceneId}`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ name: name, text: text, required_feature_id: feature ? parseInt(feature) : null, allowed_slots: JSON.stringify(slots) })
        });

        if (!response.ok) throw new Error("Backend trả về lỗi");

        card.style.borderColor = "var(--bs-success)";
        setTimeout(() => { card.style.borderColor = "rgba(255,255,255,0.1)"; }, 1200);
        await initMasterData(); 

        // BẮN TOAST THAY VÌ ALERT
        if (saveSuccessToast) {
            document.getElementById('toastMessage').innerText = `Đã cập nhật thành công phân cảnh name: ${name}`;
            saveSuccessToast.show();
        }
    } catch (error) {
        card.style.borderColor = "var(--bs-danger)";
        console.error(error);
    }
}

// 4.3 Modal Thêm Phân Cảnh
function addNewVideoScene() {
    if (!activeConceptIdAdmin) return alert("Vui lòng chọn 1 Concept ở cột bên trái trước!");
    document.getElementById('newSceneName').value = '';
    if (addVideoSceneModal) addVideoSceneModal.show();
}

async function submitNewVideoScene() {
    const sceneName = document.getElementById('newSceneName').value.trim();
    if (!sceneName) return alert("Vui lòng nhập Tên cảnh!");

    try {
        const response = await fetch('/api/video-segments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                concept_id: activeConceptIdAdmin,
                name: sceneName,
                text: "", 
                required_feature_id: null,
                allowed_slots: "[1,2,3,4]" 
            })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.detail || `Lỗi ${response.status}`);
        }

        if (addVideoSceneModal) addVideoSceneModal.hide();
        await initMasterData(); 
        renderAdminVideoScenes(activeConceptIdAdmin); 
    } catch (error) {
        alert("Lỗi tạo phân cảnh mới!\nChi tiết: " + error.message);
    }
}

// 4.4 Xóa Phân Cảnh
function deleteVideoScene(sceneId) {
    sceneIdToDelete = sceneId; // Gán ID vào biến tạm
    
    // Cập nhật text hiển thị trong modal xóa
    document.getElementById('deleteModalBodyText').innerHTML = `⚠️ Bạn có chắc chắn muốn XÓA phân cảnh ID <b>[${sceneId}]</b> không?<br><span class="text-muted" style="font-size:0.75rem;">Hành động này không thể hoàn tác!</span>`;
    
    // Gán sự kiện click cho nút xác nhận trong modal
    document.getElementById('confirmDeleteBtn').onclick = async function() {
        if (!sceneIdToDelete) return;
        try {
            const response = await fetch(`/api/video-segments/${sceneIdToDelete}`, { method: 'DELETE' });
            if (!response.ok) throw new Error(`Lỗi Backend`);

            if (deleteConfirmModal) deleteConfirmModal.hide(); // Ẩn modal
            await initMasterData();
            renderAdminVideoScenes(activeConceptIdAdmin);
            
            // Hiện toast thông báo đã xóa xong
            if (saveSuccessToast) {
                document.getElementById('toastMessage').innerText = `Đã xóa phân cảnh ID: ${sceneIdToDelete}`;
                saveSuccessToast.show();
            }
        } catch (error) {
            console.error(error);
        } finally {
            sceneIdToDelete = null;
        }
    };

    // BẬT MODAL XÓA LÊN
    if (deleteConfirmModal) deleteConfirmModal.show();
}

// ==========================================
// 5. NGHIỆP VỤ POSES (TƯ THẾ)
// ==========================================
function renderAdminPoses(conceptId) {
    const conceptPoses = GLOBAL_DB.poses
        .filter(p => p.concept_id === conceptId)
        .sort((a, b) => a.id - b.id); // Mặc định xếp tăng dần theo ID

    ['upperBody', 'leg', 'hand'].forEach(part => {
        const targetId = `pose${part === 'upperBody' ? 'Upper' : (part === 'leg' ? 'Leg' : 'Hand')}List`;
        const list = document.getElementById(targetId); if(!list) return;
        list.innerHTML = '';
        
        conceptPoses.filter(p => p.body_part === part).forEach(p => {
            list.innerHTML += `
                <div class="d-flex gap-2 align-items-center mb-2" id="pose-row-${p.id}">
                    <input type="text" class="form-control form-control-sm tech-font flex-grow-1 pose-text" value="${p.text}">
                    <div class="input-group input-group-sm" style="width: 120px;">
                        <span class="input-group-text bg-dark text-muted">WT</span>
                        <input type="number" class="form-control tech-font text-center pose-weight" value="${p.weight}">
                    </div>
                    <button class="btn btn-sm btn-primary" onclick="savePose(${p.id})"><i class="bi bi-save"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deletePose(${p.id}, '${part}')"><i class="bi bi-trash"></i></button>
                </div>`;
        });
    });
}

async function savePose(poseId) {
    const row = document.getElementById(`pose-row-${poseId}`);
    if (!row) return;

    const text = row.querySelector('.pose-text').value.trim();
    const weight = parseInt(row.querySelector('.pose-weight').value) || 10;

    try {
        const response = await fetch(`/api/poses/${poseId}`, { 
            method: 'PUT', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({ text: text, weight: weight })
        });

        if (!response.ok) throw new Error("Lỗi cập nhật tư thế");

        await initMasterData();

        // Sử dụng Toast thông báo thay vì alert() quả phèn của trình duyệt
        if (saveSuccessToast) {
            document.getElementById('toastMessage').innerText = `🎉 Đã lưu tư thế ảnh (ID: ${poseId}) thành công!`;
            saveSuccessToast.show();
        }
    } catch (error) {
        console.error("Save Pose Error:", error);
    }
}

function deletePose(poseId, bodyPart) {
    // Sử dụng lại biến tạm và Modal xóa đã có sẵn trong HTML từ câu trước
    sceneIdToDelete = poseId; 

    // Chỉnh sửa lại text hiển thị trong body modal cho đúng nghiệp vụ tư thế
    document.getElementById('deleteModalBodyText').innerHTML = `⚠️ Bạn có chắc chắn muốn XÓA tư thế ảnh ID <b>[${poseId}]</b> không?<br><span class="text-muted" style="font-size:0.75rem;">Hành động này không thể hoàn tác!</span>`;
    
    // Đè lại sự kiện click xác nhận xóa cho nút trong Modal
    document.getElementById('confirmDeleteBtn').onclick = async function() {
        if (!sceneIdToDelete) return;
        try {
            const response = await fetch(`/api/poses/${sceneIdToDelete}`, { method: 'DELETE' });
            if (!response.ok) throw new Error(`Lỗi Backend khi xóa tư thế`);

            if (deleteConfirmModal) deleteConfirmModal.hide(); // Ẩn modal
            
            await initMasterData();
            renderAdminPoses(activeConceptIdAdmin); // Vẽ lại các danh bạ tư thế dáng
            
            // Hiện toast thông báo xóa thành công
            if (saveSuccessToast) {
                document.getElementById('toastMessage').innerText = `Đã xóa thành công tư thế ID: ${sceneIdToDelete}`;
                saveSuccessToast.show();
            }
        } catch (error) {
            console.error("Delete Pose Error:", error);
        } finally {
            sceneIdToDelete = null; // Giải phóng bộ nhớ tạm
        }
    };

    // BẬT MODAL LÊN
    if (deleteConfirmModal) deleteConfirmModal.show();
}

// 5.4 Bật Modal Thêm tư thế (Được gọi từ nút click ngoài giao diện)
function addNewPose(bodyPart) {
    if (!activeConceptIdAdmin) return alert("Vui lòng chọn 1 Concept trước!");
    
    // Gán dữ liệu mặc định làm sạch form
    document.getElementById('newPoseBodyPart').value = bodyPart;
    document.getElementById('newPoseText').value = '';
    document.getElementById('newPoseWeight').value = '10';
    
    // Bật modal lên
    if (addPoseModal) addPoseModal.show();
}

// 5.5 Gửi API POST tạo tư thế mới vào DB
async function submitNewPose() {
    const bodyPart = document.getElementById('newPoseBodyPart').value;
    const text = document.getElementById('newPoseText').value.trim();
    const weight = parseInt(document.getElementById('newPoseWeight').value) || 10;

    if (!text) return alert("Vui lòng nhập nội dung mô tả tư thế!");

    try {
        const response = await fetch('/api/poses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                concept_id: activeConceptIdAdmin,
                body_part: bodyPart,
                text: text,
                weight: weight
            })
        });

        if (!response.ok) throw new Error(`Lỗi Server (${response.status})`);

        if (addPoseModal) addPoseModal.hide(); // Đóng modal
        await initMasterData(); // Đồng bộ state tổng
        renderAdminPoses(activeConceptIdAdmin); // Vẽ lại UI tab tư thế

        // Bắn toast thông báo xịn mịn
        if (saveSuccessToast) {
            document.getElementById('toastMessage').innerText = `🎉 Đã tạo tư thế mới thành công!`;
            saveSuccessToast.show();
        }

    } catch (error) {
        console.error("Submit Pose Error:", error);
        alert("Lỗi khi tạo tư thế mới, vui lòng kiểm tra Terminal!");
    }
}

// ==========================================
// 6. CÁC HÀM THÊM/SỬA MODAL KHÁC
// ==========================================
function addNewConcept() { if(conceptModal) conceptModal.show(); }

async function submitNewConcept() {
    const nameInput = document.getElementById('newConceptName');
    const name = nameInput.value.trim();
    if(!name) return alert("Vui lòng nhập tên Concept!");
    
    try {
        const response = await fetch('/api/concepts', { 
            method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({name: name})
        });
        if (!response.ok) return alert(`Lỗi Backend`);
        
        if (conceptModal) conceptModal.hide();
        nameInput.value = '';
        
        await initMasterData();
        renderAdminConcepts();
        if (GLOBAL_DB.concepts.length > 0) selectAdminConcept(GLOBAL_DB.concepts[GLOBAL_DB.concepts.length - 1].id);
    } catch (error) { alert("Lỗi kết nối mạng!"); }
}

// Biến lưu trữ ô Textarea cuối cùng người dùng tương tác
let lastFocusedEditor = null;

document.addEventListener('DOMContentLoaded', () => {
    // Tìm tất cả các ô soạn thảo có gắn class 'prompt-editor'
    const editors = document.querySelectorAll('.prompt-editor');
    
    editors.forEach(editor => {
        // Mỗi khi click hoặc tab vào ô nào, ghi nhớ ô đó lại
        editor.addEventListener('focus', function() {
            lastFocusedEditor = this;
        });
    });
});

/**
 * Hàm chèn biến tại vị trí con trỏ thông minh
 * @param {string} variableTag Mã biến (VD: {{SELECTED_LEG}})
 */
function insertVariable(variableTag) {
    // Ưu tiên ô được focus cuối cùng. Nếu chưa click vào đâu, mặc định ném vào ô Image.
    const txtArea = lastFocusedEditor || document.getElementById('conceptBasePromptImage');
    
    if (!txtArea) return;

    // Lấy tọa độ con trỏ chuột hiện tại
    const startPos = txtArea.selectionStart;
    const endPos = txtArea.selectionEnd;
    const textBefore = txtArea.value.substring(0, startPos);
    const textAfter = txtArea.value.substring(endPos, txtArea.value.length);

    // Chèn mã biến vào giữa
    txtArea.value = textBefore + variableTag + textAfter;

    // Cập nhật lại vị trí con trỏ ra ngay phía sau biến vừa chèn
    const newCursorPos = startPos + variableTag.length;
    txtArea.selectionStart = newCursorPos;
    txtArea.selectionEnd = newCursorPos;
    
    // Focus lại vào ô để gõ tiếp
    txtArea.focus();
}

// 1. Quản lý trạng thái bằng ID (Dạng chuỗi) thay vì lưu Object DOM trực tiếp
// Giúp tránh việc giữ lại phần tử "chết" sau khi chuyển đổi Concept ở Sidebar
window.lastActivePromptEditorId = 'conceptBasePromptImage'; 

// 2. Theo dõi ID của ô textarea được nhấp chuột vào cuối cùng (Chạy toàn cục)
document.addEventListener('focusin', function(e) {
    if (e.target && e.target.classList.contains('prompt-editor')) {
        window.lastActivePromptEditorId = e.target.id;
        console.log("🎯 Hệ thống ghi nhớ ID ô soạn thảo active:", window.lastActivePromptEditorId);
    }
});

// 3. Ủy quyền sự kiện Click toàn cục (Event Delegation) trực tiếp từ tầng document
// Bất kể HTML bị xóa đi vẽ lại bao nhiêu lần, nút bấm vẫn hoạt động chính xác 100%
document.addEventListener('click', function(e) {
    // Tìm xem phần tử được click (hoặc thẻ cha của nó) có thuộc tính data-tag không
    const button = e.target.closest('[data-tag]');
    if (!button) return; // Nếu không phải nút chèn biến, bỏ qua không xử lý

    e.preventDefault();

    // Bản đồ ánh xạ giá trị chuỗi mẫu cần chèn
    const tagValues = {
        'BACKGROUND': 'Background: {{SELECTED_BACKGROUND}}',
        'UPPER_BODY': '{{SELECTED_UPPER_BODY}}',
        'LEG':        '{{SELECTED_LEG}}',
        'HAND':       '{{SELECTED_HAND}}'
    };

    const targetTagType = button.getAttribute('data-tag');
    const finalInsertText = tagValues[targetTagType];
    
    if (!finalInsertText) return;

    // LUÔN LUÔN lấy phần tử LIVE (đang hiển thị thực tế trên màn hình) bằng ID
    const targetId = window.lastActivePromptEditorId || 'conceptBasePromptImage';
    const txtArea = document.getElementById(targetId);

    if (!txtArea) {
        console.warn("⚠️ Không tìm thấy ô textarea live với ID:", targetId);
        return;
    }

    // Tiến hành bóc tách và chèn chữ vào vị trí con trỏ chuột
    const startPos = txtArea.selectionStart || 0;
    const endPos = txtArea.selectionEnd || 0;
    
    const originalValue = txtArea.value;
    const textBefore = originalValue.substring(0, startPos);
    const textAfter = originalValue.substring(endPos, originalValue.length);

    txtArea.value = textBefore + finalInsertText + textAfter;

    // Tính toán và trả lại dấu nháy chuột ngay sau từ khóa vừa được điền vào
    const nextCursorIndex = startPos + finalInsertText.length;
    
    txtArea.focus();
    txtArea.setSelectionRange(nextCursorIndex, nextCursorIndex);

    // Phát tín hiệu thông báo nội dung thay đổi để đồng bộ trạng thái lưu của hệ thống
    txtArea.dispatchEvent(new Event('input', { bubbles: true }));
});