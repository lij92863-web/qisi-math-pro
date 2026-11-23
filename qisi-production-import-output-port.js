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

    // 凭证等级决定字段归属：判不出高下就保留主候选，不按文本质量猜。
    const PROVENANCE_RANK = Object.freeze({
        'controlled-write': 3,
        manual: 3,
        missing: 2,
        rejected: 1
    });

    function clone(value) {
        if (Array.isArray(value)) return value.map(clone);
        if (value && typeof value === 'object') {
            return Object.fromEntries(
                Object.entries(value).map(([key, item]) => [key, clone(item)])
            );
        }
        return value;
    }

    function provenanceStatus(provenance) {
        return String(provenance?.status || provenance?.kind || '').trim();
    }

    function provenanceRank(provenance) {
        return PROVENANCE_RANK[provenanceStatus(provenance)] || 0;
    }

    // 返回 'left' / 'right'；同级或任一方没有显式等级时返回 null（不可判定）。
    function strongerProvenance(left, right) {
        const leftRank = provenanceRank(left);
        const rightRank = provenanceRank(right);
        if (!leftRank || !rightRank || leftRank === rightRank) return null;
        return leftRank > rightRank ? 'left' : 'right';
    }

    function optionKeyForMerge(options, ports) {
        return cleanOptions(options, ports)
            .map(value => meaningfulOption(value, ports) ? value : '').join('\n').trim();
    }

    // The group-level compatibility check has already retained every unresolved
    // conflict. Here only provenance selection and filling empty fields remain.
    function chooseText(best, other, field, ports) {
        const stronger = strongerProvenance(best.fieldProvenance?.[field], other.fieldProvenance?.[field]);
        if (stronger) return stronger === 'left' ? 'best' : 'other';
        return !text(best[field], ports) && text(other[field], ports) ? 'other' : 'best';
    }

    function chooseOptions(best, other, ports) {
        const stronger = strongerProvenance(best.fieldProvenance?.options, other.fieldProvenance?.options);
        if (stronger) return stronger === 'left' ? 'best' : 'other';
        return !optionKeyForMerge(best.options, ports) && optionKeyForMerge(other.options, ports) ? 'other' : 'best';
    }

    function mergeCandidate(best, other, ports) {
        const merged = { ...best };
        const questionNo = normalizeQuestionNo(best, ports) ||
            normalizeQuestionNo(other, ports);
        const warnings = [];
        const bestProvenance = best.fieldProvenance || {};
        const fieldProvenance = clone(bestProvenance);
        let provenanceAdopted = false;
        const adopt = field => {
            merged[field] = other[field];
            const evidence = other.fieldProvenance?.[field];
            fieldProvenance[field] = evidence && typeof evidence === 'object'
                ? clone(evidence)
                : { ...clone(bestProvenance[field] || {}), status: 'rejected' };
            provenanceAdopted = true;
        };
        for (const field of ['stem', 'answer', 'solution']) {
            if (chooseText(best, other, field, ports) === 'other') adopt(field);
        }
        if (chooseOptions(best, other, ports) === 'other') {
            adopt('options');
            if (best.pdfExternal || other.pdfExternal) {
                merged.pdfExternal = clone(other.pdfExternal || best.pdfExternal);
                if (
                    Array.isArray(best.pdfExternal?.optionLabels) &&
                    Array.isArray(other.pdfExternal?.optionLabels)
                ) {
                    merged.pdfExternal.optionLabels = clone(
                        other.pdfExternal.optionLabels
                    );
                } else {
                    merged.pdfExternal.optionLabels = [];
                    warnings.push(
                        `题号 ${questionNo || '(未识别)'} 的 options 已改用另一候选，但两侧缺少可对齐的 optionLabels，选项标签已留空。`
                    );
                }
            }
        }
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
                    stemHead: text(other.stem || '', ports).slice(0, 100),
                    answer: String(other.answer || ''),
                    solution: String(other.solution || ''),
                    fieldProvenance: clone(other.fieldProvenance || {})
                }
            ]
        };
        merged.warnings = [...new Set([
            ...(best.warnings || []), ...(other.warnings || []),
            ...warnings,
            '检测到重复题号，兼容字段已合并并保留来源记录。'
        ])];
        if (provenanceAdopted) merged.fieldProvenance = fieldProvenance;
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
        const v1 = drafts.filter(draft => ['pdf-multimodal-v1','pdf-external-v2','pdf-mineru-v1'].includes(draft?.producer?.routeId));
        if (v1.length) {
            const other = drafts.filter(draft => !['pdf-multimodal-v1','pdf-external-v2','pdf-mineru-v1'].includes(draft?.producer?.routeId));
            const legacy = other.length ? projectImportOutput({ ...input, drafts: other }, ports) : { drafts: [], removedIds: new Set(), idMap: new Map(), diagnostics: { before: [], after: [] } };
            return { ...legacy, drafts: [...v1, ...legacy.drafts], draftImages: input.draftImages || [] };
        }
        if (drafts.some(draft => draft?.source?.format === 'pdf' ||
            draft?.source?.mode === 'pdf-ai' ||
            String(draft?.producer?.routeId || '').startsWith('pdf-'))) {
            const error = new Error('PRODUCTION_IMPORT_PDF_V1_REQUIRED');
            error.code = 'PRODUCTION_IMPORT_PDF_V1_REQUIRED';
            throw error;
        }
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
        // 「识别失败」这类占位文字不是真实题干，不能拿它来判断两条是不是同一题。
        // 有效短题干同样参与身份比较。
        const failureStemPattern = /^(?:识别失败|无法识别|未识别|识别不清|图片无法识别|读取失败)$/;
        const stemKey = draft => text(draft?.stem, ports).replace(/\s+/g, '');
        for (const group of groups.values()) {
            if (group.length === 1) {
                kept.push(group[0]);
                continue;
            }
            // 同一题号撞在一起时，先看题干是不是真的不同。
            // 「两个大题都从 1 开始编号」是常见排版，这种情况下题干完全不同，
            // 旧逻辑按质量分合并会直接丢掉一道题。必须全部保留，交人工核对。
            // 只有题干一致（或只剩一条有意义的题干）时才走合并 —— 那才是重复识别。
            const stems = group.map(stemKey);
            const meaningfulStems = stems.filter(stem =>
                stem.length > 0 && !failureStemPattern.test(stem));
            const stemsDiffer = meaningfulStems.length > 1 &&
                meaningfulStems.some(stem => stem !== meaningfulStems[0]);
            const fieldValue = (draft, field) => field === 'options'
                ? optionKeyForMerge(draft.options, ports)
                : text(draft[field], ports);
            const fieldsConflict = ['answer', 'solution', 'options'].some(field =>
                group.some((left, index) => group.slice(index + 1).some(right => {
                    const a = fieldValue(left, field), b = fieldValue(right, field);
                    return a && b && a !== b && !strongerProvenance(
                        left.fieldProvenance?.[field], right.fieldProvenance?.[field]);
                })));
            if (stemsDiffer || fieldsConflict) {
                for (const draft of group) {
                    const questionNo = normalizeQuestionNo(draft, ports);
                    draft.warnings = [...new Set([
                        ...(draft.warnings || []),
                        `题号 ${questionNo || '(未识别)'} 在同一来源出现 ${group.length} 条${stemsDiffer ? '题干不同' : '字段冲突'}的题目，已完整保留所有候选，请在正式入库前核对。`
                    ])];
                    kept.push(draft);
                }
                continue;
            }
            // Only compatible evidence reaches merging. Prefer an actual stem over
            // an explicit failure placeholder; ordering never adjudicates a conflict.
            const ranked = [...group].sort((left, right) => {
                const usable = row => Boolean(stemKey(row)) && !failureStemPattern.test(stemKey(row));
                return Number(usable(right)) - Number(usable(left)) || String(left.id || '').localeCompare(String(right.id || ''));
            });
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
