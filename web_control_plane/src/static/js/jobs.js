// ==========================================
// 1. Form Khởi tạo Job Ảnh
// ==========================================
document.getElementById('jobForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Đang xử lý...';

    const pCodeInput = document.getElementById('productCode').value.trim().toLowerCase();
    
    // Đổi từ Product Code sang Product ID để gửi xuống Backend
    const targetProduct = GLOBAL_DB.products.find(p => p.product_code === pCodeInput);
    if (!targetProduct) {
        alert("Mã sản phẩm không tồn tại trên hệ thống. Vui lòng thêm ở Master Data trước!");
        btn.disabled = false; btn.innerHTML = 'Đẩy Lệnh Vào Hàng Đợi';
        return;
    }

    const formData = new FormData();
    formData.append('product_id', targetProduct.id); // Trọng tâm: Gửi ID thay vì Code
    formData.append('concept_id', document.getElementById('conceptId').value);
    formData.append('file', document.getElementById('imageFile').files[0]);

    try {
        const response = await fetch('/jobs/image', { method: 'POST', body: formData });
        if (!response.ok) throw new Error("Lỗi khi đẩy lệnh");
        
        e.target.reset(); 
        fetchJobs();
    } catch (error) {
        alert("Có lỗi xảy ra: " + error.message);
    } finally {
        btn.disabled = false; btn.innerHTML = 'Đẩy Lệnh Vào Hàng Đợi';
    }
});

// ==========================================
// 2. Render Bảng Job
// ==========================================
async function fetchJobs() {
    try {
        const res = await fetch('/jobs'); 
        const jobs = await res.json();
        
        const imageTbody = document.getElementById('imageTableBody');
        const videoTbody = document.getElementById('videoTableBody');
        if (imageTbody) imageTbody.innerHTML = ''; 
        if (videoTbody) videoTbody.innerHTML = '';

        jobs.forEach(job => {
            const timeStr = new Date(job.updated_at).toLocaleTimeString('en-GB');
            let actionBtn = '-';
            
            // Lấy map trạng thái động từ Backend (Không hardcode)
            const statusInfo = GLOBAL_DB.jobStatuses[job.status] || { class: 'secondary', text: 'UNKNOWN' };
            
            // Check status === 2 (Completed) theo chuẩn DB mới
            if (job.status === 2) {
                if (job.job_type === 'image') {
                    actionBtn = `<button class="btn btn-sm btn-outline-info tech-font px-3 shadow-sm" onclick="openQA('${job.product_code}', ${job.id})"><i class="bi bi-shield-check me-1"></i> QA Review</button>`;
                } else if (job.job_type === 'video') {
                    actionBtn = `<button class="btn btn-sm btn-outline-success tech-font px-3 shadow-sm" onclick="openVideo('${job.product_code}', ${job.id})"><i class="bi bi-play-circle-fill me-1"></i> Xem Video</button>`;
                }
            }

            const trHtml = `
                <tr>
                    <td class="ps-4 tech-font text-muted">#${job.id}</td>
                    <td class="fw-bold text-light">${job.product_code}</td>
                    <td>
                        <span class="status-badge status-${statusInfo.class}">
                            <span class="status-dot"></span>${statusInfo.text}
                        </span>
                    </td>
                    <td class="tech-font text-muted">${timeStr}</td>
                    <td class="text-end pe-4">${actionBtn}</td>
                </tr>`;
            
            if (job.job_type === 'image' && imageTbody) imageTbody.innerHTML += trHtml;
            if (job.job_type === 'video' && videoTbody) videoTbody.innerHTML += trHtml;
        });
    } catch (err) { console.error("Lỗi fetch Jobs:", err); }
}

// ==========================================
// 3. Logic Modal QA
// ==========================================
function openQA(productCode, jobId) {
    activeImageJobId = jobId;
    document.getElementById('qaModalTitle').innerHTML = `QA Review - <span class="text-primary">${productCode}</span>`;
    const grid = document.getElementById('qaImageGrid'); grid.innerHTML = '';
    
    [1, 2, 3, 4].forEach(i => {
        grid.innerHTML += `<div class="col-3"><div class="qa-image-card" id="img-card-${i}" onclick="toggleImage(${i})"><button class="btn-toggle-img shadow"><i class="bi bi-trash-fill"></i></button><img src="/media/output_images/${productCode}_${jobId}_0${i}.jpg" onerror="this.src='https://via.placeholder.com/400x700?text=Rendering...'"></div></div>`;
    });
    updateQaStatus(); 
    if (qaModal) qaModal.show();
}

function toggleImage(index) {
    const card = document.getElementById(`img-card-${index}`);
    const icon = card.querySelector('.btn-toggle-img i');
    if (card.classList.contains('rejected')) {
        card.classList.remove('rejected'); icon.className = 'bi bi-trash-fill';
    } else {
        card.classList.add('rejected'); icon.className = 'bi bi-arrow-counterclockwise';
    }
    updateQaStatus();
}

function updateQaStatus() {
    const active = 4 - document.querySelectorAll('.qa-image-card.rejected').length;
    document.getElementById('qaStatusCount').innerHTML = `Active nodes: <span class="text-light fw-bold">${active}/4</span>`;
    document.getElementById('btnTriggerVideo').disabled = (active === 0);
}

document.getElementById('btnTriggerVideo')?.addEventListener('click', async () => {
    const validIndexes = [];
    document.querySelectorAll('.qa-image-card:not(.rejected)').forEach(card => {
        validIndexes.push(parseInt(card.id.replace('img-card-', '')));
    });

    if(!confirm(`Xác nhận đánh dấu ${validIndexes.length} ảnh đạt chuẩn?`)) return;

    await fetch(`/jobs/video/${activeImageJobId}`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ approved_indexes: validIndexes }) 
    });
    
    if (qaModal) qaModal.hide(); 
    fetchJobs();
    
    const videoTabEl = document.getElementById('video-tab');
    if (videoTabEl) new bootstrap.Tab(videoTabEl).show();
});

// ==========================================
// 4. Logic Modal Xem Video
// ==========================================
function openVideo(productCode, jobId) {
    document.getElementById('videoModalTitle').innerHTML = `Review Video - <span class="text-success">${productCode}</span>`;
    document.getElementById('videoModalBody').innerHTML = `<video width="100%" controls autoplay loop class="rounded shadow-lg" style="max-height: 65vh; max-width: 380px; border: 1px solid rgba(255,255,255,0.1);"><source src="/media/output_videos/${productCode}/${productCode}_vid${jobId}_01.mp4" type="video/mp4"></video>`;
    if (videoModal) videoModal.show();
}

document.getElementById('videoModal')?.addEventListener('hidden.bs.modal', () => {
    document.getElementById('videoModalBody').innerHTML = '';
});