(function initStrictQuestionPolicy(root, factory) {
    const api = factory(root);
    root.Qisi = root.Qisi || {};
    root.Qisi.StrictQuestionPolicy = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';

    function createStrictQuestionPolicy(ports = {}) {
        for (const name of [
            'cleanDisplayOptionsForBatchSave',
            'latexErrorCountForText'
        ]) {
            if (typeof ports[name] !== 'function') {
                const error = new TypeError(
                    `Strict question policy requires ${name}.`
                );
                error.code = 'STRICT_QUESTION_POLICY_PORT_REQUIRED';
                throw error;
            }
        }

        const cleanDisplayOptionsForBatchSave =
            ports.cleanDisplayOptionsForBatchSave;
        const latexErrorCountForText =
            ports.latexErrorCountForText;

        const optionCountForGolden = (options = []) =>
            (Array.isArray(options) ? options : [])
                .filter(opt => root.Qisi.Utils.cleanRecognizedText(opt || '') && !root.Qisi.Utils.hasUnconvertedImagePlaceholder(opt))
                .length;

        const validateDocxVisualItems = (items = [], expectedQuestionCount = 0) => {
            const failedQuestions = [];
            const reasons = [];
            const rows = (items || []).map((item, idx) => {
                const options = cleanDisplayOptionsForBatchSave(item.options || []);
                const optionCount = optionCountForGolden(options);
                const hasPlaceholder = root.Qisi.Utils.itemHasUnconvertedImagePlaceholder({ ...item, options });
                const stemLength = root.Qisi.Utils.cleanRecognizedText(item.stem || '').length;
                const latexErrorCount = [item.stem, ...options, item.answer, item.solution]
                    .reduce((sum, text) => sum + (typeof latexErrorCountForText === 'function' ? latexErrorCountForText(text) : 0), 0);
                const failures = [];

                if (!stemLength) failures.push('题干为空');
                options.forEach((opt, optIdx) => {
                    if (!root.Qisi.Utils.cleanRecognizedText(opt || '') || root.Qisi.Utils.hasUnconvertedImagePlaceholder(opt)) {
                        failures.push(`${String.fromCharCode(65 + optIdx)} 选项为空或无效`);
                    }
                });
                if (optionCount < 4) failures.push(`选项不足 4 个：实际 ${optionCount}`);
                if (hasPlaceholder) failures.push('仍包含公式图片占位符');
                if (latexErrorCount > 0) failures.push(`LaTeX 渲染失败 ${latexErrorCount} 处`);

                if (failures.length) {
                    failedQuestions.push({
                        order: idx + 1,
                        questionNumber: item.question || item.questionNumber || String(idx + 1),
                        failures
                    });
                    failures.forEach(reason => {
                        reasons.push(`第 ${item.question || item.questionNumber || idx + 1} 题：${reason}`);
                    });
                }

                return {
                    order: idx + 1,
                    questionNumber: item.question || item.questionNumber || String(idx + 1),
                    stemLength,
                    optionCount,
                    optionA: options[0] || '',
                    optionB: options[1] || '',
                    optionC: options[2] || '',
                    optionD: options[3] || '',
                    hasPlaceholder,
                    latexErrorCount
                };
            });

            if (expectedQuestionCount && items.length !== expectedQuestionCount) {
                reasons.unshift(`题数不等于 ${expectedQuestionCount}：实际 ${items.length}`);
                failedQuestions.push({
                    order: 0,
                    questionNumber: 'all',
                    failures: [`题数不等于 ${expectedQuestionCount}：实际 ${items.length}`]
                });
            }

            return {
                ok: failedQuestions.length === 0,
                reasons,
                rows,
                failedQuestions
            };
        };

        const UNCONVERTED_OPTION_PLACEHOLDER_RE =
            /\[(?:公式图片|图片)选项待转换[:：]?\s*(?:wmf|emf|ole|bin|unknown)?\]/i;

        const cleanOptionTextForCheck = (value) => root.Qisi.Utils.cleanRecognizedText(String(value || ''))
            .replace(/^选项\s*[A-D]\s*[:：.．、)]?\s*/i, '')
            .trim();

        const isBadChoiceOption = (value) => {
            const text = cleanOptionTextForCheck(value);

            if (!text) return true;
            if (/^[A-D]$/i.test(text)) return true;
            if (/^选项\s*[A-D]$/i.test(text)) return true;
            if (UNCONVERTED_OPTION_PLACEHOLDER_RE.test(text)) return true;
            if (/无法识别|待转换|公式图片|图片选项|undefined|null|false/i.test(text)) return true;

            return false;
        };

        const normalizeFourOptionsForCheck = (options) => {
            const arr = Array.isArray(options) ? options : [];

            return [0, 1, 2, 3].map(idx => cleanOptionTextForCheck(arr[idx] || ''));
        };

        const STRICT_QUESTION_TYPES = new Set([
            '单选题',
            '多选题',
            '填空题',
            '解答题',
            '证明题'
        ]);

        const isStrictChoiceType = (type = '') =>
            type === '单选题' || type === '多选题';

        const normalizeStrictQuestionType = (item = {}) => {
            const rawType = root.Qisi.Utils.cleanRecognizedText(
                item.type ||
                item.questionType ||
                item.题型 ||
                ''
            );

            if (/多项?选择|多选|多项/.test(rawType)) return '多选题';
            if (/单项?选择|单选/.test(rawType)) return '单选题';
            if (/填空/.test(rawType)) return '填空题';
            if (/证明/.test(rawType)) return '证明题';
            if (/解答|计算|应用/.test(rawType)) return '解答题';
            if (STRICT_QUESTION_TYPES.has(rawType)) return rawType;

            const stem = root.Qisi.Utils.cleanRecognizedText(item.stem || '');
            const options = normalizeFourOptionsForCheck(item.options || []);
            const validOptionCount = options.filter(option => !isBadChoiceOption(option)).length;

            if (validOptionCount >= 2) return '单选题';

            if (/填空题|_{3,}|____+|______|横线中填入|空格/.test(stem)) {
                return '填空题';
            }

            return '解答题';
        };

        const validateVisualQuestionItems = (items, expectedQuestionCount = 0) => {
            const list = Array.isArray(items) ? items : [];
            const rows = [];
            const failedQuestions = [];
            const fatalReasons = [];
            const warningReasons = [];

            if (!list.length) {
                fatalReasons.push('没有识别到任何题目');
            }

            if (expectedQuestionCount > 0 && list.length !== expectedQuestionCount) {
                warningReasons.push(
                    `题数与人工预期不一致：识别到 ${list.length} 道，人工预期 ${expectedQuestionCount} 道`
                );
            }

            list.forEach((item, index) => {
                const questionNumber = root.Qisi.Utils.cleanRecognizedText(
                    item.questionNumber ||
                    item.question ||
                    item.no ||
                    String(index + 1)
                );
                const stem = root.Qisi.Utils.cleanRecognizedText(item.stem || '');
                const type = normalizeStrictQuestionType(item);
                const options = normalizeFourOptionsForCheck(item.options || []);
                const failures = [];
                const warnings = [];

                item.type = type;
                item.options = options;

                if (!stem) {
                    failures.push('题干为空');
                }

                if (isStrictChoiceType(type)) {
                    options.forEach((option, optionIndex) => {
                        if (isBadChoiceOption(option)) {
                            warnings.push(`${String.fromCharCode(65 + optionIndex)} 选项无效：${option || '空'}`);
                        }
                    });

                    const validCount = options.filter(option => !isBadChoiceOption(option)).length;

                    if (validCount < 4) {
                        warnings.push(`选择题有效选项不足：${validCount}/4`);
                    }
                }

                if (root.Qisi.Utils.hasUnconvertedOptionPlaceholder(item)) {
                    failures.push('仍包含 WMF/OLE 待转换占位符');
                }

                rows.push({
                    order: index + 1,
                    questionNumber,
                    type,
                    stemLength: stem.length,
                    optionCount: options.filter(Boolean).length,
                    validOptionCount: options.filter(option => !isBadChoiceOption(option)).length,
                    A: options[0],
                    B: options[1],
                    C: options[2],
                    D: options[3],
                    failures: failures.join('；'),
                    warnings: warnings.join('；')
                });

                if (failures.length || warnings.length) {
                    failedQuestions.push({
                        order: index + 1,
                        questionNumber,
                        type,
                        failures,
                        warnings
                    });
                }

                failures.forEach(reason => {
                    fatalReasons.push(`第 ${questionNumber} 题：${reason}`);
                });

                warnings.forEach(reason => {
                    warningReasons.push(`第 ${questionNumber} 题：${reason}`);
                });
            });

            return {
                ok: fatalReasons.length === 0 && warningReasons.length === 0,
                canReview: fatalReasons.length === 0,
                fatal: fatalReasons.length > 0,
                reasons: [...fatalReasons, ...warningReasons],
                fatalReasons,
                warningReasons,
                rows,
                failedQuestions
            };
        };

        const optionQualityScore = (value = '') => {
            const text = cleanOptionTextForCheck(value);

            if (isBadChoiceOption(text)) return 0;

            return Math.min(
                100,
                text.length + (/[\\$]|\\frac|\\sqrt|\\sin|\\cos|\\pi/.test(text) ? 20 : 0)
            );
        };

        const chooseBetterStrictText = (a = '', b = '') => {
            const left = root.Qisi.Utils.cleanRecognizedText(a);
            const right = root.Qisi.Utils.cleanRecognizedText(b);

            if (!left) return right;
            if (!right) return left;

            return right.length > left.length ? right : left;
        };

        const mergeStrictQuestionItemsByNumber = (items = []) => {
            const output = [];
            const byQuestionNumber = new Map();

            for (const rawItem of items || []) {
                if (!rawItem) continue;

                const item = {
                    ...rawItem,
                    questionNumber: root.Qisi.Utils.cleanRecognizedText(
                        rawItem.questionNumber ||
                        rawItem.question ||
                        rawItem.no ||
                        ''
                    ),
                    type: normalizeStrictQuestionType(rawItem),
                    options: normalizeFourOptionsForCheck(rawItem.options || []),
                    recognizedImages: collectValidRecognizedFigures(rawItem),
                    sourcePages: [
                        ...new Set([
                            ...(rawItem.sourcePages || []),
                            Number(rawItem.sourcePage || rawItem.pageIndex || 0) || 0
                        ].filter(Boolean))
                    ]
                };

                const key = item.questionNumber;

                if (!key) {
                    output.push(item);
                    continue;
                }

                if (!byQuestionNumber.has(key)) {
                    byQuestionNumber.set(key, item);
                    output.push(item);
                    continue;
                }

                const current = byQuestionNumber.get(key);

                current.stem = chooseBetterStrictText(current.stem, item.stem);
                current.rawBlock = [current.rawBlock, item.rawBlock].filter(Boolean).join('\n');
                current.type =
                    current.type === '解答题' && item.type !== '解答题'
                        ? item.type
                        : current.type || item.type;
                current.options = [0, 1, 2, 3].map(index => {
                    const left = current.options?.[index] || '';
                    const right = item.options?.[index] || '';

                    return optionQualityScore(right) > optionQualityScore(left) ? right : left;
                });
                current.sourcePages = [
                    ...new Set([
                        ...(current.sourcePages || []),
                        ...(item.sourcePages || [])
                    ])
                ].sort((a, b) => a - b);
                current.sourcePage =
                    current.sourcePages[0] ||
                    current.sourcePage ||
                    item.sourcePage ||
                    0;
                current.question_bbox =
                    current.question_bbox?.length
                        ? current.question_bbox
                        : item.question_bbox || [];
                current.recognizedImages = [
                    ...collectValidRecognizedFigures(current),
                    ...collectValidRecognizedFigures(item)
                ].filter((figure, index, rows) => {
                    const key = figure.image_bbox.map(value => Math.round(value)).join(',');

                    return rows.findIndex(other =>
                        other.image_bbox.map(value => Math.round(value)).join(',') === key
                    ) === index;
                });
                current.confidence = Math.max(
                    Number(current.confidence || 0),
                    Number(item.confidence || 0)
                );
            }

            return output;
        };

        const mapWithConcurrency = async (items, concurrency, worker) => {
            const source = Array.isArray(items) ? items : [];
            const results = new Array(source.length);
            let cursor = 0;
            const runners = Array.from({
                length: Math.min(Math.max(1, concurrency), Math.max(1, source.length))
            }, async () => {
                while (true) {
                    const index = cursor;
                    cursor += 1;

                    if (index >= source.length) return;

                    results[index] = await worker(source[index], index);
                }
            });

            await Promise.all(runners);
            return results;
        };

        const QUESTION_FIGURE_CUE_RE =
            /如图|见图|下图|图中|图甲|图乙|图丙|示意图|统计图|函数图像|几何图|阴影部分|折扇|扇形图|圆弧图/;

        const questionHasFigureCue = (item = {}) => {
            const text = [
                item.stem,
                ...(Array.isArray(item.options) ? item.options : [])
            ].join('\n');

            return QUESTION_FIGURE_CUE_RE.test(root.Qisi.Utils.cleanRecognizedText(text));
        };

        const bboxAreaForQuestionFigure = (bbox) => {
            const normalized = root.Qisi.Utils.normalizeFigureBbox(bbox);
            if (!normalized.length) return 0;

            const [x1, y1, x2, y2] = normalized;
            return Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
        };

        const normalizeRecognizedFigureDescriptor = (raw = {}) => {
            const bbox = root.Qisi.Utils.normalizeFigureBbox(
                raw.image_bbox ||
                raw.imageBbox ||
                raw.bbox ||
                raw.图片区域
            );

            if (!bbox.length) return null;

            return {
                image_bbox: bbox,
                image_description: root.Qisi.Utils.cleanRecognizedText(
                    raw.image_description ||
                    raw.description ||
                    raw.图像说明 ||
                    '题中图形'
                ),
                image_confidence: Number(
                    raw.image_confidence ??
                    raw.confidence ??
                    raw.score ??
                    0.78
                )
            };
        };

        const isLikelyRealQuestionFigure = (figure, questionBbox = []) => {
            const normalized = normalizeRecognizedFigureDescriptor(figure);
            if (!normalized) return false;

            const figureBbox = normalized.image_bbox;
            const figureArea = bboxAreaForQuestionFigure(figureBbox);
            if (!figureArea) return false;

            const confidence = Number(normalized.image_confidence || 0);
            if (confidence < 0.62) return false;

            const maxCoordinate = Math.max(...figureBbox);
            if (maxCoordinate <= 1000) {
                const pageAreaRatio = figureArea / 1000000;
                if (pageAreaRatio < 0.0003 || pageAreaRatio > 0.45) {
                    return false;
                }
            }

            const normalizedQuestionBbox = root.Qisi.Utils.normalizeFigureBbox(questionBbox);
            if (normalizedQuestionBbox.length) {
                const questionArea = bboxAreaForQuestionFigure(normalizedQuestionBbox);
                if (questionArea > 0) {
                    const figureToQuestionRatio = figureArea / questionArea;
                    const intersection = root.Qisi.Utils.bboxIntersectionArea(figureBbox, normalizedQuestionBbox);
                    const figureInsideQuestionRatio = intersection / figureArea;

                    if (figureToQuestionRatio >= 0.78 && figureInsideQuestionRatio >= 0.9) {
                        return false;
                    }
                }
            }

            return true;
        };

        const collectValidRecognizedFigures = (item = {}) => {
            const rawRows = [
                ...(Array.isArray(item.recognizedImages) ? item.recognizedImages : []),
                ...(Array.isArray(item.images) ? item.images : [])
            ];
            const result = [];
            const seen = new Set();

            for (const raw of rawRows) {
                const normalized = normalizeRecognizedFigureDescriptor(raw);

                if (
                    !normalized ||
                    !isLikelyRealQuestionFigure(
                        normalized,
                        item.question_bbox || item.sourceBbox || []
                    )
                ) {
                    continue;
                }

                const key = normalized.image_bbox.map(value => Math.round(value)).join(',');
                if (seen.has(key)) continue;

                seen.add(key);
                result.push(normalized);
            }

            return result;
        };

        const isRealQuestionFigureImageRow = (image) => {
            if (!image?.url) return false;
            if (image.status === 'deleted' || image.displayable === false) return false;

            const source = String(image.source || '');
            const description = String(image.description || image.filename || image.name || '');

            return (
                source === 'auto-figure-crop' ||
                source === 'pdf-layout-figure-crop' ||
                source === 'manual-crop' ||
                source === 'uploaded-question-image' ||
                source === 'docx-inline-figure' ||
                /自动裁剪题图|人工裁剪题图|题中图形/.test(description)
            );
        };
































        const runBatchDocxGoldenCheck = (drafts = [], expectedQuestionCount = 6) => {
            const sorted = [...(drafts || [])].sort((a, b) => (Number(a.order || 0) - Number(b.order || 0)));
            const failedQuestions = [];
            const rows = sorted.map((q, idx) => {
                const options = cleanDisplayOptionsForBatchSave(q.options || []);
                const allTexts = [q.stem, ...options, q.answer, q.solution].map(x => String(x || ''));
                const hasPlaceholder = allTexts.some(root.Qisi.Utils.hasUnconvertedImagePlaceholder);
                const latexErrorCount = allTexts.reduce((sum, text) => sum + latexErrorCountForText(text), 0);
                const optionCount = optionCountForGolden(options);
                const failures = [];

                if (!root.Qisi.Utils.cleanRecognizedText(q.stem || '')) failures.push('题干为空');
                if (!['单选题', '多选题'].includes(q.type)) failures.push(`题型不是选择题：${q.type || ''}`);
                if (optionCount < 4) failures.push(`只识别到 ${optionCount}/4 个有效选项`);
                if (hasPlaceholder) failures.push('存在未转换公式图片占位');
                if (latexErrorCount > 0) failures.push(`LaTeX 渲染失败 ${latexErrorCount} 处`);

                if (failures.length) {
                    failedQuestions.push({
                        order: idx + 1,
                        questionNumber: q.questionNumber || q.question || String(idx + 1),
                        failures
                    });
                }

                return {
                    order: idx + 1,
                    questionNumber: q.questionNumber || q.question || String(idx + 1),
                    stemLength: root.Qisi.Utils.cleanRecognizedText(q.stem || '').length,
                    optionA: options[0] || '',
                    optionB: options[1] || '',
                    optionC: options[2] || '',
                    optionD: options[3] || '',
                    hasPlaceholder,
                    latexErrorCount
                };
            });

            if (sorted.length !== expectedQuestionCount) {
                failedQuestions.unshift({
                    order: 0,
                    questionNumber: 'all',
                    failures: [`题数 ${sorted.length}/${expectedQuestionCount}`]
                });
            }

            const result = {
                expectedQuestionCount,
                actualQuestionCount: sorted.length,
                allQuestionsHaveStem: sorted.every(q => root.Qisi.Utils.cleanRecognizedText(q.stem || '')),
                allChoiceQuestionsHaveFourOptions: sorted.every(q => optionCountForGolden(q.options || []) >= 4),
                noUnconvertedImagePlaceholder: !sorted.some(q => [q.stem, ...(q.options || []), q.answer, q.solution].some(root.Qisi.Utils.hasUnconvertedImagePlaceholder)),
                allLatexRenderable: rows.every(row => row.latexErrorCount === 0),
                failedQuestions
            };

            console.groupCollapsed(`[BATCH_GOLDEN][docx] ${result.failedQuestions.length ? 'FAIL' : 'PASS'}`);
            console.log(result);
            console.table(rows);
            if (failedQuestions.length) console.table(failedQuestions);
            console.groupEnd();

            return result;
        };

        root.__qisiTestBatchDocxGolden = async function (batchId = activeBatchId.value, expectedQuestionCount = 6) {
            const targetBatchId = batchId || activeBatchId.value;
            if (!targetBatchId) {
                const result = {
                    expectedQuestionCount,
                    actualQuestionCount: 0,
                    allQuestionsHaveStem: false,
                    allChoiceQuestionsHaveFourOptions: false,
                    noUnconvertedImagePlaceholder: false,
                    allLatexRenderable: false,
                    failedQuestions: [{ order: 0, questionNumber: 'all', failures: ['没有 activeBatchId，请先打开审核页或传入 batchId'] }]
                };
                console.warn('[BATCH_GOLDEN][docx] FAIL', result);
                return result;
            }

            const loaded = await draftPersistenceService.reloadDraftBatch(
                targetBatchId
            );
            return runBatchDocxGoldenCheck(
                loaded.questions,
                expectedQuestionCount
            );
        };

        root.__qisiTestBatchVisualGolden = async function (batchId = activeBatchId.value, expectedQuestionCount = 6) {
            const result = await root.__qisiTestBatchDocxGolden(batchId, expectedQuestionCount);
            console.groupCollapsed(`[BATCH_GOLDEN][visual] ${result.failedQuestions?.length ? 'FAIL' : 'PASS'}`);
            console.log(result);
            console.groupEnd();
            return result;
        };

        // ============================================================
        // BATCH FINAL GATE：批量录题最终仲裁闸门
        // 作用：所有写入 draftQuestions 的草稿，最终必须经过这里。
        // 解决：同一题号出现“好版本 + 坏版本”重复保存的问题。
        // ============================================================


        return Object.freeze({
            optionCountForGolden,
            isBadChoiceOption,
            normalizeFourOptionsForCheck,
            isStrictChoiceType,
            validateDocxVisualItems,
            validateVisualQuestionItems,
            mergeStrictQuestionItemsByNumber,
            mapWithConcurrency,
            questionHasFigureCue,
            normalizeRecognizedFigureDescriptor,
            isLikelyRealQuestionFigure,
            collectValidRecognizedFigures,
            isRealQuestionFigureImageRow,
            runBatchDocxGoldenCheck
        });
    }

    return Object.freeze({ createStrictQuestionPolicy });
});
