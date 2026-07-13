(function (root, factory) {
    const api = factory(root);
    root.Qisi = root.Qisi || {};
    root.Qisi.QwenVisionSourcePort = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';

    const buildStrictQuestionPrompt = ({
        expectedQuestionCount = 0,
        repairInfo = ''
    } = {}) => `你是高中数学试卷整页 OCR、题目结构识别与 LaTeX 转写器。

完整识别当前页实际出现的题目或跨页片段。必须依据章节标题区分单选题、多选题、填空题、解答题和证明题；能判断题号时返回原题号，不得为补齐序号虚构题目。

选择题返回 A/B/C/D 四个选项，看不清的选项留空。填空、解答和证明题不得编造选项。公式使用可渲染 LaTeX，answer 和 solution 必须留空。

question_bbox 表示整题区域；images 仅包含真正需要保留的照片、几何图、函数图、统计图或示意图。image_bbox 使用整页 0-1000 坐标。不得把题干、选项、普通公式或整道题当图片；不确定时返回空数组。

${expectedQuestionCount ? `人工预计题数 ${expectedQuestionCount} 仅供参考，不得据此凑数。` : ''}

只输出以下严格 JSON，不要 Markdown、解释、undefined、null 或占位文本：
{
  "questions": [{
    "questionNumber": "原题号",
    "type": "单选题/多选题/填空题/解答题/证明题",
    "stem": "完整题干",
    "options": {"A":"","B":"","C":"","D":""},
    "answer": "",
    "solution": "",
    "isFragment": false,
    "question_bbox": [0,0,0,0],
    "images": [{
      "image_bbox": [0,0,0,0],
      "image_description": "题图说明",
      "image_confidence": 0.92
    }]
  }]
}

${repairInfo ? `需要重点修复：\n${repairInfo}` : ''}`;

    const requiredFunctions = (ports, names) => {
        for (const name of names) {
            if (typeof ports?.[name] !== 'function') {
                const error = new TypeError(
                    `Qwen vision source port requires ${name}.`
                );
                error.code = 'QWEN_VISION_SOURCE_PORT_REQUIRED';
                throw error;
            }
        }
    };

    const createProductionOcrRuntime = ({
        onAiRequest,
        getMode,
        cleanText,
        isFatalError,
        warn
    } = {}) => {
        const adapter = root?.Qisi?.OcrQwenAdapter;
        requiredFunctions(adapter, [
            'createQwenProxyTransport',
            'createQwenTaskClient'
        ]);
        requiredFunctions({ cleanText, isFatalError }, [
            'cleanText',
            'isFatalError'
        ]);
        if (typeof getMode !== 'function') {
            const error = new TypeError(
                'Qwen production OCR runtime requires getMode.'
            );
            error.code = 'QWEN_VISION_SOURCE_PORT_REQUIRED';
            throw error;
        }

        const transport = adapter.createQwenProxyTransport({ onAiRequest });
        const taskClient = adapter.createQwenTaskClient({
            transport,
            getMode
        });
        const documentOcrSource = createDocumentOcrSource({
            ocrText: options => taskClient.ocrText(options),
            chatText: options => taskClient.chatText(options),
            cleanText,
            isFatalError,
            warn
        });

        return Object.freeze({
            taskClient,
            documentOcrSource,
            requestText: options => taskClient.chatText(options)
        });
    };

    const createStrictQuestionPageRecognizer = (ports = {}) => {
        requiredFunctions(ports, [
            'requestText',
            'parseStrictQuestionPayload',
            'postprocessRecognizedItems',
            'getDefaultType',
            'getRoles',
            'logDiagnostic',
            'projectDocxVisionCandidate'
        ]);

        const projectItems = ({
            file,
            pageNo,
            imageUrl,
            rawText,
            payload,
            model
        }) => {
            const rawQuestions = payload.questions || [];
            const processed = ports.postprocessRecognizedItems(
                rawQuestions,
                {
                    id: file.id,
                    filename: file.filename,
                    fileType: file.fileType || 'image',
                    sourcePage: pageNo,
                    pageIndex: pageNo,
                    sourcePageImage: imageUrl,
                    pageText: rawText,
                    sourceText: rawText
                },
                ports.getDefaultType() || '单选题',
                {
                    allowTextResplit: false,
                    allowSyntheticQuestionNumber: false
                }
            );
            return processed.map((question, index) => {
                const sourceId = file.convertedFromDocx
                    ? file.sourceDocxFileId
                    : file.id;
                const strictProtocol = {
                    accepted: true,
                    decisionId: `${file.convertedFromDocx
                        ? 'strict-docx'
                        : 'strict-pdf'}:${sourceId}:${pageNo}:${model}`,
                    fields: ['questionNumber', 'stem', 'options'],
                    method: payload.method || 'strict-json-contract',
                    sourceId,
                    engine: model
                };
                const candidate = {
                    ...question,
                    type: question.type || '单选题',
                    sourceFileId: file.id,
                    sourceFileName: file.filename || '',
                    sourcePage: pageNo,
                    sourcePageImage: imageUrl,
                    sourceTrace: {
                        ...(question.sourceTrace || {}),
                        source: 'strict-visual-page-qwen',
                        model,
                        strictProtocol,
                        sourceFileId: file.id,
                        sourceFileName: file.filename || '',
                        sourcePage: pageNo,
                        pageIndex: pageNo,
                        sourcePageImage: imageUrl
                    },
                    warnings: [
                        ...(question.warnings || []),
                        '本题由整页视觉识别生成，请核对题型、题干和 LaTeX 公式。'
                    ]
                };
                if (!file.convertedFromDocx) return candidate;
                return ports.projectDocxVisionCandidate({
                    candidate,
                    source: {
                        sourceId: file.sourceDocxFileId,
                        format: 'docx',
                        filename: file.sourceDocxFileName || '',
                        mimeType: file.sourceDocxMimeType ||
                            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                        sourceOrder: Number.isInteger(file.sourceOrder)
                            ? file.sourceOrder : 0
                    },
                    engine: model,
                    page: pageNo,
                    blockIds: question.sourceTrace?.blockIds || [
                        `page:${pageNo}:candidate:${index + 1}`
                    ],
                    controlledWriteDecision: strictProtocol
                });
            });
        };

        return async ({
            file,
            imageUrl,
            pageNo = 1,
            expectedQuestionCount = 0,
            repairInfo = '',
            signal
        } = {}) => {
            if (!file || !imageUrl) {
                const error = new TypeError(
                    'Strict question source and page image are required.'
                );
                error.code = 'QWEN_VISION_SOURCE_INVALID';
                throw error;
            }
            let acceptedItems = [];
            let acceptedPayload = null;
            let rejectedCount = 0;
            let lastPayload = null;
            const result = await ports.requestText({
                task: 'strict-vision',
                prompt: buildStrictQuestionPrompt({
                    expectedQuestionCount,
                    repairInfo
                }),
                imageUrl,
                imageOptions: {
                    min_pixels: 3072,
                    max_pixels: 30720000,
                    enable_rotate: true
                },
                mode: 'accurate',
                timeoutMs: 120000,
                label: 'Qwen strict page recognition',
                signal,
                validateText: (rawText, identity) => {
                    const payload = ports.parseStrictQuestionPayload(rawText);
                    lastPayload = payload;
                    if (!payload?.ok) {
                        rejectedCount += 1;
                        return false;
                    }
                    const items = projectItems({
                        file,
                        pageNo,
                        imageUrl,
                        rawText,
                        payload,
                        model: identity.model
                    });
                    if (!items.length) return false;
                    acceptedItems = items;
                    acceptedPayload = payload;
                    return true;
                }
            });

            if (!acceptedPayload || !acceptedItems.length) {
                const error = new Error('Strict visual protocol rejected.');
                error.code = lastPayload?.reason ||
                    'QWEN_STRICT_PROTOCOL_REJECTED';
                throw error;
            }
            Object.defineProperty(acceptedItems, '__strictPageDiagnostics', {
                configurable: true,
                enumerable: false,
                value: { protocolRejectedCount: rejectedCount }
            });
            ports.logDiagnostic('strict-page-recognition', {
                filename: file.filename || '',
                fileType: file.fileType || '',
                roles: ports.getRoles(file),
                pageNo,
                model: result.model,
                ok: true,
                parseMethod: acceptedPayload.method || '',
                processedQuestionCount: acceptedItems.length,
                questionNumbers: acceptedItems.map(item =>
                    item.questionNumber || item.question || item.no || ''
                )
            });
            return acceptedItems;
        };
    };

    const createDocumentOcrSource = (ports = {}) => {
        requiredFunctions(ports, [
            'ocrText',
            'chatText',
            'cleanText',
            'isFatalError'
        ]);

        const warn = typeof ports.warn === 'function'
            ? ports.warn
            : () => {};
        const isCancellation = error => (
            error?.name === 'AbortError' ||
            error?.code === 'OCR_REQUEST_CANCELLED'
        );
        const rethrowIfFatal = error => {
            if (isCancellation(error) || ports.isFatalError(error)) {
                throw error;
            }
        };

        const callTask = async (
            imageUrl,
            task = 'document_parsing',
            signal
        ) => {
            if (!imageUrl) return '';
            const result = await ports.ocrText({
                imageUrl,
                ocrTask: task,
                timeoutMs: 90000,
                signal
            });
            return result.text;
        };

        const recognizeDocumentText = async (imageUrl, signal) => {
            const tasks = ['document_parsing', 'advanced_recognition'];
            let lastError = null;
            for (const task of tasks) {
                try {
                    const text = await callTask(imageUrl, task, signal);
                    if (text && text.length > 8) return text;
                } catch (error) {
                    lastError = error;
                    rethrowIfFatal(error);
                    warn('QWEN_DOCUMENT_OCR_TASK_FAILED');
                }
            }
            throw lastError || Object.assign(
                new Error('OCR document recognition failed.'),
                { code: 'QWEN_DOCUMENT_OCR_FAILED' }
            );
        };

        const recognizePageMarkdown = async (imageUrl, signal) => {
            if (!imageUrl) return '';
            const prompt = `
你是高中数学试卷 OCR 助手。请把图片中的内容转成 Markdown 文本。

要求：
1. 按阅读顺序输出。
2. 数学公式必须尽量用 LaTeX，行内公式用 $...$，显示公式用 $$...$$。
3. 选择题选项必须保留 A. B. C. D. 标签。
4. 图形、表格、题图如果无法识别，写成 [题图]，不要写图片 id。
5. 不要解释，不要总结，只输出 OCR Markdown。
`;
            try {
                const result = await ports.chatText({
                    task: 'structured-ocr',
                    prompt,
                    imageUrl,
                    timeoutMs: 90000,
                    label: 'Qwen OCR Markdown request',
                    signal
                });
                return ports.cleanText(result.text);
            } catch (error) {
                rethrowIfFatal(error);
                warn('QWEN_MARKDOWN_OCR_PRIMARY_FAILED');
            }
            try {
                return ports.cleanText(
                    await callTask(imageUrl, 'document_parsing', signal)
                );
            } catch (error) {
                rethrowIfFatal(error);
                warn('QWEN_MARKDOWN_OCR_FALLBACK_FAILED');
                return '';
            }
        };

        const recognizeFormulaText = async (imageUrl, signal) => {
            try {
                return await callTask(imageUrl, 'formula_recognition', signal);
            } catch (error) {
                rethrowIfFatal(error);
                warn('QWEN_FORMULA_OCR_FAILED');
                return '';
            }
        };

        const recognizeManualQuestion = async (imageUrl, signal) => {
            const result = await ports.chatText({
                task: 'structured-ocr',
                prompt: '请精准识别图中数学题。要求：中文文字和标点自然排版，行内短小公式或字母必须使用单 $ 包围，只有独立占行的大型公式才使用 $$ 包围。如果包含选项 A、B、C、D，请独立换行展示。不要将整道题打包进一个大环境中。',
                imageUrl,
                timeoutMs: 90000,
                label: 'Qwen manual question OCR request',
                signal
            });
            if (!result.text) {
                const error = new Error('OCR response was empty.');
                error.code = 'QWEN_OCR_EMPTY';
                throw error;
            }
            return result.text;
        };

        return Object.freeze({
            callTask,
            recognizeDocumentText,
            recognizePageMarkdown,
            recognizeFormulaText,
            recognizeManualQuestion
        });
    };

    return Object.freeze({
        buildStrictQuestionPrompt,
        createProductionOcrRuntime,
        createStrictQuestionPageRecognizer,
        createDocumentOcrSource
    });
});
