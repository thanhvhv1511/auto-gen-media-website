/**
 * poses.js
 * Quản lý Ma trận Tư Thế & Concepts
 */

// Đổi tên biến để không đụng file khác
let allPoseConcepts = [];
let cachedPoses = [];

document.addEventListener("DOMContentLoaded", async () => {
    await loadPoseConcepts();
    buildPoseTableHeader(); 
    await loadPoses();
    await loadPromptVariableLabels();
});

// 1. Tải danh sách Concepts
async function loadPoseConcepts() {
    try {
        const response = await fetch('/api/concepts');
        if (response.ok) allPoseConcepts = await response.json();
    } catch (error) {
        console.error("Lỗi API Concepts:", error);
    }
}

// 2. Vẽ tiêu đề bảng 
function buildPoseTableHeader() {
    const thead = document.getElementById('poseTableHeader');
    if (!thead) return;

    let html = `
        <tr class="text-uppercase">
            <th scope="col" class="text-center align-middle" width="5%">ID</th>
            <th scope="col" class="align-middle" width="15%">Tên Tư Thế (Label)</th>
            <th scope="col" class="text-center align-middle" width="10%">Trọng số</th>
    `;

    if (allPoseConcepts.length === 0) {
        html += `<th scope="col" class="text-center align-middle text-danger">Chưa có Concept</th>`;
    } else {
        allPoseConcepts.forEach(concept => {
            html += `<th scope="col" class="text-center align-middle" style="min-width: 110px;">${escapePoseHtml(concept.name)}</th>`;
        });
    }

    html += `
            <th scope="col" class="text-center align-middle" width="10%">Trạng Thái</th>
            <th scope="col" class="text-center align-middle" width="10%">Hành Động</th>
        </tr>
    `;
    thead.innerHTML = html;
}

