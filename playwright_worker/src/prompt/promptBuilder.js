const fs = require('fs');
const path = require('path');

// =========================================================================
// CÁC HÀM TIỆN ÍCH
// =========================================================================

function getWeightedRandom(items, debugLabel = '') {
    if (!items || items.length === 0) return null;

    const totalWeight = items.reduce((sum, item) => sum + (item.weight || 0), 0);
    const randomNum = Math.random() * totalWeight;

    if (debugLabel) {
        console.log(`\n🔍 [DEBUG] === VÒNG QUAY: ${debugLabel} ===`);
        console.log(`- Tổng số Items tham gia: ${items.length}`);
        console.log(`- Tổng Weight: ${totalWeight}`);
        console.log(`- Số Random (Điểm rơi): ${randomNum.toFixed(2)}`);
        console.log(`- BẢNG PHÂN BỐ TỶ LỆ:`);
        
        let previewSum = 0;
        for (let i = 0; i < items.length; i++) {
            const previous = previewSum;
            previewSum += (items[i].weight || 0);
            // Cập nhật lấy tên hiển thị rõ ràng hơn cho Log
            const itemName = items[i].name || items[i].pose_name || items[i].text || `Item_ID_${items[i].id}`;
            console.log(`   [${i + 1}] ${itemName.substring(0, 35).padEnd(35, ' ')} | Weight: ${String(items[i].weight).padEnd(3, ' ')} | Khoảng trúng: ${previous} -> ${previewSum}`);
        }
        console.log(`--------------------------------------------`);
    }

    let weightSum = 0;
    for (let i = 0; i < items.length; i++) {
        weightSum += (items[i].weight || 0);
        
        if (randomNum <= weightSum) {
            if (debugLabel) {
                const itemName = items[i].name || items[i].pose_name || `Item_ID_${items[i].id}`;
                console.log(`🎯 KẾT QUẢ: => Chọn [${itemName}]`);
                console.log(`   (Lý do: ${randomNum.toFixed(2)} nằm trong khoảng <= ${weightSum})`);
                console.log(`============================================\n`);
            }
            return items[i];
        }
    }

    if (debugLabel) console.log(`⚠️ Lọt vòng lặp, tự động chọn item đầu tiên.\n`);
    return items[0];
}

function getRandomFromArray(arr) {
    if (!arr || arr.length === 0) return null;
    return arr[Math.floor(Math.random() * arr.length)];
}

function parseSlots(slotData) {
    if (Array.isArray(slotData)) return slotData;
    if (slotData === "all") return ["all"];
    
    if (typeof slotData === 'string') {
        try { return JSON.parse(slotData); } 
        catch (e) { return [1, 2, 3, 4]; }
    }
    return [1, 2, 3, 4];
}

// =========================================================================
// THUẬT TOÁN 3 BƯỚC CHO VIDEO: LỌC RÁC -> ĐẶT GẠCH -> LẤP ĐẦY
// =========================================================================

function selectVideoSegments(segmentsPool, featureIds = []) {
    if (!segmentsPool || segmentsPool.length === 0) return {};

    const finalSelection = {};
    const filledSlots = new Set();
    const mandatorySegments = [];
    let normalSegments = [];

    const pool = segmentsPool.map(seg => ({ 
        ...seg,
        allowed: parseSlots(seg.allowed_slots)
    }));

    pool.forEach(seg => {
        if (seg.required_feature_id) {
            if (featureIds.includes(seg.required_feature_id)) mandatorySegments.push(seg);
        } else {
            normalSegments.push(seg);
        }
    });

    for (const mScene of mandatorySegments) {
        const validSlots = [1, 2, 3, 4].filter(slot => 
            !filledSlots.has(slot) && (mScene.allowed.includes(slot) || mScene.allowed.includes("all"))
        );

        if (validSlots.length > 0) {
            const chosenSlot = getRandomFromArray(validSlots);
            finalSelection[`segment_${chosenSlot}_name`] = mScene.name;
            finalSelection[`segment_${chosenSlot}_text`] = mScene.text;
            filledSlots.add(chosenSlot);
        } else {
            console.warn(`⚠️ Cảnh báo: Cảnh bắt buộc [${mScene.name}] không còn slot trống để chèn.`);
        }
    }

    for (let slot = 1; slot <= 4; slot++) {
        if (filledSlots.has(slot)) continue;

        const validCandidates = normalSegments.filter(scene => 
            scene.allowed.includes(slot) || scene.allowed.includes("all")
        );

        if (validCandidates.length > 0) {
            const chosenScene = getRandomFromArray(validCandidates);
            finalSelection[`segment_${slot}_name`] = chosenScene.name;
            finalSelection[`segment_${slot}_text`] = chosenScene.text;
            normalSegments = normalSegments.filter(scene => scene.id !== chosenScene.id);
            filledSlots.add(slot);
        } else if (normalSegments.length > 0) {
            const fallbackScene = getRandomFromArray(normalSegments);
            finalSelection[`segment_${slot}_name`] = fallbackScene.name;
            finalSelection[`segment_${slot}_text`] = fallbackScene.text;
            normalSegments = normalSegments.filter(scene => scene.id !== fallbackScene.id);
            filledSlots.add(slot);
        }
    }

    return finalSelection;
}

// =========================================================================
// HÀM GENERATE CHÍNH TỪ DATABASE (POSTGRESQL)
// =========================================================================

