// ==========================================
// BIẾN TOÀN CỤC & KHỞI TẠO
// ==========================================
let activeConceptIdAdmin = null;
let conceptModal;
let saveWarningToast;
let saveSuccessToast;
let promptTagMap = {};
let lastFocusedEditor = null;
window.lastActivePromptEditorId = 'conceptBasePromptImage'; 

document.addEventListener("DOMContentLoaded", () => {
    // Khởi tạo các Component của Bootstrap liên quan đến Concept & Prompt
    if (document.getElementById('addConceptModal')) conceptModal = new bootstrap.Modal(document.getElementById('addConceptModal'));
    if (document.getElementById('saveSuccessToast')) saveSuccessToast = new bootstrap.Toast(document.getElementById('saveSuccessToast'), { delay: 2500 });
    if (document.getElementById('saveWarningToast')) saveWarningToast = new bootstrap.Toast(document.getElementById('saveWarningToast'), { delay: 2500 });

    // Khởi tạo dữ liệu biến Prompt từ Database
    loadPromptVariables();

    // Theo dõi ô text đang focus
    const editors = document.querySelectorAll('.prompt-editor');
    editors.forEach(editor => {
        editor.addEventListener('focus', function() {
            lastFocusedEditor = this;
        });
    });
});

// ==========================================
// NGHIỆP VỤ CONCEPT & BASE PROMPT
// ==========================================
function renderAdminConcepts() {
    const list = document.getElementById('conceptSidebarList');
    if(!list) return;
    
    // Tối ưu render DOM: Dùng map().join('') thay vì += để tránh lag khi có nhiều Concept
    list.innerHTML = GLOBAL_DB.concepts.map(c => {
        const isActive = c.id === activeConceptIdAdmin ? 'active' : '';
        const previewText = c.basePromptImage ? c.basePromptImage.substring(0, 35) + '...' : 'Chưa có prompt...';

        return `
            <div class="card concept-card p-3 ${isActive}" onclick="selectAdminConcept(${c.id})">
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <span class="fw-bold text-light">${c.name}</span>
                    <span class="badge bg-secondary tech-font">ID: ${c.id}</span>
                </div>
                <small class="text-muted tech-font text-truncate d-block" style="max-width: 100%;">
                    <i class="bi bi-card-text"></i> ${previewText}
                </small>
            </div>`;
    }).join('');
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
}

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

        if (!response.ok) throw new Error("Lỗi Server khi lưu Base Prompt");

        const badge = document.getElementById('conceptSavedBadge');
        if(badge) {
            badge.classList.remove('d-none');
            setTimeout(() => badge.classList.add('d-none'), 3000);
        }
        if (typeof initMasterData === 'function') await initMasterData(); 
    } catch (error) {
        console.error(error);
        alert("Lỗi khi lưu: Không thể kết nối tới server.");
    }
}

function addNewConcept() { if(conceptModal) conceptModal.show(); }

async function submitNewConcept() {
    const nameInput = document.getElementById('newConceptName');
    const name = nameInput.value.trim();
    if(!name) return alert("Vui lòng nhập tên Concept!");
    
    try {
        const response = await fetch('/api/concepts', { 
            method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({name: name})
        });
        if (!response.ok) throw new Error("Lỗi Backend khi thêm Concept");
        
        if (conceptModal) conceptModal.hide();
        nameInput.value = '';
        
        if (typeof initMasterData === 'function') await initMasterData();
        renderAdminConcepts();
        if (GLOBAL_DB.concepts.length > 0) selectAdminConcept(GLOBAL_DB.concepts[GLOBAL_DB.concepts.length - 1].id);
    } catch (error) { 
        console.error(error);
        alert("Lỗi kết nối mạng!"); 
    }
}

// ==========================================
// CÁC HÀM XỬ LÝ BIẾN PROMPT ĐỘNG
// ==========================================
document.addEventListener('focusin', function(e) {
    if (e.target && e.target.classList.contains('prompt-editor')) {
        window.lastActivePromptEditorId = e.target.id;
    }
});

document.addEventListener('click', function(e) {
    const button = e.target.closest('[data-tag]');
    if (!button) return; 

    e.preventDefault();

    const targetTagType = button.getAttribute('data-tag');
    const finalInsertText = promptTagMap[targetTagType]; 
    
    if (!finalInsertText) return console.warn(`⚠️ Không tìm thấy mapping cho tag: ${targetTagType}`);

    const targetId = window.lastActivePromptEditorId || 'conceptBasePromptImage';
    const txtArea = document.getElementById(targetId);

    // Kiểm tra an toàn: Nếu không tìm thấy ô nhập liệu
    if (!txtArea) {
        console.warn("⚠️ Không tìm thấy ô textarea live với ID:", targetId);
        alert("Vui lòng nhấp chuột vào một ô nhập liệu trước khi chèn biến.");
        return; 
    }

    const startPos = txtArea.selectionStart || 0;
    const endPos = txtArea.selectionEnd || 0;
    
    const textBefore = txtArea.value.substring(0, startPos);
    const textAfter = txtArea.value.substring(endPos, txtArea.value.length);

    txtArea.value = textBefore + finalInsertText + textAfter;

    const nextCursorIndex = startPos + finalInsertText.length;
    txtArea.focus();
    txtArea.setSelectionRange(nextCursorIndex, nextCursorIndex);
    txtArea.dispatchEvent(new Event('input', { bubbles: true }));
});

async function loadPromptVariables() {
    const toolbar = document.getElementById('promptVariableToolbar');
    if (!toolbar) return; 
    
    toolbar.innerHTML = '<span class="text-muted small">Đang tải công cụ...</span>';

    try {
        const response = await fetch('/api/prompt-variables');
        if (!response.ok) throw new Error("Lỗi khi fetch prompt-variables");
        const data = await response.json();
        
        toolbar.innerHTML = ''; 
        
        data.forEach(item => {
            promptTagMap[item.tag_code] = item.insert_text;

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `btn btn-sm btn-outline-warning tech-font mb-1 me-1`;
            btn.dataset.tag = item.tag_code;
            btn.innerText = `+ ${item.label}`;
            
            toolbar.appendChild(btn);
        });
    } catch (error) {
        console.error("Lỗi load Prompt Variables:", error);
        toolbar.innerHTML = '<span class="text-danger small">Lỗi tải dữ liệu biến.</span>';
    }
}