/**
 * backgrounds.js
 * Quản lý Ma trận Bối Cảnh & Concepts
 */

// Đổi tên biến toàn cục để không đụng file khác
let allBgConcepts = [];
let cachedBackgrounds = [];

// Khởi tạo khi trang đã tải xong
document.addEventListener("DOMContentLoaded", async () => {
    await loadBgConcepts();
    buildBgTableHeader(); 
    await loadBackgrounds();
});

// ==========================================
// 1. CÁC HÀM TẢI DỮ LIỆU & RENDER GIAO DIỆN
// ==========================================

async function loadBgConcepts() {
    try {
        const response = await fetch('/api/concepts');
        if (response.ok) {
            allBgConcepts = await response.json();
        } else {
            console.error("Lỗi khi tải Concepts API");
        }
    } catch (error) {
        console.error("Không kết nối được API Concepts:", error);
    }
}

function buildBgTableHeader() {
    const thead = document.getElementById('backgroundTableHeader');
    if (!thead) return;

    let html = `
        <tr class="text-uppercase">
            <th scope="col" class="text-center align-middle" width="5%">ID</th>
            <th scope="col" class="align-middle" width="20%">Tên Bối Cảnh</th>
            <th scope="col" class="text-center align-middle" width="10%">Trọng Số</th>
    `;

    if (allBgConcepts.length === 0) {
        html += `<th scope="col" class="text-center align-middle text-danger">Chưa có Concept</th>`;
    } else {
        allBgConcepts.forEach(concept => {
            html += `
                <th scope="col" class="text-center align-middle" style="min-width: 130px;">
                    ${escapeBgHtml(concept.name)}
                </th>
            `;
        });
    }

    html += `
            <th scope="col" class="text-center align-middle" width="10%">Trạng Thái</th>
            <th scope="col" class="text-center align-middle" width="10%">Hành Động</th>
        </tr>
    `;
    thead.innerHTML = html;
}

