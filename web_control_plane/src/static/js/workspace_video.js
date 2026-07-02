document.addEventListener('DOMContentLoaded', () => {
    initTreeDropdownEvents();
    loadVideoSources(); // Gọi API thật ngay khi load
});

// =========================================
// 1. TẢI DỮ LIỆU TỪ API THẬT
// =========================================
async function loadVideoSources() {
    const label = document.getElementById('treeSelectLabel');
    label.innerHTML = `<i class="spinner-border spinner-border-sm me-2"></i> Đang quét hệ thống file...`;

    try {
        const response = await fetch('/api/scanned-sources');
        const data = await response.json();
        
        if (!data.sources || data.sources.length === 0) {
            label.innerHTML = `<i class="bi bi-exclamation-triangle me-2 text-warning"></i> (Trống) Chưa có ảnh nào trong /storage/output_images`;
            return;
        }

        // Đổ data từ API vào hàm vẽ HTML
        renderTreeMenu(data.sources);

    } catch (error) {
        console.error("Lỗi khi quét nguồn dữ liệu video:", error);
        label.innerHTML = `<i class="bi bi-wifi-off me-2 text-danger"></i> ⚠️ Lỗi kết nối hệ thống`;
    }
}

// =========================================
// 2. VẼ HTML GIAO DIỆN CÂY THƯ MỤC
// =========================================
function renderTreeMenu(dataList) {
    const dropdown = document.getElementById('treeSelectDropdown');
    const label = document.getElementById('treeSelectLabel');
    
    label.innerHTML = `<i class="bi bi-collection-play me-2"></i> -- Chọn thư mục hoặc concept --`;
    let htmlContent = '';

    dataList.forEach(item => {
        const childId = `child-${item.folder}`;
        // Mã hóa JSON feature để nhét vào attribute an toàn
        const featureStr = encodeURIComponent(JSON.stringify(item.feature || null)); 

        // HTML cho thư mục cha (Sản phẩm)
        htmlContent += `
            <div class="tree-node">
                <div class="tree-item-row">
                    <div class="tree-item-content" onclick="selectTreeItem('${item.folder}', '${item.folder.toUpperCase()} (Tất cả Concept)', '${featureStr}')">
                        <i class="bi bi-folder-fill text-warning me-2"></i>
                        <span class="fw-bold">${item.folder.toUpperCase()} - ${item.product_name}</span>
                        <span class="badge bg-secondary badge-count">${item.image_count}</span>
                    </div>
                    ${item.concepts && item.concepts.length > 0 ? `
                        <button type="button" class="tree-toggle-btn" onclick="toggleTreeChildren('${childId}', this, event)">
                            <i class="bi bi-chevron-down"></i>
                        </button>
                    ` : ''}
                </div>
        `;

        // HTML cho thư mục con (Concept)
        if (item.concepts && item.concepts.length > 0) {
            htmlContent += `<div class="tree-children" id="${childId}">`;
            item.concepts.forEach(concept => {
                // VALUE lưu cả SP và Concept: sp003/concept-4
                const conceptValue = `${item.folder}/concept-${concept.id}`;
                const conceptLabel = `${item.folder.toUpperCase()} ➔ Concept ${concept.id}`;
                
                htmlContent += `
                    <div class="tree-child-item" onclick="selectTreeItem('${conceptValue}', '${conceptLabel}', '${featureStr}')">
                        <i class="bi bi-film text-muted me-2"></i>
                        <span class="tech-font text-light" style="font-size: 0.9rem;">${concept.name}</span>
                        <span class="badge bg-dark badge-count">${concept.image_count}</span>
                    </div>
                `;
            });
            htmlContent += `</div>`; 
        }
        
        htmlContent += `</div>`; 
    });

    dropdown.innerHTML = htmlContent;
}

// =========================================
// 3. LOGIC SỰ KIỆN MENU
// =========================================
function initTreeDropdownEvents() {
    const trigger = document.getElementById('treeSelectTrigger');
    const dropdown = document.getElementById('treeSelectDropdown');

    trigger.addEventListener('click', () => {
        dropdown.classList.toggle('show');
        trigger.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
        if (!trigger.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('show');
            trigger.classList.remove('active');
        }
    });
}

function toggleTreeChildren(childId, btnElement, event) {
    event.stopPropagation(); // Ngăn click lan ra ngoài
    const childDiv = document.getElementById(childId);
    if(childDiv) {
        childDiv.classList.toggle('show');
        btnElement.classList.toggle('expanded');
    }
}

function selectTreeItem(selectedValue, displayLabel, encodedFeatureStr) {
    const trigger = document.getElementById('treeSelectTrigger');
    const dropdown = document.getElementById('treeSelectDropdown');
    const label = document.getElementById('treeSelectLabel');
    
    label.innerHTML = `<i class="bi bi-check2-circle text-success me-2"></i> ${displayLabel}`;
    label.classList.add('text-white');
    
    dropdown.classList.remove('show');
    trigger.classList.remove('active');

    // Lưu vào input ẩn
    const hiddenInput = document.getElementById('vidSmartSelector');
    hiddenInput.value = selectedValue;
    hiddenInput.dataset.feature = encodedFeatureStr; 
    
    loadProductContext();
}

