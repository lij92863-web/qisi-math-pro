(function initReviewDraftNormalizationPolicy(root, factory) {
    const api = factory(root);
    root.Qisi = root.Qisi || {};
    root.Qisi.ReviewDraftNormalizationPolicy = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';

    function createReviewDraftNormalizationPolicy(ports = {}) {
        for (const name of ["choiceOptionIssue","solutionQualityIssue","attachSourceTraceToDraftQuestion","extractOptionsFromCurrentBlockOnly","normalizeQuestionType","choiceQuestionMissingOptions","countValidOptions","addWarningOnce","batchDebugLog","toBatchDebugQuestion","getDefaultType","clock"]) {
            if (typeof ports[name] !== 'function') {
                const error = new TypeError(
                    `Review draft normalization policy requires ${name}.`
                );
                error.code = 'REVIEW_DRAFT_NORMALIZATION_POLICY_PORT_REQUIRED';
                throw error;
            }
        }

        const choiceOptionIssue = ports.choiceOptionIssue;
        const solutionQualityIssue = ports.solutionQualityIssue;
        const attachSourceTraceToDraftQuestion = ports.attachSourceTraceToDraftQuestion;
        const extractOptionsFromCurrentBlockOnly = ports.extractOptionsFromCurrentBlockOnly;
        const normalizeQuestionType = ports.normalizeQuestionType;
        const choiceQuestionMissingOptions = ports.choiceQuestionMissingOptions;
        const countValidOptions = ports.countValidOptions;
        const addWarningOnce = ports.addWarningOnce;
        const batchDebugLog = ports.batchDebugLog;
        const toBatchDebugQuestion = ports.toBatchDebugQuestion;
        const getDefaultType = ports.getDefaultType;
        const clock = ports.clock;

        const validateDraftContentForReview = (q) => {
            if (!String(q?.stem || '').trim()) return '题干为空，请先补充题干。';
            if (!String(q?.type || '').trim()) return '题型为空，请先选择题型。';
            if ([q.stem, ...(Array.isArray(q.options) ? q.options : []), q.answer, q.solution].some(root.Qisi.Utils.hasUnconvertedImagePlaceholder)) {
                return '存在未转换的 DOCX 公式图片占位，请先使用页面图视觉识别生成 LaTeX。';
            }
            const optionIssue = choiceOptionIssue(q.type, q.options, q.answer);
            if (optionIssue) return optionIssue;
            if (['单选题', '多选题', '填空题'].includes(q.type) && !String(q.answer || '').trim()) return '答案为空，请先补充答案。';
            const solutionIssue = solutionQualityIssue(q.stem, q.options, q.solution);
            if (solutionIssue) return `${solutionIssue} 请先核对解析。`;
            // 安全审核版：图片未确认只 warning，不阻塞入库。
            // if (q.imageReviewStatus === 'need_confirm' || q.imageReviewStatus === 'low_confidence') return '该题图片尚未确认，请先确认图片是否正确。';
            return '';
        };


        const normalizeDraftQuestionBeforeSave = (q) => {
            if (!q) return false;

            if (typeof batchDebugLog === 'function' && typeof toBatchDebugQuestion === 'function') {
                batchDebugLog('before-save', toBatchDebugQuestion(q));
            }

            const before = JSON.stringify({
                stem: q.stem,
                options: q.options,
                answer: q.answer,
                solution: q.solution,
                type: q.type,
                warnings: q.warnings,
                mergeWarnings: q.mergeWarnings,
                sourcePageImage: q.sourcePageImage,
                sourceTrace: q.sourceTrace
            });

            // 1. 保留原始依据，不能覆盖 raw/source 字段
            root.Qisi.Utils.preserveRawEvidence(q);

            if (typeof attachSourceTraceToDraftQuestion === 'function') {
                attachSourceTraceToDraftQuestion(q);
            }

            // 2. 只清理显示字段中的污染，不动原始依据
            root.Qisi.Utils.cleanDisplayFieldsOnly(q);

            // DOCX 新导入器已经从原始 document.xml 建立选项；用户编辑后也不能再从 rawBlock 恢复旧内容。
            if (!q.userEdited && q.sourceTrace?.source !== 'docx-importer') {
                extractOptionsFromCurrentBlockOnly(q);
            }

            // 3. 只做最轻量题型归一，不自动补选项、不自动拆选项
            q.type = normalizeQuestionType(
                q.type,
                q.stem,
                q.options,
                q.answer,
                getDefaultType()
            );

            // 4. 禁止自动编造选项
            if (choiceQuestionMissingOptions(q)) {
                root.Qisi.Utils.addWarningOnce(
                    q,
                    `选择题仅识别到 ${countValidOptions(q.options)}/4 个选项，请对照原图或原文人工补全。系统未自动编造选项。`
                );
            }

            // 5. 解析可疑只提示，不清空、不挪字段
            if (typeof solutionQualityIssue === 'function') {
                const solutionIssue = solutionQualityIssue(q.stem, q.options, q.solution);
                if (solutionIssue && q.status !== 'reviewed' && q.status !== 'submitted') {
                    q.mergeWarnings = [...new Set([...(q.mergeWarnings || []), 'solutionNeedsReview'])];
                    addWarningOnce(q, `${solutionIssue}，请人工核对。`);
                }
            }

            // 6. 没有来源图只提示，不写入题干
            const hasSourceImage =
                Boolean(q.sourcePageImage || q.sourceTrace?.sourcePageImage) ||
                (Array.isArray(q.images) && q.images.some(img => img?.url));

            if (!hasSourceImage) {
                root.Qisi.Utils.addWarningOnce(q, '当前题目未绑定原图，若公式或图形缺失，请回到原文件人工核对。');
            }

            q.warnings = [...new Set(q.warnings || [])];
            q.mergeWarnings = [...new Set(q.mergeWarnings || [])];
            q.updatedAt = clock();

            const after = JSON.stringify({
                stem: q.stem,
                options: q.options,
                answer: q.answer,
                solution: q.solution,
                type: q.type,
                warnings: q.warnings,
                mergeWarnings: q.mergeWarnings,
                sourcePageImage: q.sourcePageImage,
                sourceTrace: q.sourceTrace
            });

            return before !== after;
        };


        const draftQuestionProblems = (q) => {
            if (!q) return [];
            const problems = [];
            if ((q.warnings || []).length) problems.push(...q.warnings);
            if (!root.Qisi.Utils.cleanRecognizedText(q.stem)) problems.push('题干为空，请先补充题干。');
            if ([q.stem, ...(Array.isArray(q.options) ? q.options : []), q.answer, q.solution].some(root.Qisi.Utils.hasUnconvertedImagePlaceholder)) {
                problems.push('存在未转换的 DOCX 公式图片占位，不能作为最终识别结果。');
            }
            const optionIssue = choiceOptionIssue(q.type, q.options, q.answer);
            if (optionIssue) problems.push(optionIssue);
            if (['单选题', '多选题', '填空题'].includes(q.type) && !root.Qisi.Utils.cleanRecognizedText(q.answer)) problems.push('答案为空，请先补充答案。');
            const solutionIssue = solutionQualityIssue(q.stem, q.options, q.solution);
            if (solutionIssue) problems.push(solutionIssue);
            if (q.duplicateStatus && q.duplicateStatus !== 'none') problems.push('重复或答案冲突需要确认。');
            if (q.imageReviewStatus === 'need_confirm' || q.imageReviewStatus === 'low_confidence') problems.push('该题图片尚未确认，请先确认图片是否正确。');
            return [...new Set(problems)];
        };


        return Object.freeze({
            validateDraftContentForReview,
            normalizeDraftQuestionBeforeSave,
            draftQuestionProblems
        });
    }

    return Object.freeze({ createReviewDraftNormalizationPolicy });
});
