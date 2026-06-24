const fs = require('fs');
const path = require('path');

// =========================================================================
// CÁC HÀM TIỆN ÍCH (Giữ nguyên, chạy đồng bộ)
// =========================================================================

function getWeightedRandom(items) {
    if (!items || items.length === 0) return '';
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    const randomNum = Math.random() * totalWeight;
    let weightSum = 0;
    for (let i = 0; i < items.length; i++) {
        weightSum += items[i].weight;
        if (randomNum <= weightSum) {
            return items[i].text;
        }
    }
    return items[0].text;
}

function getRandomFromArray(arr) {
    if (!arr || arr.length === 0) return null;
    return arr[Math.floor(Math.random() * arr.length)];
}

function parseSlots(slotString) {
    try {
        if (slotString === "all") return ["all"];
        return JSON.parse(slotString);
    } catch (e) {
        return [1, 2, 3, 4]; // Fallback an toàn
    }
}

// =========================================================================
// THUẬT TOÁN 3 BƯỚC: LỌC RÁC -> ĐẶT GẠCH -> LẤP ĐẦY
// =========================================================================

function selectVideoSegments(segmentsPool, featureIds = []) {
    if (!segmentsPool || segmentsPool.length === 0) return {};

    const finalSelection = {};
    const filledSlots = new Set();

    const mandatorySegments = [];
    let normalSegments = [];

    // Clone data và parse slot
    const pool = segmentsPool.map(seg => ({ 
        ...seg,
        allowed: parseSlots(seg.allowed_slots)
    }));

    // BƯỚC 1: Lọc phân cảnh dựa trên Feature ID (Từ DB)
    pool.forEach(seg => {
        if (seg.required_feature_id) {
            // Nếu phân cảnh có yêu cầu tính năng, kiểm tra xem product có tính năng đó không
            if (featureIds.includes(seg.required_feature_id)) {
                mandatorySegments.push(seg);
            }
            // Nếu không có tính năng -> loại bỏ hoàn toàn (không đưa vào normalSegments)
        } else {
            // Phân cảnh không yêu cầu tính năng đặc thù -> cảnh thường
            normalSegments.push(seg);
        }
    });

    // BƯỚC 2: Đặt gạch cảnh bắt buộc (Pre-allocate)
    for (const mScene of mandatorySegments) {
        const validSlots = [1, 2, 3, 4].filter(slot => 
            !filledSlots.has(slot) && 
            (mScene.allowed.includes(slot) || mScene.allowed.includes("all"))
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

    // BƯỚC 3: Lấp đầy các slot còn trống bằng cảnh thông thường
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
        } else {
            // Rớt đài: bốc đại 1 cảnh nếu không khớp slot
            if (normalSegments.length > 0) {
                const fallbackScene = getRandomFromArray(normalSegments);
                finalSelection[`segment_${slot}_name`] = fallbackScene.name;
                finalSelection[`segment_${slot}_text`] = fallbackScene.text;
                normalSegments = normalSegments.filter(scene => scene.id !== fallbackScene.id);
                filledSlots.add(slot);
            }
        }
    }

    return finalSelection;
}

// =========================================================================
// HÀM GENERATE CHÍNH TỪ DATABASE (POSTGRESQL)
// =========================================================================

/**
 * Hàm sinh dữ liệu Prompt, yêu cầu truyền vào kết nối DB
 * @param {Object} db - Connection Pool của pg
 * @param {number} conceptId - ID của Concept cần render
 * @param {Array<number>} productFeatureIds - Mảng các feature_id của sản phẩm
 */
async function generateFromDB(db, conceptId, productFeatureIds = []) {
    if (!conceptId) {
        throw new Error(`❌ Lỗi: Hàm generate() yêu cầu truyền vào ID của Concept.`);
    }

    // 1. Lấy thông tin Concept (Dùng db.query và $1 thay vì dấu ?)
    const conceptResult = await db.query('SELECT * FROM concepts WHERE id = $1 AND is_active = true', [conceptId]);
    if (!conceptResult.rows || conceptResult.rows.length === 0) {
        throw new Error(`❌ Không tìm thấy concept ID: ${conceptId} hoặc concept đang bị tắt.`);
    }
    const activeConcept = conceptResult.rows[0];

    // 2. Lấy Backgrounds phù hợp
    const bgResult = await db.query('SELECT * FROM backgrounds WHERE is_active = true');
    const backgrounds = bgResult.rows;
    
    const validBackgrounds = backgrounds.filter(bg => {
        if (bg.allowed_concepts === 'all') return true;
        const allowedArr = bg.allowed_concepts.split(',').map(s => s.trim());
        return allowedArr.includes(String(conceptId));
    });

    let targetBgObj = null;
    if (validBackgrounds.length > 0) {
        targetBgObj = getRandomFromArray(validBackgrounds);
    }
    const selectedBgName = targetBgObj ? targetBgObj.name : 'Mặc định';
    const selectedBgText = targetBgObj ? targetBgObj.text : '';

    // 3. Lấy Poses của Concept này
    const posesResult = await db.query('SELECT * FROM concept_poses WHERE concept_id = $1', [conceptId]);
    const posesData = posesResult.rows;
    
    // Phân loại poses theo body_part
    const poses = { upperBody: [], leg: [], hand: [] };
    posesData.forEach(p => {
        if (p.body_part === 'upperBody') poses.upperBody.push(p);
        else if (p.body_part === 'leg') poses.leg.push(p);
        else if (p.body_part === 'hand') poses.hand.push(p);
    });

    const selectedUpperBody = getWeightedRandom(poses.upperBody);
    const selectedLeg = getWeightedRandom(poses.leg);
    const selectedHand = getWeightedRandom(poses.hand);

    // 4. Lấy Video Segments của Concept này
    const segmentsResult = await db.query('SELECT * FROM video_segments WHERE concept_id = $1', [conceptId]);
    const videoSegments = segmentsResult.rows;
    
    // Chạy thuật toán 3 bước lấp đầy slot
    const videoData = selectVideoSegments(videoSegments, productFeatureIds);

    return {
        conceptName: activeConcept.name,
        imageTemplateText: activeConcept.base_prompt_image, 
        videoTemplateText: activeConcept.base_prompt_video,
        selectedBgName,
        selectedBgText,
        selectedUpperBody,
        selectedLeg,
        selectedHand,
        ...videoData 
    };
}

// =========================================================================
// HÀM RÁP TEXT
// =========================================================================

function buildPromptText(templateText, promptData, type = 'image') {
    if (!templateText) return '';
    let text = templateText;

    if (type === 'image') {
        text = text.replace('{{SELECTED_BACKGROUND}}', promptData.selectedBgText || '');
        text = text.replace('{{SELECTED_UPPER_BODY}}', promptData.selectedUpperBody || '');
        text = text.replace('{{SELECTED_LEG}}', promptData.selectedLeg || '');
        text = text.replace('{{SELECTED_HAND}}', promptData.selectedHand || '');
    } 
    else if (type === 'video') {
        text = text.replace(/\{\{SEGMENT_1\}\}/g, promptData.segment_1_text || '');
        text = text.replace(/\{\{SEGMENT_2\}\}/g, promptData.segment_2_text || '');
        text = text.replace(/\{\{SEGMENT_3\}\}/g, promptData.segment_3_text || '');
        text = text.replace(/\{\{SEGMENT_4\}\}/g, promptData.segment_4_text || '');
    }

    return text;
}

// =========================================================================
// XUẤT MODULE
// =========================================================================

module.exports = {
    generateFromDB,
    buildPromptText,
};