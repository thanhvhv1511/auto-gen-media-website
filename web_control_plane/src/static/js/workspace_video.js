document.addEventListener('DOMContentLoaded', () => {
    // Tự động load nguồn dữ liệu khi vào trang Video
    loadVideoSources();
});

async function loadVideoSources() {
    const selector = document.getElementById('vidSmartSelector');
    selector.innerHTML = '<option value="">-- Đang quét hệ thống file... --</option>';

    try {
        const response = await fetch('/api/scanned-sources');
        const data = await response.json();
        
        if (!data.sources || data.sources.length === 0) {
            selector.innerHTML = '<option value="">(Trống) Chưa có ảnh nào trong /storage/output_images</option>';
            return;
        }

        selector.innerHTML = '<option value="">-- Chọn Nguồn Hình Ảnh (Render Video) --</option>';

        data.sources.forEach(source => {
            const option = document.createElement('option');
            option.value = source.folder; 
            
            // 🔥 Cập nhật hiển thị: MÃ SẢN PHẨM - TÊN SẢN PHẨM (SỐ LƯỢNG ẢNH)
            option.text = `📁 ${source.folder.toUpperCase()} - ${source.product_name} (${source.image_count} ảnh)`;
            
            // Lưu mảng ảnh
            option.dataset.images = JSON.stringify(source.images);
            
            // THÊM MỚI: Lưu cục feature vào dataset để dùng ở hàm loadProductContext
            option.dataset.feature = JSON.stringify(source.feature || null); 

            selector.appendChild(option);
        });
    } catch (error) {
        console.error("Lỗi khi quét nguồn dữ liệu video:", error);
        selector.innerHTML = '<option value="">⚠️ Lỗi kết nối hệ thống</option>';
    }
}

// Hàm này sẽ được gọi khi bạn chọn một option trong Select
function loadProductContext() {
    const selector = document.getElementById('vidSmartSelector');
    const featureContainer = document.getElementById('featureFlagsContainer'); // Gọi tới div chứa Feature
    const submitBtn = document.getElementById('submitVideoBtn');
    
    const selectedOption = selector.options[selector.selectedIndex];
    
    // Nếu chọn quay về option mặc định (value rỗng)
    if (!selectedOption.value) {
        featureContainer.innerHTML = '<p class="text-muted small mb-0 fst-italic">Vui lòng chọn sản phẩm để hiển thị thuộc tính...</p>';
        if (submitBtn) submitBtn.disabled = true;
        return;
    }

    const folderName = selectedOption.value;
    const imagesList = JSON.parse(selectedOption.dataset.images || '[]');
    
    // THÊM MỚI: Parse dữ liệu feature từ dataset
    const featureData = JSON.parse(selectedOption.dataset.feature || 'null');
    
    console.log(`Đã chọn nguồn: ${folderName}, với các file:`, imagesList);
    
    // THÊM MỚI: Xử lý hiển thị UI cho Feature
    if (featureData) {
        // Render thông số nếu sản phẩm có gán feature
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
        // Render cảnh báo nếu không có feature
        featureContainer.innerHTML = `
            <p class="text-warning small mb-0 fst-italic">Sản phẩm này chưa được liên kết thuộc tính tự động nào.</p>
        `;
    }
    
    // Mở khóa nút submit
    if (submitBtn) submitBtn.disabled = false;
}

// Thay thế đoạn code gây ra alert lỗi bằng đoạn này:
async function submitVideoJob() {
    const selector = document.getElementById('vidSmartSelector');
    const productCode = selector.value; // Cái này là folder name (vd: sp083)

    if (!productCode) {
        alert("Vui lòng chọn nguồn dữ liệu!");
        return;
    }

    try {
        const formData = new FormData();
        formData.append('product_code', productCode);

        const response = await fetch('/jobs/video', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        
        if (response.ok) {
            console.log("✅ Đẩy job video thành công:", result);
            alert("Đã đẩy lệnh vào hàng đợi thành công!");
            // Gọi hàm refresh danh sách hàng đợi nếu có
            if (typeof fetchJobs === 'function') fetchJobs(); 
        } else {
            alert("Lỗi: " + result.detail);
        }
    } catch (err) {
        console.error("Lỗi khi gửi job video:", err);
        alert("Không thể kết nối tới server!");
    }
}