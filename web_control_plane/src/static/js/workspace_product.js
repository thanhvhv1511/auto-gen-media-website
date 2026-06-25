// Biến cờ bảo vệ để tránh xung đột dữ liệu khi tải đồng thời
let isDataFetching = false;
let isCreateNewFeatureMode = false; // Theo dõi chế độ nhập tính năng (mới hay cũ)

/**
 * Hàm lõi chịu trách nhiệm kéo dữ liệu Master Data từ Server về Client một cách đồng bộ.
 */
async function syncMasterDataFromServer() {
    if (isDataFetching) return;
    isDataFetching = true;
    try {
        if (typeof fetchMasterData === 'function') {
            await fetchMasterData();
        } else {
            const res = await fetch('/api/master-data');
            if (!res.ok) throw new Error(`HTTP status code: ${res.status}`);
            window.GLOBAL_DB = await res.json();
        }
    } catch (err) {
        console.error("❌ Lỗi nghiêm trọng khi đồng bộ Master Data từ API:", err);
        const tbody = document.getElementById('productTableBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger py-4"><i class="bi bi-exclamation-triangle-fill"></i> Mất kết nối máy chủ dữ liệu. Vui lòng thử lại!</td></tr>';
        }
        throw err;
    } finally {
        isDataFetching = false;
    }
}

/**
 * Điều khiển trạng thái ẩn/hiện giữa ô Chọn cấu trúc cũ và ô Nhập tính năng mới
 */
function toggleFeatureInputMode() {
    const selectWrapper = document.getElementById('featureSelectWrapper');
    const inputWrapper = document.getElementById('featureInputWrapper');
    const toggleBtn = document.getElementById('toggleFeatureModeBtn');
    
    const selectElem = document.getElementById('featureId');
    const inputElem = document.getElementById('featureName');

    isCreateNewFeatureMode = !isCreateNewFeatureMode;

    if (isCreateNewFeatureMode) {
        // Chuyển sang chế độ nhập mới
        selectWrapper.classList.add('d-none');
        inputWrapper.classList.remove('d-none');
        toggleBtn.innerHTML = '<i class="bi bi-list-ul"></i> Chọn tính năng sẵn có';
        toggleBtn.classList.replace('text-info', 'text-warning');
        selectElem.value = ""; // Xóa giá trị ô select
        setTimeout(() => inputElem.focus(), 50);
    } else {
        // Quay về chế độ chọn từ danh sách
        selectWrapper.classList.remove('d-none');
        inputWrapper.classList.add('d-none');
        toggleBtn.innerHTML = '<i class="bi bi-plus-square"></i> Tạo tính năng mới';
        toggleBtn.classList.replace('text-warning', 'text-info');
        inputElem.value = ""; // Xóa text vừa gõ dở
    }
}

/**
 * Vẽ bảng danh sách sản phẩm từ trạng thái dữ liệu hiện tại trong RAM (GLOBAL_DB)
 */
