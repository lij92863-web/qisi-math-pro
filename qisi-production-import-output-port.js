(function initProductionImportOutputPort(root) {
    'use strict';

    const BAD_CHAR_RE = /[�□▯▢■●◆◇�]/g;

    function text(value, ports) {
        try {
            return ports.cleanText(value || '');
        } catch {
            return String(value || '').trim();
        }
    }

    function normalizeQuestionNo(item, ports) {
        const raw =
            item.questionNumber ?? item.question ?? item.no ?? item.index ??
            item.order ?? item.sourceTrace?.questionNo ?? '';
        try {
            return ports.normalizeQuestionKey(raw);
        } catch {
            const match = String(raw || '').match(/\d{1,3}/);
            return match ? String(Number(match[0])) : '';
        }
    }

    function originFileKey(item = {}) {
        return String(
            item.sourceDocxFileId || item.sourceQuestionFileId ||
            item.sourceFileId || item.sourceTrace?.sourceDocxFileId ||
            item.sourceTrace?.sourceQuestionFileId ||
            item.sourceTrace?.sourceFileId || item.sourceFileName ||
            item.sourceTrace?.sourceFileName || 'unknown-file'
        );
    }

    function badCharCount(value = '') {
        const matches = String(value || '').match(BAD_CHAR_RE);
        return matches ? matches.length : 0;
    }

    function latexSignalCount(value = '') {
        const matches = String(value || '').match(
            /\\frac|\\sqrt|\\sin|\\cos|\\tan|\\angle|\\triangle|\\vec|\\overrightarrow|\\overline|\\left|\\right|\\subset|\\subseteq|\\cap|\\cup|\\in|\\pi|\\theta|\\cdot|\$|[_^{}]/g
        );
        return matches ? matches.length : 0;
    }

    function chineseCount(value = '') {
        const matches = String(value || '').match(/[\u4e00-\u9fa5]/g);
        return matches ? matches.length : 0;
    }

    function mediaTokenCount(value = '') {
        const matches = String(value || '').match(
            /\[\[(?:IMAGE|FORMULA_IMAGE):[^\]]+\]\]|\\includegraphics(?:\[[^\]]*\])?\{[^}]+\}/g
        );
        return matches ? matches.length : 0;
    }

    function cleanOptions(options, ports) {
        try {
            return ports.cleanOptions(options || []);
        } catch {
            const list = Array.isArray(options) ? options : ['', '', '', ''];
            return [0, 1, 2, 3].map(index => String(list[index] || '').trim());
        }
    }

    function meaningfulOption(value, ports) {
        const raw = String(value || '').trim();
        if (!raw) return false;
        if (mediaTokenCount(raw) > 0) return true;
        const normalized = text(raw, ports)
            .replace(/^[\s　]*[（(]?\s*[A-DＡ-Ｄ]\s*[\.．、:：\)）]?\s*/i, '')
            .replace(/[.\s、，。:：；;()（）]/g, '')
            .trim();
        return Boolean(normalized) && !/^[A-D]$/i.test(normalized);
    }

    function countMeaningfulOptions(options = [], ports = {}) {
        return cleanOptions(options, ports).filter(value =>
            meaningfulOption(value, ports)
        ).length;
    }

    function allText(item = {}) {
        const options = Array.isArray(item.options) ? item.options : [];
        return [
            item.stem, options.join('\n'), item.answer, item.solution,
            item.rawText, item.rawBlock, item.sourceTrace?.rawBlock,
            item.sourceTrace?.pageText
        ].map(value => String(value || '')).join('\n');
    }

    function sourceBonus(item = {}) {
        const source = String(
            item.sourceTrace?.source || item.recognitionSource || item.source || ''
        ).toLowerCase();
        let score = 0;
        if (/visual|vision|qwen|strict|page-qwen|image/.test(source)) score += 50;
        if (/docx-importer/.test(source)) score += 40;
        if (/pdf-text|text-layer|fallback|local/.test(source)) score -= 10;
        return score;
    }

    function qualityScore(item, ports) {
        const stem = text(item.stem || '', ports);
        const options = Array.isArray(item.options) ? item.options : ['', '', '', ''];
        const optionText = options.join('\n');
        const combined = allText(item);
        const optionCount = countMeaningfulOptions(options, ports);
        const badChars = badCharCount(combined);
        const latexSignals = latexSignalCount(combined);
        const chinese = chineseCount(stem);
        const mediaTokens = mediaTokenCount(combined);
        let score = 0;
        score += optionCount * 60;
        if (optionCount >= 4) score += 180;
        if (optionCount >= 2) score += 60;
        score += Math.min(120, chinese * 2);
        score += Math.min(240, latexSignals * 20);
        score += Math.min(80, mediaTokens * 30);
        if (Array.isArray(item.images) && item.images.length) score += 50;
        if (item.sourcePageImage || item.sourceTrace?.sourcePageImage) score += 25;
        score -= badChars * 80;
        if (/未能自动切出题目|识别失败|图片题识别草稿|请查看右侧图片并补全|请对照右侧原图手动补全/.test(stem)) {
            score -= 600;
        }
        if (stem.length < 8) score -= 180;
        if (
            optionCount === 0 &&
            /单选|多选|下列|正确的是|错误的是|命题|侧棱长|形状为/.test(stem)
        ) score -= 220;
        if (optionCount === 0 && /(^|\n)\s*A\s*[\.．、:：\)）]\s*($|\n)/.test(optionText)) {
            score -= 200;
        }
        return score + sourceBonus(item);
    }

    function mergeImages(lists, ports) {
        if (typeof ports.mergeImages === 'function') return ports.mergeImages(...lists);
        const byId = new Map();
        for (const list of lists) {
            for (const image of (Array.isArray(list) ? list : [])) {
                if (!image) continue;
                const id = String(image.id || image.filename || image.name || '').trim();
                if (id && !byId.has(id)) byId.set(id, image);
            }
        }
        return [...byId.values()];
    }

    function betterText(current, candidate, ports) {
        const left = text(current, ports);
        const right = text(candidate, ports);
        if (!left && right) return candidate;
        if (left && !right) return current;
        const leftBad = badCharCount(left);
        const rightBad = badCharCount(right);
        const leftMath = latexSignalCount(left);
        const rightMath = latexSignalCount(right);
        if (leftBad > 0 && rightBad === 0 && right.length >= 6) return candidate;
        if (rightBad > 0 && leftBad === 0) return current;
        if (rightMath > leftMath && rightBad <= leftBad) return candidate;
        if (right.length > left.length * 1.25 && rightBad <= leftBad) return candidate;
        return current;
    }

    function mergeCandidate(best, other, ports) {
        const merged = { ...best };
        const bestOptions = Array.isArray(best.options) ? best.options : ['', '', '', ''];
        const otherOptions = Array.isArray(other.options) ? other.options : ['', '', '', ''];
        const bestCount = countMeaningfulOptions(bestOptions, ports);
        const otherCount = countMeaningfulOptions(otherOptions, ports);
        if (
            otherCount > bestCount ||
            (
                otherCount === bestCount &&
                badCharCount(otherOptions.join('\n')) < badCharCount(bestOptions.join('\n')) &&
                latexSignalCount(otherOptions.join('\n')) >= latexSignalCount(bestOptions.join('\n'))
            )
        ) merged.options = otherOptions;
        merged.stem = betterText(best.stem, other.stem, ports);
        merged.answer = betterText(best.answer, other.answer, ports);
        merged.solution = betterText(best.solution, other.solution, ports);
        merged.images = mergeImages([best.images || [], other.images || []], ports);
        merged.recognizedImages = mergeImages([
            best.recognizedImages || [], other.recognizedImages || []
        ], ports);
        if (!merged.sourcePageImage && other.sourcePageImage) merged.sourcePageImage = other.sourcePageImage;
        if (!merged.answerPageImage && other.answerPageImage) merged.answerPageImage = other.answerPageImage;
        if (!merged.solutionPageImage && other.solutionPageImage) merged.solutionPageImage = other.solutionPageImage;
        const bestTrace = best.sourceTrace || {};
        const otherTrace = other.sourceTrace || {};
        merged.sourceTrace = {
            ...bestTrace,
            sourcePageImage: bestTrace.sourcePageImage || otherTrace.sourcePageImage || other.sourcePageImage || '',
            rawBlock: bestTrace.rawBlock || otherTrace.rawBlock || other.rawBlock || other.rawText || '',
            pageText: bestTrace.pageText || otherTrace.pageText || other.pageText || other.sourceText || '',
            duplicateMergedFrom: [
                ...(Array.isArray(bestTrace.duplicateMergedFrom) ? bestTrace.duplicateMergedFrom : []),
                {
                    id: other.id || '',
                    questionNumber: other.questionNumber || other.question || other.order || '',
                    source: otherTrace.source || other.recognitionSource || other.source || '',
                    score: qualityScore(other, ports),
                    badChars: badCharCount(allText(other)),
                    optionCount: countMeaningfulOptions(other.options, ports),
                    stemHead: text(other.stem || '', ports).slice(0, 100)
                }
            ]
        };
        merged.warnings = [...new Set([
            ...(best.warnings || []), ...(other.warnings || []),
            '检测到重复题号，系统已合并候选并保留质量更高版本。'
        ])];
        return merged;
    }

    function diagnosticRow(draft, indexKey, index, ports) {
        return {
            [indexKey]: index,
            id: draft.id,
            q: draft.questionNumber || draft.question || draft.order,
            sourceKey: originFileKey(draft),
            source: draft.sourceTrace?.source || draft.recognitionSource || draft.source || '',
            score: qualityScore(draft, ports),
            optionCount: countMeaningfulOptions(draft.options, ports),
            badChars: badCharCount(allText(draft)),
            latexSignals: latexSignalCount(allText(draft)),
            stemHead: text(draft.stem || '', ports).slice(0, 80)
        };
    }

    function rebindDraftImages(draftImages, drafts, idMap) {
        const keptIds = new Set(drafts.map(draft => draft.id).filter(Boolean));
        const rows = [];
        for (const image of draftImages || []) {
            if (!image) continue;
            const next = { ...image };
            if (next.questionId && idMap.has(next.questionId)) {
                next.questionId = idMap.get(next.questionId);
            }
            if (next.questionId && !keptIds.has(next.questionId)) continue;
            rows.push(next);
        }
        return rows;
    }

    function projectImportOutput(input = {}, ports = {}) {
        const drafts = Array.isArray(input.drafts) ? input.drafts : [];
        const groups = new Map();
        const noQuestion = [];
        for (const draft of drafts) {
            if (!draft) continue;
            const questionNo = normalizeQuestionNo(draft, ports);
            const sourceKey = originFileKey(draft);
            if (!questionNo) {
                noQuestion.push(draft);
                continue;
            }
            const key = `${sourceKey}::${questionNo}`;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(draft);
        }

        const kept = [];
        const removedIds = new Set();
        const idMap = new Map();
        for (const group of groups.values()) {
            if (group.length === 1) {
                kept.push(group[0]);
                continue;
            }
            const ranked = [...group].sort((left, right) =>
                qualityScore(right, ports) - qualityScore(left, ports)
            );
            let best = ranked[0];
            for (const other of ranked.slice(1)) {
                const bestId = best.id;
                best = mergeCandidate(best, other, ports);
                if (other.id) {
                    removedIds.add(other.id);
                    if (bestId) idMap.set(other.id, bestId);
                }
            }
            best.warnings = [...new Set([
                ...(best.warnings || []),
                `同一题号识别出 ${group.length} 条候选，已自动保留 1 条。`
            ])];
            kept.push(best);
        }
        kept.push(...noQuestion);
        kept.sort((left, right) => {
            const leftNo = Number(normalizeQuestionNo(left, ports)) || Number.MAX_SAFE_INTEGER;
            const rightNo = Number(normalizeQuestionNo(right, ports)) || Number.MAX_SAFE_INTEGER;
            if (leftNo !== rightNo) return leftNo - rightNo;
            return originFileKey(left).localeCompare(originFileKey(right));
        });
        const clock = typeof ports.clock === 'function' ? ports.clock : Date.now;
        kept.forEach((draft, index) => {
            const questionNo = normalizeQuestionNo(draft, ports);
            draft.order = index + 1;
            draft.questionNumber = questionNo || String(index + 1);
            draft.updatedAt = clock();
        });
        const draftImages = rebindDraftImages(input.draftImages || [], kept, idMap);
        return {
            drafts: kept,
            draftImages,
            removedIds,
            idMap,
            diagnostics: {
                stage: input.stage || 'unknown',
                before: drafts.map((draft, index) =>
                    diagnosticRow(draft, 'idx', index, ports)
                ),
                after: kept.map((draft, index) =>
                    diagnosticRow(draft, 'keptIdx', index, ports)
                )
            }
        };
    }

    const api = Object.freeze({ projectImportOutput, countMeaningfulOptions });
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (root) {
        root.Qisi = root.Qisi || {};
        root.Qisi.ProductionImportOutputPort = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this);
