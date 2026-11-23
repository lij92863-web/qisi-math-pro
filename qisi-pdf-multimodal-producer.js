(function (root, factory) {
    const api = factory(root);
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    root.Qisi = root.Qisi || {};
    root.Qisi.PdfMultimodalProducer = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';
    const DEFAULT_CONFIG = Object.freeze({ window_size: 5, overlap: 2, model: 'qwen3-vl-plus', renderScale: 2, cropScale: 3, jpegQuality: 0.94, maxTokens: 16384, timeoutMs: 180000, retryCount: 1 });
    function windows(pages, config = DEFAULT_CONFIG) {
        const { window_size: size, overlap } = config;
        if (!Number.isInteger(size) || size < 1 || !Number.isInteger(overlap) || overlap < 0 || overlap >= size) throw new TypeError('PDF_V1_WINDOW_CONFIG_INVALID');
        const result = [];
        for (let start = 0; start < pages.length; start += size - overlap) {
            result.push(pages.slice(start, start + size));
            if (start + size >= pages.length) break;
        }
        return result;
    }
    function prompt(roles, questionNumbers) {
        return `忠实转写高中数学 PDF。你负责直接理解题目、选项、跨页、答案、解析和图的归属；禁止解题、推导、补齐、改写公式或编造未见内容。输入每张图带原始页号，不得使用图序号代替页号。
本文件角色=${roles.join(',')}。question=题目，answer=答案，solution=解析，full=题目和答案解析均可。只输出角色允许的数组。${questionNumbers.length ? '已见题目编号仅供 exact key 对照：' + questionNumbers.join('、') + '；未出现的编号保留原号，不顺移。' : ''}
题号只放 question_no，题干不要重复题号；选项标签只放 label，text 不重复标签。不同窗口转写同一原文时不要改写措辞。
特别区分原卷题目部分和答案解析部分：解析里重复引用的题干不能再次输出到 questions；questions 只来自原卷出题部分。答案只从明确给出的答案或解答文本转写，禁止根据题目自行求解。仅有题目的页面 answers/solutions 必须为空。答案解析段中题号承接上页且本窗口看不见该题号时，不猜编号，warnings 提醒。
窗口可能从上一题中间开始或结束在下一题中间。只在看见明确原题号时输出该题完整语义单元；看不到前文/后文则 partial，不要假装 complete，不单独输出 C/D 为新题。不明确归属的段落不猜题号，在 warnings 说明。答案与解析按其自身明确题号分别输出，不按数组位置匹配。题号原样字符串；题型按原卷章节，不能把几何题中的 A/B/C 点名当选项。
数学用原文忠实 LaTeX，行内 $...$，独立 $$...$$，保留指数、上下标、集合括号、分段、正负号和公式边界。JSON 内反斜杠正确双转义。不要重算结果。题目数组禁止混入答案解析。没有答案或解析返回相应空数组；不要用“略”“待补充”等占位替代原文。长解析忠实抄录所有步骤，不摘要。
转义示例：JSON 文本 {"stem":"$\\\\frac{x}{2}$"} 解码后的公式是单个反斜杠的 frac 命令。不要输出四个反斜杠让解码内容变成两个反斜杠。段落换行使用 JSON 换行转义，不能在解码后留下字面反斜杠 n。只有合法二维数组用 LaTeX array，禁止 tabular（浏览器数学渲染不支持）；表格可以忠实纯文本逐行保留。
真正图像（几何、函数、统计图）使用 figures。普通数学公式直接 LaTeX，不当图片。每个图是 {"page":原页号,"bbox":[x0,y0,x1,y1],"belongs_to":"stem/option:A/answer/solution"}。bbox 左上原点、整页 0–1000，包含图中全部点名/坐标/箭头，排除周围正文。多选项图分别标 option:A 等。你不生成图，由本地裁原 PDF 像素。带图的选项 text 可保留图中题意；仅图选项 text="见图"。不要自己写 IMAGE token。
只输出严格 JSON object，无代码块、无额外解释：
{"questions":[{"question_no":"1","type":"single/multi/fill/long/proof/unknown","stem":"原题干","options":[{"label":"A","text":"原选项"}],"figures":[],"source_pages":[1],"status":"complete/partial/unreadable","warnings":[]}],"answers":[{"question_no":"1","answer":"原答案","figures":[],"source_pages":[1],"status":"complete/partial/unreadable","warnings":[]}],"solutions":[{"question_no":"1","solution":"原解析全步骤","figures":[],"source_pages":[1],"status":"complete/partial/unreadable","warnings":[]}],"warnings":[]}
示例斜线分隔表示枚举，实际字段只能取一种。未见类别用 []。source_pages 只填本窗口确实见到的相关原页号。部分正文/选项/解析缺失或不可读必须标 partial/unreadable，模型不自报概率。空白页/页眉/目录不造题，窗口没可归属单元时 warnings 如实说明。`;
    }
    function createProducer(ports, inputConfig = {}) {
        for (const name of ['renderPages', 'renderRegion', 'recognizeWindow', 'getRoles']) if (typeof ports?.[name] !== 'function') throw new TypeError('PDF_V1_PORT_REQUIRED:' + name);
        const contract = ports.contract || root.Qisi.PdfMultimodalContract;
        const identity = ports.identityContract || root.Qisi.DocxProducerIdentityContract;
        const config = Object.freeze({ ...DEFAULT_CONFIG, ...inputConfig });
        if (config.model !== DEFAULT_CONFIG.model || !Number.isInteger(config.retryCount) || config.retryCount < 0 || config.retryCount > 1) throw new TypeError('PDF_V1_MODEL_OR_RETRY_INVALID');
        return async function run(context, signal) {
            const proposals = [], errors = [], warnings = [], sourcePages = new Map();
            const files = [...context.sources, ...(context.supplementalSources || [])].filter((f, i, all) => all.findIndex(x => x.id === f.id) === i);
            const evidence = files.flatMap(file => file.pdfV1Evidence?.windows || []);
            const parseWindow = (result, pages, roles, cached = false) => {
                if (!result.text || (cached ? result.finishReason !== 'stop' : result.finishReason && result.finishReason !== 'stop')) throw Object.assign(new Error('PDF_V1_RESPONSE_INCOMPLETE'), { code: 'PDF_V1_RESPONSE_INCOMPLETE' });
                return contract.parseResponse(result.text, { pages, roles });
            };
            const questionSource = file => ports.getRoles(file).some(role => ['question', 'full'].includes(role));
            files.sort((left, right) => Number(questionSource(right)) - Number(questionSource(left)));
            const fileMap = new Map(files.map(f => [f.id, f]));
            let halted = false;
            const assertActive = () => { if (signal?.aborted) throw Object.assign(new Error('PDF_V1_CANCELLED'), { name: 'AbortError' }); };
            for (const file of files) {
                assertActive();
                if (String(file.fileType || '').toLowerCase() !== 'pdf' || file.convertedFromDocx) throw new Error('PDF_V1_SOURCE_NOT_PDF');
                const roles = ports.getRoles(file);
                const source = { sourceId: file.id, format: 'pdf', filename: file.filename, mimeType: 'application/pdf', sourceOrder: files.indexOf(file) };
                if (halted) {
                    errors.push({ sourceId: file.id, filename: file.filename, pages: [], error: 'API_FATAL_STOP: 本来源尚未识别' });
                    warnings.push(`${file.filename} 尚未识别：此前 API 致命错误已停止本任务后续请求，请查看原 PDF。`);
                    continue;
                }
                const pages = await ports.renderPages(file, { scale: config.renderScale, jpegQuality: config.jpegQuality, sequential: true, requireAllPages: true, suppressCostEstimate: true });
                sourcePages.set(file.id, pages);
                const batches = windows(pages, config);
                for (const [index, pageWindow] of batches.entries()) {
                    if (halted) break;
                    assertActive();
                    const pageNos = pageWindow.map(p => p.pageNo);
                    const requestId = `${context.batchId}:${file.id}:${pageNos.join('-')}:v1`;
                    context.reportStage?.({ stage: 'pdf-v1-window-start', engine: config.model, counts: { window: index + 1, totalWindows: batches.length }, pages: pageNos });
                    let parsed = null, responseModel = config.model;
                    const known = [...new Set(proposals.filter(p => p.field === 'question').map(p => p.item.question_no))];
                    const instruction = prompt(roles, known);
                    const cacheBytes = new TextEncoder().encode(JSON.stringify({ model: config.model, prompt: instruction, maxTokens: config.maxTokens, pages: pageWindow.map(p => [p.pageNo, p.url]) }));
                    const cacheKey = Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256', cacheBytes))).map(n => n.toString(16).padStart(2, '0')).join('');
                    const cached = file.pdfV1Evidence?.protocol === contract.PROTOCOL && file.pdfV1Evidence.windows?.findLast(w => w.sourceId === file.id && w.cacheKey === cacheKey && typeof w.text === 'string');
                    if (cached) {
                        const started = Date.now();
                        try {
                            parsed = parseWindow(cached, pageNos, roles, true);
                            responseModel = cached.model || config.model;
                            evidence[evidence.indexOf(cached)] = { ...cached, cached: true, requestId, reusedFromRequestId: cached.reusedFromRequestId || cached.requestId, cacheValidationElapsedMs: Date.now() - started };
                        } catch (error) {
                            evidence.push({ requestId, cacheKey, sourceId: file.id, pages: pageNos, cached: true, error: error.code || error.message, details: error.details });
                        }
                    }
                    for (let attempt = 0; !parsed && attempt <= config.retryCount; attempt += 1) {
                        assertActive();
                        const started = Date.now();
                        try {
                            const result = await ports.recognizeWindow({ model: config.model, pages: pageWindow, prompt: instruction, maxTokens: config.maxTokens, timeoutMs: config.timeoutMs, requestId, signal });
                            const event = { ...result, requestId, cacheKey, attempt, sourceId: file.id, pages: pageNos, elapsedMs: Date.now() - started };
                            evidence.push(event);
                            parsed = parseWindow(result, pageNos, roles);
                            responseModel = result.model || config.model;
                            break;
                        } catch (error) {
                            if (signal?.aborted || error?.name === 'AbortError') throw error;
                            const fatal = [400, 401, 403, 402].includes(error.status);
                            evidence.push({ requestId, attempt, sourceId: file.id, pages: pageNos, elapsedMs: Date.now() - started, error: error.code || error.message, details: error.details });
                            if (attempt === config.retryCount || fatal) {
                                halted = fatal;
                                const failure = { requestId, sourceId: file.id, filename: file.filename, pages: fatal ? [...new Set(batches.slice(index).flat().map(p => p.pageNo))] : pageNos, error: error.message, code: error.code, details: error.details };
                                errors.push(failure);
                                warnings.push(`${file.filename} 第 ${failure.pages.join('、')} 页${fatal ? '因 API 致命错误未完成，后续请求已停止' : '窗口失败'}：${failure.error}，请对照原页补录缺失题目`);
                                break;
                            }
                        }
                    }
                    if (parsed) {
                        for (const [stream, field] of [['questions', 'question'], ['answers', 'answer'], ['solutions', 'solution']]) {
                            for (const item of parsed[stream]) proposals.push({ field, item, source, model: responseModel, evidence: [{ requestId, pages: item.source_pages, sourceId: file.id }] });
                        }
                        warnings.push(...(parsed.warnings || []).map(w => `${file.filename} 第 ${pageNos.join('、')} 页：${w}`));
                    }
                }
            }
            const groups = contract.groupProposals(proposals, context.batchId);
            const drafts = [], draftImages = [], unmatched = [];
            let imageSerial = 0;
            for (const group of groups) {
                if (!group.question.length) { unmatched.push({ questionNumber: group.no, reason: '没有同号题目，支持内容未挂接', evidence: group }); continue; }
                for (const field of ['question', 'answer', 'solution']) for (const variant of group[field]) {
                    variant.images = []; variant.cropErrors = [];
                    for (const figure of variant.item.figures) {
                        assertActive();
                        if (figure.invalid) continue;
                        try {
                            const crop = await ports.renderRegion(fileMap.get(variant.source.sourceId), { pageNo: figure.page, bbox: figure.bbox, scale: config.cropScale });
                            if (!crop.url?.startsWith('data:image/')) throw new Error('PDF_V1_IMAGE_BYTES_MISSING');
                            variant.images.push({ id: `${context.batchId}:pdf-v1-image:${++imageSerial}`, filename: `${variant.source.filename} 第${figure.page}页 ${figure.belongs_to}`, url: crop.url,
                                source: 'pdf-layout-figure-crop', sourceFileId: variant.source.sourceId, sourceFileName: variant.source.filename, sourcePage: figure.page,
                                bbox: figure.bbox, position: figure.belongs_to, width: crop.width, height: crop.height, status: 'bound', protocol: contract.PROTOCOL });
                        } catch (error) { variant.cropErrors.push({ figure, error: error.message }); }
                    }
                }
                const draft = contract.canonicalDraft(group, { batchId: context.batchId, now: Date.now(), identityContract: identity, windowErrors: errors });
                for (const problem of contract.mathProblems(draft, ports.renderMath)) {
                    Object.assign(draft.fieldProvenance[problem.field], { kind: 'rejected', status: 'rejected', controlledWriteAccepted: false });
                    draft.warnings.push(problem.message);
                }
                const refs = new Set();
                for (const field of ['question', 'answer', 'solution']) for (const variant of group[field]) for (const ref of variant.evidence) for (const page of ref.pages) {
                    const key = JSON.stringify([ref.sourceId, page]);
                    if (refs.has(key)) continue;
                    refs.add(key);
                    const rendered = sourcePages.get(ref.sourceId).find(p => p.pageNo === page);
                    draft.pdfV1.sourcePageImages.push({ pageNo: page, sourceFileId: ref.sourceId, filename: fileMap.get(ref.sourceId).filename, url: rendered.url });
                }
                // Failed windows remain visible on every draft; an absent question cannot flag itself.
                draft.warnings.push(...errors.map(e => `${e.filename} 第${e.pages.join('、')}页窗口失败，可能漏题，请查看任务来源。`));
                draft.pdfV1.responses = evidence.filter(e => group.question.concat(group.answer, group.solution).some(v => v.evidence.some(ref => ref.requestId === e.requestId)));
                draft.sourcePageImage = draft.pdfV1.sourcePageImages[0]?.url || '';
                draft.sourceTrace.sourcePageImage = draft.sourcePageImage;
                drafts.push(draft); draftImages.push(...draft.images);
            }
            if (!drafts.length) throw Object.assign(new Error('没有可建立的题目草稿，请查看 PDF 窗口错误或原卷编号。'), { code: 'PDF_V1_NO_QUESTIONS', details: { errors, warnings, evidence, unmatched } });
            contract.validateCanonical(drafts, context.batchId, identity);
            context.reportStage?.({ stage: 'pdf-v1-canonical-produced', engine: config.model, counts: { drafts: drafts.length, windowErrors: errors.length } });
            return { pdfProtocol: contract.PROTOCOL, drafts, draftImages, warnings, unmatched, windowErrors: errors, evidence,
                safePartialCandidates: drafts.map(draft => ({ isSafePartial: true, isComplete: false, draft })) };
        };
    }
    return Object.freeze({ DEFAULT_CONFIG, windows, prompt, createProducer });
});
