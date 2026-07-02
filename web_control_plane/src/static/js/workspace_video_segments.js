/**
 * workspace_video_segments.js
 * Quản lý Ma trận Phân Cảnh Video & Concepts
 */

let allVidConcepts = [];
let cachedVideoSegments = [];

document.addEventListener("DOMContentLoaded", async () => {
    await loadVidConcepts();
    buildVidTableHeader(); 
    await loadVideoSegments();
});

async function loadVidConcepts() {
    try {
        const response = await fetch('/api/concepts');
        if (response.ok) allVidConcepts = await response.json();
    } catch (error) { console.error("Lỗi API Concepts:", error); }
}

// [ĐÃ THÊM LẠI] Hàm build header bảng (Gom 4 cột thành 1)
function buildVidTableHeader() {
    const thead = document.getElementById('videoSegmentTableHeader');
    if (!thead) return;

    let html = `
        <tr class="text-uppercase">
            <th scope="col" class="text-center align-middle" width="5%">ID</th>
            <th scope="col" class="align-middle" width="25%">Tên Phân Cảnh</th>
            <th scope="col" class="text-center align-middle" width="10%">Trọng Số</th>
            
            <!-- 1 Cột gom chung 4 Slot -->
            <th scope="col" class="text-center align-middle" width="12%">Vị trí (Slots)</th>
    `;

    if (allVidConcepts.length === 0) {
        html += `<th scope="col" class="text-center align-middle text-danger">Chưa có Concept</th>`;
    } else {
        allVidConcepts.forEach(concept => {
            html += `<th scope="col" class="text-center align-middle" style="min-width: 120px;">${escapeVidHtml(concept.name)}</th>`;
        });
    }

    html += `
            <th scope="col" class="text-center align-middle" width="10%">Hành Động</th>
        </tr>
    `;
    thead.innerHTML = html;
}

