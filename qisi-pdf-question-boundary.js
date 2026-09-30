(function (root) {
    'use strict';
    const numberOf = item => {
        const value = String(item?.questionNumber ?? item?.question ?? item?.no ?? '').trim();
        return /^[1-9]\d{0,2}$/.test(value) ? Number(value) : 0;
    };
    const boxOf = item => {
        const box = item?.question_bbox || item?.sourceBbox;
        return Array.isArray(box) && box.length === 4 && box.every(Number.isFinite) &&
            box[0] >= 0 && box[1] >= 0 && box[2] <= 1000 && box[3] <= 1000 &&
            box[2] > box[0] && box[3] > box[1] ? box : null;
    };
    const fragmentOf = item => item?.isFragment === true || item?.recognitionRaw?.isFragment === true;
    const choiceOf = item => /^(单选题|多选题)$/.test(item?.type || '');
    const optionCount = item => Array.isArray(item?.options)
        ? item.options.filter(option => String(option ?? '').trim()).length : 0;
    const abort = signal => {
        if (!signal?.aborted) return;
        const error = new Error('PDF boundary recognition cancelled.');
        error.name = 'AbortError'; error.code = 'OCR_REQUEST_CANCELLED'; throw error;
    };

    function planQuestionBoundaries({ pages = [], pageResults = [] } = {}) {
        const rows = [], fragments = [], warnings = [];
        let previous = 0, sequenceSafe = true;
        for (let index = 0; index < pages.length; index++) {
            const pageNo = Number(pages[index]?.pageNo || index + 1);
            const items = pageResults[index] || [];
            const valid = [];
            if (!Number.isInteger(pageNo) || pageNo < 1 || (index && pageNo <= rows.at(-1).pageNo)) sequenceSafe = false;
            for (const item of items) {
                const question = numberOf(item);
                if (!question) { fragments.push({ pageNo, item }); continue; }
                if (previous && question !== previous + 1) sequenceSafe = false;
                previous = question;
                valid.push(item);
            }
            // The physical order must agree with the recognizer's reading order.
            for (let i = 1; i < valid.length; i++) {
                const left = boxOf(valid[i - 1]), right = boxOf(valid[i]);
                if (left && right && left[1] > right[1]) sequenceSafe = false;
            }
            rows.push({ pageNo, page: pages[index], valid, items });
        }
        if (!sequenceSafe) warnings.push('pdf-boundary-sequence-unsafe');
        const plans = [];
        if (sequenceSafe) for (let i = 0; i + 1 < rows.length; i++) {
            const left = rows[i], right = rows[i + 1];
            if (right.pageNo !== left.pageNo + 1) continue;
            const target = left.valid.at(-1), next = right.valid[0];
            const targetBox = boxOf(target), nextBox = boxOf(next);
            if (!target || !next || !targetBox || !nextBox || numberOf(next) !== numberOf(target) + 1) continue;
            const explicitFragment = fragmentOf(target);
            const missingOptions = choiceOf(target) && optionCount(target) < 4;
            const unownedHead = right.items.some(item => !numberOf(item));
            const lowStart = targetBox[1] >= 740 && nextBox[1] >= 250;
            if (!explicitFragment && !missingOptions && !unownedHead && !lowStart) continue;
            const leftTop = Math.max(0, targetBox[1] - 20);
            const rightBottom = Math.max(0, nextBox[1] - 10);
            if (rightBottom < 50) continue;
            plans.push({ question: numberOf(target), target, left, right,
                leftTop, rightBottom, reasons: [explicitFragment && 'fragment',
                    missingOptions && 'missing-options', unownedHead && 'unowned-head',
                    lowStart && 'page-tail'].filter(Boolean) });
        }
        return { plans, fragments, warnings,
            items: rows.flatMap(row => row.valid), sequenceSafe };
    }

    async function composeBoundaryImage(plan, { document = root.document, Image = root.Image } = {}) {
        if (!document?.createElement || typeof Image !== 'function') throw new Error('PDF_BOUNDARY_CANVAS_UNAVAILABLE');
        const load = url => new Promise((resolve, reject) => {
            const image = new Image(); image.onload = () => resolve(image);
            image.onerror = () => reject(new Error('PDF_BOUNDARY_IMAGE_FAILED')); image.src = url;
        });
        const [left, right] = await Promise.all([load(plan.left.page.url), load(plan.right.page.url)]);
        const width = Math.min(1800, Math.max(left.naturalWidth, right.naturalWidth));
        if (!width || !left.naturalHeight || !right.naturalHeight) throw new Error('PDF_BOUNDARY_IMAGE_DIMENSIONS');
        const leftHeight = Math.ceil(left.naturalHeight * (1000 - plan.leftTop) / 1000 * width / left.naturalWidth);
        const rightHeight = Math.ceil(right.naturalHeight * plan.rightBottom / 1000 * width / right.naturalWidth);
        if (leftHeight + rightHeight > 6000) throw new Error('PDF_BOUNDARY_IMAGE_TOO_LARGE');
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = leftHeight + rightHeight;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('PDF_BOUNDARY_CANVAS_UNAVAILABLE');
        context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(left, 0, left.naturalHeight * plan.leftTop / 1000, left.naturalWidth,
            left.naturalHeight * (1000 - plan.leftTop) / 1000, 0, 0, width, leftHeight);
        context.drawImage(right, 0, 0, right.naturalWidth,
            right.naturalHeight * plan.rightBottom / 1000, 0, leftHeight, width, rightHeight);
        return { url: canvas.toDataURL('image/jpeg', 0.92),
            splitY: leftHeight / canvas.height * 1000, width, height: canvas.height };
    }

    function acceptBoundaryResult(plan, composite, result) {
        if (!Array.isArray(result) || result.length !== 1 || !Number.isFinite(composite?.splitY) ||
            composite.splitY <= 0 || composite.splitY >= 1000) return null;
        const item = result[0], box = boxOf(item);
        const anchor = boxOf(plan.target);
        const anchorX = anchor ? (anchor[0] + anchor[2]) / 2 : -1;
        const anchorY = anchor ? (anchor[1] + Math.min(10, (anchor[3] - anchor[1]) / 2) -
            plan.leftTop) / (1000 - plan.leftTop) * composite.splitY : -1;
        if (numberOf(item) !== plan.question || fragmentOf(item) || !box ||
            box[1] >= composite.splitY || box[3] <= composite.splitY ||
            anchorX < box[0] || anchorX > box[2] || anchorY < box[1] || anchorY > box[3] ||
            !String(item.stem || item.questionText || '').trim() ||
            (choiceOf(plan.target) && (!choiceOf(item) || optionCount(item) !== 4))) return null;
        // A composite crop cannot be replaced by a page-local image or coordinates.
        return { ...item, questionNumber: String(plan.question), isFragment: false,
            sourcePage: plan.left.pageNo, pageIndex: plan.left.pageNo,
            sourcePages: [plan.left.pageNo, plan.right.pageNo], sourcePageImage: composite.url,
            sourceTrace: { ...(plan.target.sourceTrace || {}), boundary: {
                question: plan.question, pages: [plan.left.pageNo, plan.right.pageNo],
                leftTop: plan.leftTop, rightBottom: plan.rightBottom, splitY: composite.splitY,
                original: plan.target, continuationEvidence: plan.right.items.filter(row => !numberOf(row)),
                originalPageImages: [plan.left.page.url, plan.right.page.url],
                coordinateSpace: 'boundary-composite', reasons: plan.reasons
            } } };
    }

    async function reconstructQuestionBoundaries(input = {}, ports = {}) {
        const plan = planQuestionBoundaries(input);
        const items = [...plan.items], diagnostics = [];
        const indexByItem = new Map(items.map((item, index) => [item, index]));
        const compose = ports.composeBoundaryImage || composeBoundaryImage;
        for (const target of plan.plans) {
            abort(input.signal);
            try {
                const composite = await compose(target);
                abort(input.signal);
                const result = await ports.recognizePage({ file: input.file,
                    imageUrl: composite.url, pageNo: target.left.pageNo,
                    expectedQuestionCount: 0, signal: input.signal,
                    repairInfo: `这是一道跨页题的连续原图：上部为第${target.left.pageNo}页末尾，下部为第${target.right.pageNo}页开头。仅重建第${target.question}题，题号必须来自上部原图，勿加入下一题；必须包含两部分中的题干、小问、表格、全部选项与真实配图。question_bbox和images的坐标均按整张合成图0到1000给出，question_bbox必须跨越两部分（分界y=${Math.round(composite.splitY)}）。数学内容用LaTeX；不要输出未编号片段或猜测答案。完整时isFragment=false。` });
                abort(input.signal);
                const accepted = acceptBoundaryResult(target, composite, result);
                const index = indexByItem.get(target.target) ?? -1;
                if (accepted && index >= 0) items[index] = accepted;
                else if (index >= 0) items[index] = { ...items[index], warnings: [
                    ...(items[index].warnings || []), '跨页题重建未通过题号及区域校验，保留原始证据。'] };
                diagnostics.push({ question: target.question, pages: [target.left.pageNo, target.right.pageNo],
                    accepted: Boolean(accepted), reasons: target.reasons });
            } catch (error) {
                if (error?.name === 'AbortError' || ports.isFatalServiceError?.(error)) throw error;
                const index = indexByItem.get(target.target) ?? -1;
                if (index >= 0) items[index] = { ...items[index], warnings: [
                    ...(items[index].warnings || []), '跨页题重建失败，原始内容已保留。'] };
                diagnostics.push({ question: target.question, accepted: false,
                    code: error?.code || error?.message || 'PDF_BOUNDARY_REPAIR_FAILED' });
            }
        }
        return { items, diagnostics, fragments: plan.fragments, warnings: plan.warnings };
    }
    const api = Object.freeze({ planQuestionBoundaries, composeBoundaryImage,
        acceptBoundaryResult, reconstructQuestionBoundaries });
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    root.Qisi = root.Qisi || {}; root.Qisi.PdfQuestionBoundary = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
