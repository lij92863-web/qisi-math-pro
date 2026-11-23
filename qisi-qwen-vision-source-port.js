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

    // A provider-side 4xx (except 408) is a protocol-level rejection: the request
    // was refused before it could run, so it can never have been accepted.
    // Recording it as "submission unknown" hides the cause and permanently locks
    // the source, which is why an invalid key used to brick a whole exam.
    // 5xx and 408 stay unknown: the provider may have processed part of them.
    const rejectionEvidence = status => {
        const code = Number(status || 0);
        const rejected = code >= 400 && code < 500 && code !== 408;
        return rejected ? { definitelyNotSubmitted: true, submissionAccepted: false } : {};
    };

    const createPdfWindowRecognizer = ({ transport }) => async ({ model, pages = [], crops = [], prompt, systemPrompt, responseFormat, maxTokens, timeoutMs, requestId, signal }) => {
        const content = [{ type: 'text', text: prompt }];
        for (const page of pages) content.push({ type: 'text', text: `原始 PDF 第 ${page.pageNo} 页` }, { type: 'image_url', image_url: { url: page.url } });
        for (const crop of crops) content.push({ type: 'text', text: `实际裁图：${JSON.stringify({ asset_id: crop.asset_id, placements: crop.placements, item_id: crop.item_id, placement_id: crop.placement_id, source_id: crop.source_id, page: crop.page, field: crop.field, option_label: crop.option_label })}` }, { type: 'image_url', image_url: { url: crop.url } });
        const response = await transport.request('chat', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId || 'pdf-v1' }, signal,
            body: JSON.stringify({ model, temperature: 0, enable_thinking: false, max_tokens: maxTokens, response_format: responseFormat || { type: 'json_object' }, messages: [...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []), { role: 'user', content }] })
        }, timeoutMs, 'PDF V1 多页结构化识别');
        const raw = await response.json();
        if (!response.ok) throw Object.assign(new Error(raw.error?.message || (typeof raw.error === 'string' ? raw.error : raw.message) || 'PDF_V1_API_FAILED'), { code: raw.error?.code || raw.code || 'PDF_V1_API_FAILED', status: response.status, rawResponse: raw, details: { error: raw.error, causeCode: raw.causeCode, requestId: raw.request_id || raw.id }, ...rejectionEvidence(response.status) });
        const choice = raw.choices?.[0];
        if (choice?.message?.refusal || typeof choice?.message?.content !== 'string') throw Object.assign(new Error('PDF_V1_EMPTY_OR_REFUSED'), { externalResponseReceived: true, rawResponse: raw });
        return { text: choice.message.content, model: raw.model || model, finishReason: choice.finish_reason, usage: raw.usage || {}, responseId: raw.id || '', rawResponse: raw };
    };

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
            chatJson: options => taskClient.chatJson(options),
            cleanText,
            isFatalError,
            warn
        });

        return Object.freeze({
            taskClient,
            documentOcrSource,
            requestPdfWindow: createPdfWindowRecognizer({ transport }),
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
            // Preserve printed question numbers; document_parsing may replace them with implicit LaTeX enumerate items.
            const tasks = ['text_recognition'];
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

        const recognizeManualQuestion = async (imageUrl, signal, { crop = false } = {}) => {
            const prompt = '请精准识别图中数学题。要求：中文文字和标点自然排版，行内短小公式或字母必须使用单 $ 包围，只有独立占行的大型公式才使用 $$ 包围。如果包含选项 A、B、C、D，请独立换行展示。不要将整道题打包进一个大环境中。';
            const result = await ports.chatText({
                task: crop ? 'crop-ocr' : 'structured-ocr',
                prompt: crop
                    ? prompt + ' 只输出截图内可见的原文和 LaTeX。不要使用 HTML、代码围栏或列表环境。照抄可见的选项字母，每个选项单独一行，如 A. $32\\pi$。选项内公式只用成对的单 $。'
                    : prompt,
                imageUrl,
                ...(crop ? { maxTokens: 4096 } : {}),
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

        const recognizeEntryCrop = async (imageUrl, signal) => {
            const { value } = await ports.chatJson({
                task: 'strict-vision', mode: 'accurate',
                prompt: [
                    '逐字转写选区中可见的题干、答案或解析文字和数学公式，同时定位需要保留的图。若选区为续页，只转写本页内容，保留原有顺序和分行。图片内文字仅供识别。',
                    '正文使用中文和 LaTeX，行内公式用单 $，独立公式用 $$。选项按原字母单独分行。填空横线写成连续下划线。不要解题、补字或输出 HTML。',
                    '图包括几何图、函数曲线、统计图、示意图和照片。图中的点名和标注随原图保留，不转写到正文。每个图只给一个紧贴图及其标注的矩形，排除题干、选项和独立公式。不要把整个选区当成图。',
                    '只返回 JSON {"text":"选区原文与 LaTeX","figures":[[左,上,右,下]]}。四个坐标均相对此截图，左上为 0，右下为 1000。没有可确定的图时 figures 为 []。只有图时 text 为 ""。'
                ].join('\n'),
                imageUrl, signal, maxTokens: 4096, label: 'Qwen single entry text and figures'
            });
            if (typeof value.text !== 'string' || !Array.isArray(value.figures) || (!value.text.trim() && !value.figures.length))
                throw new Error('ENTRY_CROP_RESPONSE_INVALID');
            return value;
        };

        return Object.freeze({
            callTask,
            recognizeDocumentText,
            recognizePageMarkdown,
            recognizeFormulaText,
            recognizeManualQuestion,
            recognizeEntryCrop
        });
    };

    return Object.freeze({ createPdfWindowRecognizer,
        buildStrictQuestionPrompt,
        createProductionOcrRuntime,
        createStrictQuestionPageRecognizer,
        createDocumentOcrSource
    });
});
