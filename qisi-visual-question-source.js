(function initVisualQuestionSource(root, factory) {
    const api = factory(root);
    root.Qisi = root.Qisi || {};
    root.Qisi.VisualQuestionSource = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';

    function createVisualQuestionSource(ports = {}) {
        for (const name of ["cleanDisplayOptionsForBatchSave","solutionLooksFormulaPoor","normalizeQuestionKey","cleanDisplayTextForBatchSave","preferFormulaRichSolution"]) {
            if (typeof ports[name] !== 'function') {
                const error = new TypeError(
                    `Visual question source requires ${name}.`
                );
                error.code = 'VISUAL_QUESTION_SOURCE_PORT_REQUIRED';
                throw error;
            }
        }
        if (typeof ports.qwenTaskClient?.chatJson !== 'function') {
            const error = new TypeError(
                'Visual question source requires qwenTaskClient.chatJson.'
            );
            error.code = 'VISUAL_QUESTION_SOURCE_PORT_REQUIRED';
            throw error;
        }
        if (typeof ports.getRecognitionMode !== 'function') {
            const error = new TypeError(
                'Visual question source requires getRecognitionMode.'
            );
            error.code = 'VISUAL_QUESTION_SOURCE_PORT_REQUIRED';
            throw error;
        }

        const qwenTaskClient = ports.qwenTaskClient;
        const getRecognitionMode = ports.getRecognitionMode;
        const cleanDisplayOptionsForBatchSave = ports.cleanDisplayOptionsForBatchSave;
        const solutionLooksFormulaPoor = ports.solutionLooksFormulaPoor;
        const normalizeQuestionKey = ports.normalizeQuestionKey;
        const cleanDisplayTextForBatchSave = ports.cleanDisplayTextForBatchSave;
        const preferFormulaRichSolution = ports.preferFormulaRichSolution;
        const recognitionMode = () => getRecognitionMode() || 'standard';

        const locateQuestionFiguresWithQwen = async ({
            pageImage,
            pageNo = 1,
            sourceFileName = '',
            questions = [],
            signal
        } = {}) => {
            if (!pageImage) return [];

            const questionSummaries = (questions || []).map(q => ({
                question: String(q.question || q.questionNumber || q.order || '').trim(),
                stem: root.Qisi.Utils.cleanRecognizedText(q.stem || '').slice(0, 260),
                options: Array.isArray(q.options)
                    ? q.options.map(opt => root.Qisi.Utils.cleanRecognizedText(opt || '').slice(0, 120))
                    : [],
                hasFigureCue: /图|如图|图中|图甲|图乙|示意图|统计图|函数图|几何图|折扇|圆弧|扇形/.test(
                    root.Qisi.Utils.cleanRecognizedText([
                        q.stem,
                        ...(Array.isArray(q.options) ? q.options : [])
                    ].join('\n'))
                )
            })).filter(q => q.question);

            if (!questionSummaries.length) return [];

            const prompt = `
        你是试卷页面图形定位助手。请只做一件事：定位页面中“题目真正需要的插图/图形/示意图/统计图/几何图”的位置。

        【页面信息】
        文件：${sourceFileName || '未知文件'}
        页码：${pageNo}

        【题目信息】
        ${JSON.stringify(questionSummaries, null, 2)}

        【输出 JSON 格式】
        {
          "figures": [
            {
              "question": "4",
              "image_bbox": [x1, y1, x2, y2],
              "image_description": "图甲折扇和图乙扇形侧面图",
              "image_confidence": 0.92
            }
          ]
        }

        【坐标规则】
        1. image_bbox 使用 0-1000 的归一化坐标，表示相对于整张页面图片的位置。
        2. x1,y1 是左上角，x2,y2 是右下角。
        3. bbox 必须完整包住图形，宁可稍微多留白，也不要截断。
        4. 如果一题有图甲、图乙等多个图，可以返回多个 figure；程序会合并为该题的一张完整题图。

        【严禁事项】
        1. 不要框整道题。
        2. 不要框题干文字。
        3. 不要框 A/B/C/D 选项文字。
        4. 不要把普通数学公式当成图片。
        5. 没有图形的题不要返回。
        6. 不确定的图不要返回，不要编造。
        7. 只输出 JSON，不要解释。
        `;

            try {
                    const result = await qwenTaskClient.chatJson({
                        task: 'general-vision',
                        prompt,
                        imageUrl: pageImage,
                        imageOptions: {
                            min_pixels: 3136,
                            max_pixels: 30720000,
                            enable_rotate: true
                        },
                        mode: recognitionMode(),
                        timeoutMs: 90000,
                        maxTokens: 2048,
                        label: 'Qwen 题图定位请求',
                        signal
                    });
                    const parsed = result.value;
                    const rows = Array.isArray(parsed)
                        ? parsed
                        : (Array.isArray(parsed?.figures) ? parsed.figures : []);

                    const normalized = rows.map(row => ({
                        question: root.Qisi.Utils.cleanRecognizedText(
                            row.question ??
                            row.questionNumber ??
                            row.no ??
                            row.题号 ??
                            ''
                        ),
                        image_bbox:
                            row.image_bbox ||
                            row.imageBbox ||
                            row.bbox ||
                            row.图片区域 ||
                            [],
                        image_description: root.Qisi.Utils.cleanRecognizedText(
                            row.image_description ||
                            row.description ||
                            row.图像说明 ||
                            '题中图形'
                        ),
                        image_confidence: Number(
                            row.image_confidence ??
                            row.confidence ??
                            row.score ??
                            0.82
                        )
                    })).filter(row =>
                        row.question &&
                        Array.isArray(row.image_bbox) &&
                        row.image_bbox.length === 4
                    );

                    console.groupCollapsed(`[BATCH_V2][figure-locator] ${sourceFileName} 第${pageNo}页`);
                    console.table(normalized.map(row => ({
                        question: row.question,
                        bbox: JSON.stringify(row.image_bbox),
                        confidence: row.image_confidence,
                        desc: row.image_description
                    })));
                    console.groupEnd();

                    return normalized;
            } catch (error) {
                if (root.Qisi.Utils.isFatalQwenServiceError(error)) {
                    throw error;
                }
                console.warn('[BATCH_V2][figure-locator-failed]', {
                    code: error?.code || 'QWEN_FIGURE_LOCATOR_FAILED'
                });
            }
            return [];
        };


        const repairPageChoiceAndSolutionDetailsWithVision = async (
            file,
            imageUrl,
            pageNo,
            questions = [],
            pageMarkdown = '',
            signal
        ) => {
            const targets = (questions || []).map((q, idx) => {
                const optionCount = cleanDisplayOptionsForBatchSave(q.options).filter(Boolean).length;
                const needOptions =
                    ['单选题', '多选题'].includes(q.type) && optionCount < 4 ||
                    /^[A-D]{1,4}$/.test(root.Qisi.Utils.cleanRecognizedText(q.answer).replace(/[.\s、，。:：；;()（）]/g, '').toUpperCase()) && optionCount < 4;

                const needSolution =
                    root.Qisi.Utils.cleanRecognizedText(q.solution) &&
                    solutionLooksFormulaPoor(q.stem, q.solution);

                return {
                    index: idx,
                    question: q.question || q.questionNumber || String(idx + 1),
                    type: q.type,
                    stem: root.Qisi.Utils.cleanRecognizedText(q.stem).slice(0, 500),
                    answer: root.Qisi.Utils.cleanRecognizedText(q.answer),
                    optionCount,
                    needOptions,
                    needSolution
                };
            }).filter(item => item.needOptions || item.needSolution);

            if (!targets.length) return questions;

            const prompt = `
        你是高中数学试卷的页级修复器。请只根据页面图片和 OCR Markdown，对指定题目补充两类信息：

        1. 选择题 A/B/C/D 选项；
        2. 解析中的数学公式。

        严禁事项：
        - 不要编造原图没有的选项。
        - 不要用解析反推四个选项。
        - 不要把公式改写成普通中文。
        - 不要改题号。
        - 不要输出解释文字。

        输出严格 JSON：
        {
          "patches": [
            {
              "question": "1",
              "options": ["A选项", "B选项", "C选项", "D选项"],
              "solution": "带 LaTeX 公式的解析；如果原解析没有公式，则返回原解析",
              "rawBlock": "当前题在 OCR/图片中的原文块"
            }
          ]
        }

        待修复题目：
        ${JSON.stringify(targets, null, 2)}

        OCR Markdown：
        ${pageMarkdown || '空'}
        `;

            try {
                    const taskResult = await qwenTaskClient.chatJson({
                        task: 'general-vision',
                        prompt,
                        imageUrl,
                        imageOptions: {
                            min_pixels: 3136,
                            max_pixels: 30720000,
                            enable_rotate: true
                        },
                        mode: recognitionMode(),
                        timeoutMs: 90000,
                        label: 'Qwen 页级细节修复请求',
                        signal
                    });
                    const parsed = taskResult.value;
                    const patches = Array.isArray(parsed?.patches) ? parsed.patches : [];

                    if (!patches.length) return questions;

                    const patchByQuestion = new Map();
                    patches.forEach((patch, idx) => {
                        const key = normalizeQuestionKey(patch.question || patch.题号 || patch.no || patch.index || '');
                        if (key) patchByQuestion.set(key, patch);
                        else if (targets[idx]) patchByQuestion.set(normalizeQuestionKey(targets[idx].question), patch);
                    });

                    const repaired = questions.map((q, idx) => {
                        const key = normalizeQuestionKey(q.question || q.questionNumber || String(idx + 1));
                        const patch = patchByQuestion.get(key);
                        if (!patch) return q;

                        const next = { ...q };

                        const patchedOptions = root.Qisi.Utils.cleanDisplayOptionsForBatchSave(patch.options || patch.选项 || []);
                        const oldOptions = root.Qisi.Utils.cleanDisplayOptionsForBatchSave(next.options || []);
                        if (patchedOptions.filter(Boolean).length > oldOptions.filter(Boolean).length) {
                            next.options = patchedOptions;
                            if (!['单选题', '多选题'].includes(next.type)) {
                                next.type = patchedOptions.filter(Boolean).length >= 2 ? '单选题' : next.type;
                            }
                            next.warnings = [
                                ...(next.warnings || []),
                                `已通过页级视觉细节修复补回 ${patchedOptions.filter(Boolean).length}/4 个选项，请核对。`
                            ];
                        }

                        const patchedSolution = cleanDisplayTextForBatchSave(
                            patch.solution || patch.解析 || patch.analysis || patch.explanation || ''
                        );

                        if (patchedSolution) {
                            const preferred = preferFormulaRichSolution(patchedSolution, next.solution, next.stem);
                            if (preferred !== cleanDisplayTextForBatchSave(next.solution)) {
                                next.solution = preferred;
                                next.warnings = [
                                    ...(next.warnings || []),
                                    '已通过页级视觉细节修复补回带公式解析，请核对。'
                                ];
                            }
                        }

                        const rawBlock = root.Qisi.Utils.cleanRecognizedText(patch.rawBlock || patch.rawText || patch.原文 || '');
                        if (rawBlock) {
                            next.rawBlock = rawBlock;
                            next.rawText = next.rawText || rawBlock;
                            next.sourceTrace = {
                                ...(next.sourceTrace || {}),
                                rawBlock,
                                pageText: next.sourceTrace?.pageText || pageMarkdown || ''
                            };
                        }

                        return next;
                    });

                    console.groupCollapsed(`[BATCH_DEBUG][page-vision-repair] ${file.filename} 第${pageNo}页`);
                    console.table(repaired.map(q => ({
                        question: q.question,
                        type: q.type,
                        optionCount: (q.options || []).filter(Boolean).length,
                        solutionMathSignal: root.Qisi.Utils.mathSignalCount(q.solution),
                        solutionHead: root.Qisi.Utils.cleanRecognizedText(q.solution).slice(0, 120)
                    })));
                    console.groupEnd();

                    return repaired;
            } catch (error) {
                if (root.Qisi.Utils.isFatalQwenServiceError(error)) {
                    throw error;
                }
                console.warn('页级细节修复失败，保留原识别结果', {
                    code: error?.code || 'QWEN_PAGE_REPAIR_FAILED'
                });
            }
            return questions;
        };




        const loadImageElement = (url) => new Promise((resolve, reject) => {
            const image = new root.Image();
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error('图片读取失败'));
            image.src = url;
        });

        const cropDataUrlByBbox = async (dataUrl, bbox, padding = 8) => {
            if (!Array.isArray(bbox) || bbox.length !== 4 || bbox.some(v => !Number.isFinite(Number(v)))) return dataUrl;
            const image = await loadImageElement(dataUrl);
            const imageWidth = image.naturalWidth || image.width;
            const imageHeight = image.naturalHeight || image.height;
            let [x1, y1, x2, y2] = bbox.map(Number);
            const maxCoord = Math.max(x1, y1, x2, y2);
            if (maxCoord <= 1000 && (imageWidth > 1200 || imageHeight > 1200)) {
                x1 = x1 / 1000 * imageWidth;
                x2 = x2 / 1000 * imageWidth;
                y1 = y1 / 1000 * imageHeight;
                y2 = y2 / 1000 * imageHeight;
            }
            const left = Math.max(0, Math.min(x1, x2) - padding);
            const top = Math.max(0, Math.min(y1, y2) - padding);
            const right = Math.min(imageWidth, Math.max(x1, x2) + padding);
            const bottom = Math.min(imageHeight, Math.max(y1, y2) + padding);
            const width = Math.max(1, right - left);
            const height = Math.max(1, bottom - top);
            const canvas = root.document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(image, left, top, width, height, 0, 0, width, height);
            return canvas.toDataURL('image/jpeg', 0.92);
        };


        return Object.freeze({
            locateQuestionFiguresWithQwen,
            repairPageChoiceAndSolutionDetailsWithVision,
            cropDataUrlByBbox
        });
    }

    return Object.freeze({ createVisualQuestionSource });
});
