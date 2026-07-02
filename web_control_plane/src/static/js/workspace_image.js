function initJobFormSelects() {
    console.log("🛠️ Đang cố gắng nạp dữ liệu vào Select... Data hiện tại:", GLOBAL_DB);

    // 1. Đổ dữ liệu vào Select Sản phẩm
    const productSelect = document.getElementById('productId');
    if (productSelect && GLOBAL_DB && GLOBAL_DB.products) {
        productSelect.innerHTML = '<option value="">-- Chọn sản phẩm xử lý --</option>';
        GLOBAL_DB.products.forEach(p => {
            productSelect.innerHTML += `<option value="${p.id}">[${p.product_code}] - ${p.product_name}</option>`;
        });
        console.log(`✅ Đã nạp ${GLOBAL_DB.products.length} sản phẩm.`);
    } else {
        console.warn("⚠️ Không tìm thấy thẻ #productId hoặc GLOBAL_DB.products rỗng");
    }

    // 2. Đổ dữ liệu vào Select Concept (Bọc thép an toàn tuyệt đối)
    const conceptSelect = document.getElementById('conceptId');
    if (conceptSelect && GLOBAL_DB && GLOBAL_DB.concepts) {
        conceptSelect.innerHTML = '<option value="">-- Chọn Concept Mẫu --</option>';
        
        GLOBAL_DB.concepts.forEach(c => {
            // FIX TẠI ĐÂY: Chấp nhận mọi trường hợp is_active là true, null, hoặc undefined
            if (c.is_active === true || c.is_active === 1 || c.is_active === undefined || c.is_active === null) {
                conceptSelect.innerHTML += `<option value="${c.id}">${c.name}</option>`;
            }
        });
        console.log(`✅ Đã nạp các Concept hoạt động.`);
    } else {
        console.warn("⚠️ Không tìm thấy thẻ #conceptId hoặc GLOBAL_DB.concepts rỗng");
    }
}

// Đảm bảo chạy khi DOM đã sẵn sàng
// Đảm bảo chạy khi DOM đã sẵn sàng
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('submitBtn');
    
    if (btn) {
        // Đổi sang lắng nghe sự kiện Click thay vì Submit để triệt tiêu Refresh trang
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            
            const form = document.getElementById('jobForm');
            if (!form.checkValidity()) {
                form.reportValidity(); // Hiện thông báo required của HTML5
                return;
            }

            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Đang đẩy...';

            const formData = new FormData();
            formData.append('product_id', document.getElementById('productId').value);
            formData.append('concept_id', document.getElementById('conceptId').value);
            formData.append('file', document.getElementById('imageFile').files[0]);
            formData.append('loop_count', document.getElementById('loopCount').value);

            try {
                // LƯU Ý: Đảm bảo route này đã đúng (có cần thêm /api/jobs/image không?)
                const response = await fetch('/jobs/image', { method: 'POST', body: formData });
                
                // === XỬ LÝ ĐỌC LỖI CHI TIẾT TỪ BACKEND ===
                if (!response.ok) {
                    let errorDetail = response.statusText;
                    try {
                        // Cố gắng parse body trả về thành JSON (FastAPI thường trả về JSON chứa key "detail")
                        const errorData = await response.json();
                        console.error("🔥 Dữ liệu lỗi từ Backend (JSON):", errorData);
                        
                        // Lọc lấy chi tiết lỗi để hiển thị cho người dùng
                        errorDetail = errorData.detail 
                                        ? (typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail)) 
                                        : JSON.stringify(errorData);
                    } catch (parseErr) {
                        // Nếu backend không trả về JSON thì đọc dạng Text
                        const errorText = await response.text();
                        console.error("🔥 Dữ liệu lỗi từ Backend (Text):", errorText);
                        if (errorText) errorDetail = errorText;
                    }
                    
                    throw new Error(`[Mã lỗi: ${response.status}] ${errorDetail}`);
                }
                
                form.reset();
                if (typeof fetchJobs === 'function') fetchJobs();
                console.log("✅ Đẩy job ảnh thành công!");

            } catch (err) {
                console.error("❌ Submit lỗi:", err);
                // Hiển thị alert chứa chính xác nguyên nhân lỗi
                alert("Đẩy lệnh thất bại:\n" + err.message);
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<i class="bi bi-rocket-takeoff-fill"></i> Đẩy Lệnh Vào Hàng Đợi';
            }
        });
    }
});