// =========================================
// 4. XỬ LÝ CONTEXT FEATURE
// =========================================
function loadProductContext() {
    const hiddenInput = document.getElementById('vidSmartSelector');
    const featureContainer = document.getElementById('featureFlagsContainer');
    const submitBtn = document.getElementById('submitVideoBtn');
    
    const selectedValue = hiddenInput.value;
    
    if (!selectedValue) {
        featureContainer.innerHTML = '<p class="text-muted small mb-0 fst-italic">Vui lòng chọn sản phẩm để hiển thị thuộc tính...</p>';
        if (submitBtn) submitBtn.disabled = true;
        return;
    }

    let featureData = null;
    try {
        const rawFeature = hiddenInput.dataset.feature;
        if (rawFeature && rawFeature !== "null" && rawFeature !== "undefined") {
            featureData = JSON.parse(decodeURIComponent(rawFeature));
        }
    } catch (e) {
        console.error("Lỗi parse feature data:", e);
    }
    
    if (featureData) {
        featureContainer.innerHTML = `
            <div class="text-info mb-0">
                <strong><i class="bi bi-sliders"></i> Thuộc tính đang kích hoạt:</strong>
                <ul class="mb-0 mt-1 pl-3 text-light">
                    <li><strong>Tên tính năng:</strong> <span class="text-warning">${featureData.feature_name}</span></li>
                    <li><small class="text-muted">ID Cấu hình: ${featureData.id}</small></li>
                </ul>
            </div>
        `;
    } else {
        featureContainer.innerHTML = `
            <p class="text-warning small mb-0 fst-italic">Sản phẩm này chưa được liên kết thuộc tính tự động nào.</p>
        `;
    }
    
    if (submitBtn) submitBtn.disabled = false;
}

// =========================================
// 5. HIỂN THỊ MODAL THÔNG BÁO & XÁC NHẬN
// =========================================

// Hàm hiển thị Popup Custom Alert thay cho alert() mặc định
function showCustomAlert(title, message, isError = false) {
    document.getElementById('alertModalTitle').innerHTML = title;
    document.getElementById('alertModalBody').innerHTML = message;
    
    const headerTitle = document.getElementById('alertModalTitle');
    if (isError) {
        headerTitle.className = "modal-title w-100 text-center text-danger";
    } else {
        headerTitle.className = "modal-title w-100 text-center text-success";
    }
    
    // Sử dụng getOrCreateInstance để tối ưu bộ nhớ
    const alertModal = bootstrap.Modal.getOrCreateInstance(document.getElementById('customAlertModal'));
    alertModal.show();
}

// Hàm kích hoạt Confirm Modal khi bấm Submit Form
function triggerVideoJob(event) {
    if (event) event.preventDefault(); // Ngăn trình duyệt reload trang
    
    const hiddenInput = document.getElementById('vidSmartSelector');
    const productCode = hiddenInput.value; 
    const aiModel = document.getElementById('aiModelSelector').value;

    // Validate nhanh
    if (!productCode) {
        showCustomAlert(
            "<i class='bi bi-exclamation-triangle'></i> Thiếu dữ liệu", 
            "Vui lòng chọn Nguồn Dữ Liệu (Sản phẩm/Concept) trước khi chạy!", 
            true
        );
        return;
    }

    // Đổ dữ liệu hiển thị vào Modal Confirm
    document.getElementById('confirmSourceText').innerText = productCode;
    document.getElementById('confirmModelText').innerText = aiModel.toUpperCase();
    
    // Sử dụng getOrCreateInstance
    const confirmModal = bootstrap.Modal.getOrCreateInstance(document.getElementById('confirmSubmitModal'));
    confirmModal.show();
}

// Gắn sự kiện submit cho form
document.getElementById('videoJobForm')?.addEventListener('submit', triggerVideoJob);

// =========================================
// 6. THỰC THI FETCH API (GỌI TỪ NÚT XÁC NHẬN TRONG MODAL)
// =========================================
async function executeVideoJob() {
    // Ẩn modal confirm đi
    const confirmModalEl = document.getElementById('confirmSubmitModal');
    const confirmModal = bootstrap.Modal.getInstance(confirmModalEl);
    if(confirmModal) confirmModal.hide();

    // Lấy lại các giá trị input
    const hiddenInput = document.getElementById('vidSmartSelector');
    const productCode = hiddenInput.value;
    const aiModel = document.getElementById('aiModelSelector').value;

    try {
        const formData = new FormData();
        formData.append('product_code', productCode);
        formData.append('ai_model', aiModel);

        const response = await fetch('/jobs/video', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        
        if (response.ok) {
            console.log(`✅ Đẩy job video thành công (Model: ${aiModel}):`, result);
            showCustomAlert(
                "<i class='bi bi-check-circle'></i> Thành công!", 
                `Đã đẩy lệnh vào hàng đợi thành công sử dụng mô hình <strong>${aiModel.toUpperCase()}</strong>!`
            );
            
            // Reload lại bảng danh sách nếu hàm fetchJobs tồn tại ở file khác
            if (typeof fetchJobs === 'function') fetchJobs(); 
        } else {
            showCustomAlert("<i class='bi bi-x-octagon'></i> Lỗi hệ thống", result.detail || "Không thể đẩy job.", true);
        }
    } catch (err) {
        console.error("Lỗi khi gửi job video:", err);
        showCustomAlert("<i class='bi bi-wifi-off'></i> Mất kết nối", "Không thể kết nối tới server! Vui lòng kiểm tra mạng.", true);
    }
}