function renderProductTable() {
    const tbody = document.getElementById('productTableBody');
    if (!tbody) return;

    if (!window.GLOBAL_DB || !window.GLOBAL_DB.products) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">Đang tải cấu trúc dữ liệu...</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    
    if (window.GLOBAL_DB.products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">Hệ thống chưa lưu trữ sản phẩm nào</td></tr>';
        return;
    }

    window.GLOBAL_DB.products.forEach(p => {
        let featureBadge = '<span class="badge bg-secondary opacity-50">Không phân loại</span>';
        if (p.feature_id && window.GLOBAL_DB.features && window.GLOBAL_DB.features[p.feature_id]) {
            featureBadge = `<span class="badge bg-success shadow-sm">${window.GLOBAL_DB.features[p.feature_id]}</span>`;
        }

        const tr = document.createElement('tr');
        tr.className = "align-middle";
        tr.innerHTML = `
            <td class="ps-4 tech-font text-muted">#${p.id}</td>
            <td class="fw-bold text-warning tech-font">${p.product_code}</td>
            <td class="text-light fw-semibold">${p.product_name}</td>
            <td>${featureBadge}</td>
            <td class="text-end pe-4">
                <button class="btn btn-sm btn-outline-info opacity-75" title="Chỉnh sửa thông tin sản phẩm (Coming soon)">
                    <i class="bi bi-pencil"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

/**
 * Nạp danh sách tính năng (Product Features) vào ô lựa chọn (Select Dropdown) bên form nhập liệu
 */
function initProductFormSelects() {
    const featureSelect = document.getElementById('featureId');
    if (!featureSelect) return;

    featureSelect.innerHTML = '<option value="">-- Không có / Bỏ qua --</option>';
    
    if (window.GLOBAL_DB && window.GLOBAL_DB.features) {
        for (const [id, name] of Object.entries(window.GLOBAL_DB.features)) {
            featureSelect.innerHTML += `<option value="${id}">${name}</option>`;
        }
    }
}

/**
 * Phân tích mã sản phẩm hiện tại, tự động đề xuất mã tiếp theo dạng chữ thường (lowercase) tăng dần
 */
function suggestNextProductCode() {
    const input = document.getElementById('productCode');
    if (!input) return;

    if (!window.GLOBAL_DB || !window.GLOBAL_DB.products || window.GLOBAL_DB.products.length === 0) {
        input.value = "sp001";
        return;
    }

    let maxNum = 0;
    const currentPrefix = "sp";
    let padLength = 3; 

    window.GLOBAL_DB.products.forEach(p => {
        const match = p.product_code.match(/^([a-zA-Z]+)(\d+)$/);
        if (match) {
            const prefix = match[1].toLowerCase();
            const numStr = match[2];
            const num = parseInt(numStr, 10);
            
            if (prefix === currentPrefix && num > maxNum) {
                maxNum = num;
                padLength = numStr.length; 
            }
        }
    });

    const nextNum = maxNum + 1;
    input.value = currentPrefix + String(nextNum).padStart(padLength, '0');
}

/**
 * Hàm xử lý kích hoạt từ sự kiện click nút Refresh trên thanh công cụ của bảng dữ liệu
 */
async function refreshProductData() {
    const refreshBtn = document.querySelector('[onclick="refreshProductData()"]');
    if (refreshBtn) refreshBtn.classList.add('fa-spin');
    
    try {
        await syncMasterDataFromServer();
        renderProductTable();
        initProductFormSelects();
        suggestNextProductCode();
    } catch (err) {
        console.error("Lỗi khi ép tải lại thủ công danh sách sản phẩm:", err);
    } finally {
        if (refreshBtn) refreshBtn.classList.remove('fa-spin');
    }
}

/**
 * Lắng nghe sự kiện sẵn sàng của DOM để dựng toàn bộ luồng điều khiển
 */
document.addEventListener('DOMContentLoaded', async () => {
    
    try {
        await syncMasterDataFromServer();
        initProductFormSelects();
        renderProductTable();
        suggestNextProductCode();
    } catch (err) {
        console.warn("Luồng khởi tạo UI tạm dừng do lỗi tải Master Data ban đầu.");
    }

    const productBtn = document.getElementById('submitProductBtn');
    if (productBtn) {
        productBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            
            const form = document.getElementById('productForm');
            if (!form.checkValidity()) {
                form.reportValidity(); 
                return;
            }

            productBtn.disabled = true;
            productBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Đang lưu cấu trúc...';

            // Xây dựng payload thông minh tùy theo chế độ đang được toggle hiển thị
            const payload = {
                product_code: document.getElementById('productCode').value.trim(),
                product_name: document.getElementById('productName').value.trim(),
                feature_id: (!isCreateNewFeatureMode && document.getElementById('featureId').value) ? parseInt(document.getElementById('featureId').value, 10) : null,
                feature_name: (isCreateNewFeatureMode && document.getElementById('featureName').value) ? document.getElementById('featureName').value.trim() : null
            };

            try {
                const response = await fetch('/api/products', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                const result = await response.json();
                if (!response.ok) throw new Error(result.detail || 'Lỗi xử lý nghiệp vụ từ API');
                
                form.reset();
                
                // Trả ô nhập tính năng về lại trạng thái select mặc định
                if (isCreateNewFeatureMode) {
                    toggleFeatureInputMode();
                }

                await syncMasterDataFromServer();
                
                renderProductTable();
                initProductFormSelects();
                suggestNextProductCode();
                
            } catch (err) {
                console.error("❌ Thất bại khi đẩy yêu cầu thêm mới sản phẩm:", err);
                alert("Không thể lưu sản phẩm. Chi tiết: " + err.message);
            } finally {
                productBtn.disabled = false;
                productBtn.innerHTML = '<i class="bi bi-plus-circle-fill"></i> Thêm Mới Sản Phẩm';
            }
        });
    }
});