async function loadBackgrounds() {
    const tbody = document.getElementById('backgroundTableBody');
    if (!tbody) return;
    
    try {
        const response = await fetch('/api/backgrounds');
        if (!response.ok) throw new Error('Lỗi server');
        
        const backgrounds = await response.json();
        cachedBackgrounds = backgrounds; 
        
        tbody.innerHTML = '';
        
        if (backgrounds.length === 0) {
            const totalCols = 5 + allBgConcepts.length; 
            tbody.innerHTML = `<tr><td colspan="${totalCols}" class="text-center py-4 text-muted">Chưa có Background nào.</td></tr>`;
            return;
        }

        backgrounds.forEach(bg => {
            tbody.insertAdjacentHTML('beforeend', createBgRowHtml(bg));
        });
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="10" class="text-center text-danger py-4">Lỗi: ${error.message}</td></tr>`;
    }
}

function createBgRowHtml(bg) {
    // [CẬP NHẬT] API mới trả về mảng trực tiếp, không cần parse gì cả
    const allowedIds = Array.isArray(bg.allowed_concepts) ? bg.allowed_concepts : [];

    let conceptTdsHtml = '';
    if (allBgConcepts.length === 0) {
        conceptTdsHtml = `<td class="text-center concept-cell text-muted">-</td>`;
    } else {
        allBgConcepts.forEach(concept => {
            // [CẬP NHẬT] Đơn giản hóa: chỉ cần kiểm tra xem concept.id có trong mảng không
            const isChecked = allowedIds.includes(concept.id);
            conceptTdsHtml += `
                <td class="text-center concept-cell align-middle">
                    <input class="form-check-input custom-checkbox shadow-none" 
                           type="checkbox" 
                           id="chk-bg-${bg.id}-con-${concept.id}" 
                           ${isChecked ? 'checked' : ''} 
                           onchange="toggleBgConceptCheckbox(${bg.id}, ${concept.id}, this)">
                </td>
            `;
        });
    }

    const statusBadge = bg.is_active 
        ? `<button class="badge bg-success bg-opacity-25 text-success border border-success rounded-pill px-3 py-2 cursor-pointer btn-no-style" 
                   onclick="toggleBackgroundStatus(${bg.id}, this)">Bật</button>` 
        : `<button class="badge bg-secondary bg-opacity-25 text-secondary border border-secondary rounded-pill px-3 py-2 cursor-pointer btn-no-style" 
                   onclick="toggleBackgroundStatus(${bg.id}, this)">Tắt</button>`;

    return `
        <tr id="bg-row-${bg.id}">
            <td class="text-center text-secondary fw-bold align-middle">${bg.id}</td>
            <td class="fw-semibold text-white align-middle">${escapeBgHtml(bg.name)}</td>
            <td class="text-center align-middle">
                <input type="number" 
                       class="form-control form-control-sm text-center fw-bold mx-auto weight-input" 
                       value="${bg.weight}" 
                       onchange="updateBgWeight(${bg.id}, this.value)">
            </td>
            
            ${conceptTdsHtml}
            
            <td class="text-center align-middle">${statusBadge}</td>
            <td class="text-center align-middle">
                <button class="btn btn-sm btn-primary px-3 rounded-1 shadow-sm fw-semibold" 
                        onclick="openBgEditModal(${bg.id})">
                    <i class="bi bi-pencil-square me-1"></i> Sửa
                </button>
            </td>
        </tr>
    `;
}
// ==========================================
// 2. CÁC HÀM XỬ LÝ SỰ KIỆN TRỰC TIẾP TRÊN BẢNG
// ==========================================

async function toggleBgConceptCheckbox(bgId, conceptId, checkboxElement) {
    try {
        const response = await fetch(`/api/backgrounds/${bgId}/toggle-concept/${conceptId}`, { method: 'POST' });
        if (!response.ok) throw new Error("Cập nhật thất bại");
        
        const td = checkboxElement.closest('td');
        td.classList.add('table-success');
        setTimeout(() => td.classList.remove('table-success'), 500);
    } catch (error) {
        alert("Lỗi: " + error.message);
        checkboxElement.checked = !checkboxElement.checked; 
    }
}

async function toggleBackgroundStatus(bgId, buttonElement) {
    try {
        const response = await fetch(`/api/backgrounds/${bgId}/toggle-status`, { method: 'POST' });
        if (!response.ok) throw new Error("Không thể cập nhật trạng thái hệ thống");

        const result = await response.json();
        if (result.is_active) {
            buttonElement.className = "badge bg-success bg-opacity-25 text-success border border-success rounded-pill px-3 py-2 cursor-pointer btn-no-style";
            buttonElement.innerText = "Bật";
        } else {
            buttonElement.className = "badge bg-secondary bg-opacity-25 text-secondary border border-secondary rounded-pill px-3 py-2 cursor-pointer btn-no-style";
            buttonElement.innerText = "Tắt";
        }

        const bgData = cachedBackgrounds.find(b => b.id === bgId);
        if (bgData) bgData.is_active = result.is_active;
    } catch (error) { alert("Lỗi: " + error.message); }
}

async function updateBgWeight(bgId, newWeight) {
    const weightVal = parseInt(newWeight);
    if (isNaN(weightVal)) return;

    try {
        const response = await fetch(`/api/backgrounds/${bgId}/weight`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ weight: weightVal })
        });
        if (!response.ok) throw new Error("Lỗi API");
        
        const row = document.getElementById(`bg-row-${bgId}`);
        if (row) {
            row.classList.add('table-success');
            setTimeout(() => row.classList.remove('table-success'), 800);
        }
    } catch (error) {
        alert("Lỗi cập nhật trọng số: " + error.message);
        loadBackgrounds(); 
    }
}

// ==========================================
// 3. CÁC HÀM XỬ LÝ MODAL (THÊM / SỬA)
// ==========================================

function openBgCreateModal() {
    document.getElementById('backgroundModalLabel').innerText = "Thêm Bối Cảnh Mới";
    document.getElementById('modalBgId').value = "";
    document.getElementById('modalBgName').value = "";
    document.getElementById('modalBgText').value = "";
    document.getElementById('modalBgWeight').value = "10";
    
    const myModal = new bootstrap.Modal(document.getElementById('backgroundModal'));
    myModal.show();
}

function openBgEditModal(bgId) {
    const bgData = cachedBackgrounds.find(b => b.id === bgId);
    if (!bgData) return alert("Không tìm thấy dữ liệu bối cảnh này!");

    document.getElementById('backgroundModalLabel').innerText = "Chỉnh Sửa Bối Cảnh";
    document.getElementById('modalBgId').value = bgData.id;
    document.getElementById('modalBgName').value = bgData.name;
    document.getElementById('modalBgText').value = bgData.text;
    document.getElementById('modalBgWeight').value = bgData.weight;

    const myModal = new bootstrap.Modal(document.getElementById('backgroundModal'));
    myModal.show();
}

async function submitBackgroundForm() {
    const bgId = document.getElementById('modalBgId').value;
    const name = document.getElementById('modalBgName').value.trim();
    const text = document.getElementById('modalBgText').value.trim();
    const weight = parseInt(document.getElementById('modalBgWeight').value);

    if (!name || !text) return alert("Vui lòng nhập đầy đủ Tên và Nội dung mô tả.");

    const payload = {
        name: name,
        text: text,
        weight: isNaN(weight) ? 10 : weight
    };

    try {
        let url = '/api/backgrounds';
        let method = 'POST'; 
        if (bgId) { url = `/api/backgrounds/${bgId}`; method = 'PUT'; }

        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error((await response.json()).detail || "Không thể lưu dữ liệu.");

        const modalInstance = bootstrap.Modal.getInstance(document.getElementById('backgroundModal'));
        if (modalInstance) modalInstance.hide();

        await loadBackgrounds(); 
    } catch (error) { alert("Lỗi khi lưu: " + error.message); }
}

// ==========================================
// 4. HÀM TIỆN ÍCH
// ==========================================
function escapeBgHtml(text) { 
    return text ? text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;") : ''; 
}