async function loadVideoSegments() {
    const tbody = document.getElementById('videoSegmentTableBody');
    if (!tbody) return;
    
    try {
        const response = await fetch('/api/video-segments');
        if (!response.ok) throw new Error('Lỗi server');
        
        const segments = await response.json();
        cachedVideoSegments = segments; 
        
        tbody.innerHTML = '';
        if (segments.length === 0) {
            // Đã cập nhật colspan thành 5 để cân xứng với thiết kế mới
            tbody.innerHTML = `<tr><td colspan="${5 + allVidConcepts.length}" class="text-center py-4 text-muted">Chưa có Phân cảnh Video nào.</td></tr>`;
            return;
        }

        segments.forEach(seg => {
            tbody.insertAdjacentHTML('beforeend', createVidRowHtml(seg));
        });
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="10" class="text-center text-danger py-4">Lỗi: ${error.message}</td></tr>`;
    }
}

// [ĐÃ DỌN DẸP] Chỉ giữ lại bản render giao diện có 4 nút vuông
function createVidRowHtml(seg) {
    const allowedIds = seg.concept_ids || [];

    // 1. Render Checkbox cho Concepts
    let conceptTdsHtml = '';
    allVidConcepts.forEach(concept => {
        const isChecked = (Array.isArray(allowedIds) ? allowedIds : []).includes(concept.id);
        conceptTdsHtml += `
            <td class="text-center concept-cell align-middle">
                <input class="form-check-input custom-checkbox shadow-none" type="checkbox" 
                       ${isChecked ? 'checked' : ''} 
                       onchange="toggleSegmentConcept(${seg.id}, ${concept.id}, this)">
            </td>
        `;
    });

    // 2. Render 4 ô vuông Slot
    let slots = [];
    try { slots = typeof seg.allowed_slots === 'string' ? JSON.parse(seg.allowed_slots) : (seg.allowed_slots || []); } 
    catch(e) { slots = []; }

    let slotsHtml = '<div class="d-flex justify-content-center gap-2">';
    [1, 2, 3, 4].forEach(slotNum => {
        const isChecked = slots.includes(slotNum);
        
        const activeStyle = isChecked 
            ? 'background-color: #a855f7; color: white; border: 1px solid #a855f7;' 
            : 'background-color: transparent; color: #adb5bd; border: 1px solid #6c757d;';

        slotsHtml += `
            <div onclick="toggleSegmentSlotBtn(${seg.id}, ${slotNum}, this)"
                 class="rounded-1 d-flex align-items-center justify-content-center"
                 style="width: 26px; height: 26px; font-size: 13px; font-weight: bold; cursor: pointer; transition: 0.2s; user-select: none; ${activeStyle}"
                 title="Bật/tắt Slot ${slotNum}">
                ${slotNum}
            </div>
        `;
    });
    slotsHtml += '</div>';

    // 3. Render Badge Must Have
    const mustHaveBadge = seg.is_must_have 
        ? `<button class="badge bg-danger text-white border border-danger rounded-pill px-2 py-1 mt-1 cursor-pointer btn-no-style" 
                   onclick="toggleVideoMustHave(${seg.id}, this)">Must Have</button>` 
        : `<button class="badge bg-secondary bg-opacity-25 text-secondary border border-secondary rounded-pill px-2 py-1 mt-1 cursor-pointer btn-no-style" 
                   onclick="toggleVideoMustHave(${seg.id}, this)">Optional</button>`;

    return `
        <tr id="seg-row-${seg.id}">
            <td class="text-center text-secondary fw-bold align-middle">${seg.id}</td>
            <td class="fw-semibold text-white align-middle">
                <div title="${escapeVidHtml(seg.text)}">${escapeVidHtml(seg.name)}</div>
                ${mustHaveBadge}
            </td>
            <td class="text-center align-middle">
                <input type="number" 
                       class="form-control form-control-sm text-center fw-bold mx-auto weight-input" 
                       value="${seg.weight || 10}" 
                       onchange="updateVideoSegmentWeight(${seg.id}, this.value)">
            </td>
            <td class="text-center align-middle">
                ${slotsHtml}
            </td>
            ${conceptTdsHtml}
            <td class="text-center align-middle">
                <button class="btn btn-sm text-white px-3 rounded-1 shadow-sm fw-semibold" style="background-color: #a855f7;" onclick="openEditVideoModal(${seg.id})">
                    <i class="bi bi-pencil-square me-1"></i> Sửa
                </button>
            </td>
        </tr>
    `;
}

async function toggleSegmentConcept(segId, conceptId, checkbox) {
    try {
        const res = await fetch(`/api/video-segments/${segId}/toggle-concept/${conceptId}`, { method: 'POST' });
        if (!res.ok) throw new Error("Cập nhật thất bại");
        const td = checkbox.closest('td');
        td.classList.add('table-success');
        setTimeout(() => td.classList.remove('table-success'), 500);
    } catch (e) {
        alert("Lỗi: " + e.message);
        checkbox.checked = !checkbox.checked;
    }
}

async function updateVideoSegmentWeight(segId, newWeight) {
    const weightVal = parseInt(newWeight);
    if (isNaN(weightVal)) return;

    try {
        const response = await fetch(`/api/video-segments/${segId}/weight`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ weight: weightVal })
        });
        if (!response.ok) throw new Error("Lỗi API");
        
        const row = document.getElementById(`seg-row-${segId}`);
        if (row) {
            row.classList.add('table-success');
            setTimeout(() => row.classList.remove('table-success'), 800);
        }
    } catch (error) {
        alert("Lỗi cập nhật trọng số: " + error.message);
        loadVideoSegments(); 
    }
}

function openVideoSegmentModal() {
    try {
        document.getElementById('videoSegmentModalLabel').innerHTML = `<i class="bi bi-film me-2"></i> Thêm Phân Cảnh Mới`;
        document.getElementById('modalVideoSegId').value = "";
        document.getElementById('modalVideoSegName').value = "";
        document.getElementById('modalVideoSegPrompt').value = "";
        
        if (document.getElementById('modalVideoWeight')) document.getElementById('modalVideoWeight').value = "10";
        if (document.getElementById('modalVideoFeatureId')) document.getElementById('modalVideoFeatureId').value = "";
        if (document.getElementById('modalVideoMustHave')) document.getElementById('modalVideoMustHave').checked = false;
        
        document.querySelectorAll('.modal-slot-chk').forEach(chk => chk.checked = true);
        
        const modalEl = document.getElementById('videoSegmentModal');
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    } catch (error) {
        console.error("Lỗi khi mở Modal Thêm:", error);
        alert("Không thể mở Modal. Hãy nhấn F12 (tab Console) để xem thẻ HTML nào đang bị thiếu ID.");
    }
}

function openEditVideoModal(segId) {
    try {
        const seg = cachedVideoSegments.find(s => s.id === segId);
        if (!seg) return alert("Không tìm thấy dữ liệu phân cảnh này!");
        
        document.getElementById('videoSegmentModalLabel').innerHTML = `<i class="bi bi-film me-2"></i> Chỉnh Sửa Phân Cảnh`;
        document.getElementById('modalVideoSegId').value = seg.id;
        document.getElementById('modalVideoSegName').value = seg.name || "";
        document.getElementById('modalVideoSegPrompt').value = seg.text || "";
        
        if (document.getElementById('modalVideoWeight')) document.getElementById('modalVideoWeight').value = seg.weight || 10;
        if (document.getElementById('modalVideoFeatureId')) document.getElementById('modalVideoFeatureId').value = seg.required_feature_id || "";
        if (document.getElementById('modalVideoMustHave')) document.getElementById('modalVideoMustHave').checked = seg.is_must_have || false;
        
        let slots = [];
        try { slots = typeof seg.allowed_slots === 'string' ? JSON.parse(seg.allowed_slots) : (seg.allowed_slots || []); } 
        catch(e) { slots = []; }
        
        document.querySelectorAll('.modal-slot-chk').forEach(chk => {
            chk.checked = slots.includes(parseInt(chk.value));
        });

        const modalEl = document.getElementById('videoSegmentModal');
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    } catch (error) {
        console.error("Lỗi khi mở Modal Sửa:", error);
        alert("Không thể mở Modal. Hãy nhấn F12 (tab Console) để xem chi tiết.");
    }
}

async function submitVideoSegmentForm() {
    const id = document.getElementById('modalVideoSegId').value;
    const slots = [];
    document.querySelectorAll('.modal-slot-chk:checked').forEach(chk => slots.push(parseInt(chk.value)));
    const featureVal = document.getElementById('modalVideoFeatureId').value;
    
    const weightVal = parseInt(document.getElementById('modalVideoWeight').value);

    const payload = {
        name: document.getElementById('modalVideoSegName').value.trim(),
        text: document.getElementById('modalVideoSegPrompt').value.trim(),
        required_feature_id: featureVal ? parseInt(featureVal) : null,
        is_must_have: document.getElementById('modalVideoMustHave').checked,
        allowed_slots: JSON.stringify(slots),
        weight: isNaN(weightVal) ? 10 : weightVal
    };

    let url = '/api/video-segments';
    let method = 'POST';
    if (id) { url += `/${id}`; method = 'PUT'; }

    try {
        const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!res.ok) throw new Error("Lỗi lưu dữ liệu.");
        bootstrap.Modal.getInstance(document.getElementById('videoSegmentModal')).hide();
        loadVideoSegments();
    } catch (e) { alert("Lỗi: " + e.message); }
}

async function toggleVideoMustHave(segId, buttonElement) {
    try {
        const response = await fetch(`/api/video-segments/${segId}/toggle-must-have`, { 
            method: 'POST' 
        });
        
        if (!response.ok) throw new Error("Không thể cập nhật trạng thái");

        const result = await response.json();
        
        if (result.is_must_have) {
            buttonElement.className = "badge bg-danger text-white border border-danger rounded-pill px-2 py-1 mt-1 cursor-pointer btn-no-style";
            buttonElement.innerText = "Must Have";
        } else {
            buttonElement.className = "badge bg-secondary bg-opacity-25 text-secondary border border-secondary rounded-pill px-2 py-1 mt-1 cursor-pointer btn-no-style";
            buttonElement.innerText = "Optional";
        }

        const segData = cachedVideoSegments.find(s => s.id === segId);
        if (segData) segData.is_must_have = result.is_must_have;
        
    } catch (error) { 
        alert("Lỗi: " + error.message); 
    }
}

// [ĐÃ DỌN DẸP] Chỉ giữ lại API call dành riêng cho UI nút bấm
async function toggleSegmentSlotBtn(segId, slotId, btnElement) {
    try {
        const res = await fetch(`/api/video-segments/${segId}/toggle-slot/${slotId}`, { method: 'POST' });
        if (!res.ok) throw new Error("Cập nhật Slot thất bại");
        
        const result = await res.json();
        
        const segData = cachedVideoSegments.find(s => s.id === segId);
        if (segData) segData.allowed_slots = result.allowed_slots;

        let currentSlots = [];
        try { currentSlots = JSON.parse(result.allowed_slots); } catch(err){}

        if (currentSlots.includes(slotId)) {
            btnElement.style.backgroundColor = '#a855f7';
            btnElement.style.color = 'white';
            btnElement.style.border = '1px solid #a855f7';
        } else {
            btnElement.style.backgroundColor = 'transparent';
            btnElement.style.color = '#adb5bd';
            btnElement.style.border = '1px solid #6c757d';
        }

        const td = btnElement.closest('td');
        td.classList.add('table-success');
        setTimeout(() => td.classList.remove('table-success'), 500);

    } catch (e) {
        alert("Lỗi: " + e.message);
    }
}

function escapeVidHtml(t) { return t ? t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;") : ''; }