async function generateFromDB(db, conceptId, productFeatureIds = []) {
    if (!conceptId) throw new Error(`❌ Lỗi: Hàm generate() yêu cầu truyền vào ID của Concept.`);

    const conceptResult = await db.query('SELECT * FROM concepts WHERE id = $1 AND is_active = true', [conceptId]);
    if (!conceptResult.rows || conceptResult.rows.length === 0) {
        throw new Error(`❌ Không tìm thấy concept ID: ${conceptId} hoặc concept đang bị tắt.`);
    }
    const activeConcept = conceptResult.rows[0];

    // [CẬP NHẬT 1] Lấy thêm cột "label" để đối chiếu với "prompt_label" của pose
    const varsQuery = `SELECT tag_code, label, insert_text FROM prompt_variables WHERE is_active = true`;
    const varsResult = await db.query(varsQuery);
    const promptVariables = varsResult.rows;

    const imageVariables = {};
    promptVariables.forEach(v => {
        imageVariables[v.insert_text] = ''; 
    });

    // Background logic
    const bgQuery = `
        SELECT b.* FROM backgrounds b
        JOIN background_concept_link bcl ON b.id = bcl.background_id
        WHERE bcl.concept_id = $1 AND b.is_active = true
    `;
    const bgResult = await db.query(bgQuery, [conceptId]);
    const validBackgrounds = bgResult.rows;

    let selectedBgName = 'Không có background nào được liên kết';

    if (validBackgrounds.length > 0) {
        console.log(`✅ Tìm thấy ${validBackgrounds.length} background hợp lệ cho concept ID: ${conceptId}`);
        const targetBgObj = getWeightedRandom(validBackgrounds, 'BACKGROUND');
        
        const bgLogName = targetBgObj.name || targetBgObj.title || targetBgObj.bg_name || `ID_${targetBgObj.id}`;
        console.log(`🎯 Background được chọn: ${bgLogName}`);
        selectedBgName = bgLogName;
        
        const bgVar = promptVariables.find(v => v.tag_code === 'BACKGROUND');
        if (bgVar) {
            imageVariables[bgVar.insert_text] = targetBgObj.text || '';
        } else {
            imageVariables['{{SELECTED_BACKGROUND}}'] = targetBgObj.text || '';
        }
    }

    // Poses Logic
    const posesQuery = `
        SELECT cp.* FROM concept_poses cp
        JOIN concept_pose_link cpl ON cp.id = cpl.pose_id
        WHERE cpl.concept_id = $1 AND cp.is_active = true
    `;
    const posesResult = await db.query(posesQuery, [conceptId]);
    const posesData = posesResult.rows;
    
    // [CẬP NHẬT 2] Gom nhóm tự động theo FK `prompt_label` (Ví dụ: "Thân Trên", "Dáng Chân")
    const groupedPoses = {};
    posesData.forEach(p => {
        const labelKey = p.prompt_label || 'UNKNOWN';
        if (!groupedPoses[labelKey]) groupedPoses[labelKey] = [];
        groupedPoses[labelKey].push(p);
    });

    // [CẬP NHẬT 3] Lắp text vào biến bằng cách đối chiếu label
    for (const [labelKey, items] of Object.entries(groupedPoses)) {
        const selected = getWeightedRandom(items, `THUỘC TÍNH: ${labelKey}`);
        if (!selected) continue;

        // Tìm chuẩn xác biến cấu hình bằng Foreign Key (label = prompt_label)
        const matchedVar = promptVariables.find(v => v.label === labelKey);
        const replacementText = selected.text || '';

        if (matchedVar) {
            // Nét cứng: Thay text thẳng vào insert_text (VD: {{SELECTED_UPPER_BODY}})
            imageVariables[matchedVar.insert_text] = replacementText;
        } else {
            // Fallback phòng hờ trường hợp data rác / lỗi khóa ngoại
            const fallbackTag = `{{SELECTED_${labelKey.toUpperCase().replace(/\s+/g, '_')}}}`;
            imageVariables[fallbackTag] = replacementText;
        }
    }

    // Video Logic
    const segmentsQuery = `
        SELECT vs.* FROM video_segments vs
        JOIN concept_video_segment_link cvsl ON vs.id = cvsl.segment_id
        WHERE cvsl.concept_id = $1
    `;
    const segmentsResult = await db.query(segmentsQuery, [conceptId]);
    const videoData = selectVideoSegments(segmentsResult.rows, productFeatureIds);

    return {
        conceptName: activeConcept.name,
        imageTemplateText: activeConcept.base_prompt_image, 
        videoTemplateText: activeConcept.base_prompt_video,
        imageVariables, 
        selectedBgName,
        ...videoData 
    };
}

// =========================================================================
// HÀM RÁP NỐI TEXT HOÀN CHỈNH
// =========================================================================

function buildPromptText(templateText, promptData, type = 'image') {
    if (!templateText) return '';
    let text = templateText;

    // Ráp Text
    if (type === 'image') {
        if (promptData.imageVariables) {
            for (const [tag, value] of Object.entries(promptData.imageVariables)) {
                const escapedTag = tag.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                text = text.replace(new RegExp(escapedTag, 'g'), value || '');
            }
        }
    } 
    else if (type === 'video') {
        text = text.replace(/\{\{SEGMENT_1\}\}/g, promptData.segment_1_text || '');
        text = text.replace(/\{\{SEGMENT_2\}\}/g, promptData.segment_2_text || '');
        text = text.replace(/\{\{SEGMENT_3\}\}/g, promptData.segment_3_text || '');
        text = text.replace(/\{\{SEGMENT_4\}\}/g, promptData.segment_4_text || '');
    }

    // Dọn rác (Cho cả Image lẫn Video)
    text = text.replace(/\{{1,2}[^{}]+\}{1,2}/g, '');
    
    // Xóa khoảng trắng thừa
    text = text.replace(/\s{2,}/g, ' ').trim();

    return text;
}

module.exports = {
    generateFromDB,
    buildPromptText,
};