// 3. Tải dữ liệu Pose
async function loadPoses() {
    const tbody = document.getElementById('poseTableBody');
    if (!tbody) return;
    
    try {
        const response = await fetch('/api/poses'); 
        if (!response.ok) throw new Error('Lỗi server');
        
        const poses = await response.json();
        cachedPoses = poses; 
        
        tbody.innerHTML = '';
        if (poses.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${5 + allPoseConcepts.length}" class="text-center py-4 text-muted">Chưa có Tư Thế nào.</td></tr>`;
            return;
        }

        poses.forEach(p => {
            tbody.insertAdjacentHTML('beforeend', createPoseRowHtml(p));
        });
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="10" class="text-center text-danger py-4">Lỗi: ${error.message}</td></tr>`;
    }
}

// 4. Sinh dòng HTML
function createPoseRowHtml(pose) {
    const allowedIds = pose.concept_ids || [];

    let conceptTdsHtml = '';
    allPoseConcepts.forEach(concept => {
        const isChecked = (Array.isArray(allowedIds) ? allowedIds : []).includes(concept.id);
        conceptTdsHtml += `
            <td class="text-center concept-cell align-middle">
                <input class="form-check-input custom-checkbox shadow-none" type="checkbox" 
                       ${isChecked ? 'checked' : ''} 
                       onchange="togglePoseConcept(${pose.id}, ${concept.id}, this)">
            </td>
        `;
    });

    const statusBadge = pose.is_active 
        ? `<button class="badge bg-success bg-opacity-25 text-success border border-success rounded-pill px-3 py-2 cursor-pointer btn-no-style" onclick="togglePoseStatus(${pose.id}, this)">Bật</button>` 
        : `<button class="badge bg-secondary bg-opacity-25 text-secondary border border-secondary rounded-pill px-3 py-2 cursor-pointer btn-no-style" onclick="togglePoseStatus(${pose.id}, this)">Tắt</button>`;

    return `
        <tr id="pose-row-${pose.id}">
            <td class="text-center text-secondary fw-bold align-middle">${pose.id}</td>
            <td class="fw-semibold text-white align-middle" title="${escapePoseHtml(pose.text)}">${escapePoseHtml(pose.pose_name || '')}</td>
            <td class="text-center align-middle">
                <input type="number" class="form-control form-control-sm text-center fw-bold mx-auto weight-input" value="${pose.weight}" onchange="updatePoseWeight(${pose.id}, this.value)">
            </td>
            ${conceptTdsHtml}
            <td class="text-center align-middle">${statusBadge}</td>
            <td class="text-center align-middle">
                <button class="btn btn-sm text-white px-3 rounded-1 shadow-sm fw-semibold" style="background-color: #fd7e14;" onclick="openEditPoseModal(${pose.id})">
                    <i class="bi bi-pencil-square me-1"></i> Sửa
                </button>
            </td>
        </tr>
    `;
}

// 5. Tương tác API
async function togglePoseConcept(poseId, conceptId, checkbox) {
    checkbox.disabled = true;
    try {
        const res = await fetch(`/api/poses/${poseId}/toggle-concept/${conceptId}`, { method: 'POST' });
        
        // Bắt lỗi chi tiết từ backend nếu có
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.detail || "Cập nhật thất bại, vui lòng kiểm tra API Backend");
        }
        
        const td = checkbox.closest('td');
        td.classList.add('table-success');
        setTimeout(() => td.classList.remove('table-success'), 500);
    } catch (e) {
        alert("Lỗi: " + e.message);
        checkbox.checked = !checkbox.checked; // Hoàn tác
    } finally {
        checkbox.disabled = false;
    }
}

async function togglePoseStatus(poseId, btn) {
    try {
        const res = await fetch(`/api/poses/${poseId}/toggle-status`, { method: 'POST' });
        const result = await res.json();
        btn.className = result.is_active 
            ? "badge bg-success bg-opacity-25 text-success border border-success rounded-pill px-3 py-2 cursor-pointer btn-no-style" 
            : "badge bg-secondary bg-opacity-25 text-secondary border border-secondary rounded-pill px-3 py-2 cursor-pointer btn-no-style";
        btn.innerText = result.is_active ? "Bật" : "Tắt";
    } catch (e) { alert("Lỗi: " + e.message); }
}

async function updatePoseWeight(poseId, val) {
    try {
        await fetch(`/api/poses/${poseId}/weight`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ weight: parseInt(val) })
        });
    } catch (e) { alert("Lỗi: " + e.message); loadPoses(); }
}

// 6. Xử lý Modal 
// Hàm mở Modal Thêm mới
function openPoseModal() {
    try {
        document.getElementById('poseModalLabel').innerHTML = `<i class="bi bi-person-arms-up me-2"></i> Thêm Tư Thế Mới`;
        document.getElementById('modalPoseId').value = "";
        
        document.getElementById('modalPoseName').value = ""; 
        document.getElementById('modalPosePrompt').value = "";
        document.getElementById('modalPoseWeight').value = "10";
        
        const modalEl = document.getElementById('poseModal');
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    } catch (error) {
        console.error("Lỗi mở Modal Thêm:", error);
        alert("Lỗi JavaScript. Hãy nhấn F12 (Console) để xem dòng báo đỏ đang thiếu ID nào.");
    }
}

// Hàm mở Modal Chỉnh sửa
function openEditPoseModal(poseId) {
    const pose = cachedPoses.find(p => p.id === poseId);
    if (!pose) return alert("Không tìm thấy dữ liệu!");

    document.getElementById('poseModalLabel').innerHTML = `<i class="bi bi-person-arms-up me-2"></i> Chỉnh Sửa Tư Thế`;
    document.getElementById('modalPoseId').value = pose.id;
    
    // Gán giá trị
    document.getElementById('modalPoseName').value = pose.pose_name || ""; 
    document.getElementById('modalPoseLabel').value = pose.prompt_label || ""; // Chọn đúng label
    document.getElementById('modalPosePrompt').value = pose.text || "";
    document.getElementById('modalPoseWeight').value = pose.weight || 10;
    
    const modalEl = document.getElementById('poseModal');
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
}

// Hàm Submit Form
async function submitPoseForm() {
    const id = document.getElementById('modalPoseId').value;
    const poseName = document.getElementById('modalPoseName').value; // Tên tư thế (VD: Nghiêng trái)
    const promptLabel = document.getElementById('modalPoseLabel').value; // Label (VD: Thân Trên)
    const text = document.getElementById('modalPosePrompt').value.trim();
    const weightVal = parseInt(document.getElementById('modalPoseWeight').value);

    // Kiểm tra đủ dữ liệu
    if (!poseName || !promptLabel || !text) {
        return alert("Vui lòng nhập Tên Tư Thế, Chọn Label và nhập nội dung Prompt!");
    }

    const payload = {
        pose_name: poseName,
        prompt_label: promptLabel, // Phải có trường này
        text: text,
        weight: isNaN(weightVal) ? 10 : weightVal
    };

    let url = '/api/poses'; 
    let method = 'POST';
    if (id) { url += `/${id}`; method = 'PUT'; }

    try {
        const res = await fetch(url, { 
            method, 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(payload) 
        });
        
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.detail || "Lỗi lưu dữ liệu.");
        }
        
        bootstrap.Modal.getInstance(document.getElementById('poseModal')).hide();
        loadPoses(); 
    } catch (e) { 
        alert("Lỗi: " + e.message); 
    }
}

// Hàm load danh sách Label vào Dropdown
async function loadPromptVariableLabels() {
    const selectEl = document.getElementById('modalPoseLabel');
    if (!selectEl) return;

    try {
        const response = await fetch('/api/prompt-variables'); 
        if (!response.ok) throw new Error('Không thể tải danh sách label');
        
        const variables = await response.json();
        
        selectEl.innerHTML = '<option value="" disabled selected>-- Chọn Tên Tư Thế (Label) --</option>';
        
        variables.forEach(v => {
            selectEl.innerHTML += `<option value="${v.label}">${v.label} (Tag: ${v.tag_code})</option>`;
        });
        
    } catch (error) {
        console.error("Lỗi:", error);
        selectEl.innerHTML = '<option value="" disabled selected>Lỗi tải dữ liệu</option>';
    }
}

function escapePoseHtml(t) { return t ? t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;") : ''; }