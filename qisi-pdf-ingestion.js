(function (root, factory) {
    const api = factory(root);
    root.Qisi = root.Qisi || {};
    root.Qisi.PdfIngestion = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';
    const pageCache = new Map();
    const VISUAL_SCHEMA_VERSION = 'pdf-question-region-v3';
    const fileFatalVisualError = code => ['API_AUTH_ERROR', 'LOCAL_SERVER_UNREACHABLE',
        'UPSTREAM_UNREACHABLE', 'DASHSCOPE_NOT_CONFIGURED'].includes(code);
    const REVIEW_LABELS = {
        'unmapped-glyphs': '公式字符无法从 PDF 文本层可靠映射',
        'contract-gap': '题号序列有缺口',
        'cross-page-visual-block': '题目跨页，当前区域不足以可靠转录',
        'field-evidence-conflict': 'PDF 文本与视觉识别内容不一致',
        'missing-visual-question': '视觉回复缺少此题',
        MALFORMED_MODEL_RESPONSE: '模型回复格式无效',
        AI_PROXY_FETCH_FAILED: '本地视觉服务请求失败',
        API_AUTH_ERROR: '视觉服务认证失败',
        LOCAL_SERVER_UNREACHABLE: '本地服务不可达',
        UPSTREAM_UNREACHABLE: 'DashScope 上游不可达，请检查网络或代理路由',
        VISUAL_CALL_BUDGET_EXCEEDED: '视觉调用次数已达本次上限',
        VISUAL_REVIEW_REQUIRED: '需要人工核对原页'
    };
    const reviewLabel = code => code ? `${REVIEW_LABELS[code] || '需要人工核对'}（${code}）` : '';
    const key = item => String(item?.questionNumber || item?.question || '');
    // A file's numbering is not all-or-nothing. What the page's own text layer proved stays usable, a hole
    // is reported as a missing number, and a duplicate / backward / unreadable anchor is recorded on its
    // own instead of taking away every identity in the file (owner's rule, 2026-09-17: 已被结构证明的
    // 题号继续可用；缺失题号形成 gap；不因一个 anchor 缺失让整份 PDF 失去全部可信定位). Nothing is
    // guessed - a gap stays a gap - and every accepted number is still the number the text itself carried.
    const contract = anchors => {
        const numbers = anchors.map(key);
        const accepted = [];
        const conflicts = [];
        const segments = [];
        const seen = new Set();
        let previous = 0;

        for (const raw of numbers) {
            const number = String(raw ?? '');
            const value = Number(number);
            if (!/^[1-9]\d{0,2}$/.test(number)) { conflicts.push({ number, reason: 'unknown-question-number' }); continue; }
            if (seen.has(number)) { conflicts.push({ number, reason: 'duplicate-question-number' }); continue; }
            if (accepted.length && value <= previous) { conflicts.push({ number, reason: 'question-number-not-increasing' }); continue; }
            seen.add(number);
            accepted.push(number);
            previous = value;
            const last = segments[segments.length - 1];
            if (last && Number(last[last.length - 1]) === value - 1) last.push(number);
            else segments.push([number]);
        }

        const missing = [];
        if (accepted.length > 1) {
            for (let value = Number(accepted[0]) + 1; value < Number(accepted[accepted.length - 1]); value += 1) {
                if (!seen.has(String(value))) missing.push(String(value));
            }
        }

        return {
            authoritative: accepted.length > 0,
            questionNumbers: accepted,
            segments,
            missing,
            conflicts,
            evidence: 'pdf-text-geometry',
            anchors
        };
    };
    const acceptVisual = (items, expected, supportOnly = false) => {
        if (!Array.isArray(items)) return { accepted: [], reason: 'invalid-visual-items' };
        const allowed = new Set(expected.map(String));
        const seen = new Set();
        let previous = 0;
        for (const item of items || []) {
            const n = key(item);
            if (!allowed.has(n) || seen.has(n) || Number(n) <= previous) {
                return { accepted: [], reason: 'unreliable-visual-question-sequence' };
            }
            seen.add(n); previous = Number(n);
        }
        const accepted = items.filter(item => supportOnly || (typeof item.stem === 'string' && item.stem.trim()));
        return { accepted, missing: expected.filter(n => !accepted.some(item => key(item) === String(n))) };
    };
    const closeRenderScope = async scope => {
        for (const { canvas } of scope.rasters.values()) canvas.width = canvas.height = 0;
        scope.rasters.clear();
        if (scope.pdf) await scope.pdf.destroy();
        else if (scope.loading) await scope.loading.destroy();
        scope.pdf = scope.loading = null;
    };
    // A scope belongs to one ingest. The first crop opens the document; later crops reuse its page
    // raster. The standalone export owns and closes a temporary scope for callers outside ingest.
    const renderPage = async (file, pageNo, trace, region, sharedScope) => {
        const scope = sharedScope || { rasters: new Map() };
        const bounded = root.Qisi.IngestionContext.withTimeout;
        try {
            if (!scope.pdf) {
                const bytes = await bounded(async () => new Uint8Array(await (await root.fetch(file.uploadPath)).arrayBuffer()),
                    15000, 'PDF_READ_TIMEOUT');
                scope.loading = root.pdfjsLib.getDocument({ data: bytes });
                scope.pdf = await bounded(() => scope.loading.promise, 15000, 'PDF_OPEN_TIMEOUT', () => scope.loading.destroy());
            }
            let raster = scope.rasters.get(pageNo);
            if (!raster) {
                const page = await bounded(() => scope.pdf.getPage(pageNo), 15000, 'PDF_PAGE_TIMEOUT');
                const base = page.getViewport({ scale: 1 });
                const scale = Math.min(2, 2200 / Math.max(base.width, base.height),
                    Math.sqrt(4000000 / (base.width * base.height)));
                const viewport = page.getViewport({ scale });
                const canvas = root.document.createElement('canvas');
                canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
                try {
                    const task = page.render({ canvasContext: canvas.getContext('2d'), viewport });
                    await trace.measure(`render:${pageNo}`, () => bounded(() => task.promise,
                        20000, 'PDF_RENDER_TIMEOUT', () => task.cancel()));
                    raster = { canvas, scale };
                    scope.rasters.set(pageNo, raster);
                } catch (error) { canvas.width = canvas.height = 0; throw error; }
                finally { page.cleanup?.(); }
            }
            const { canvas, scale } = raster;
            const whole = () => ({ url: canvas.toDataURL('image/jpeg', 0.88), width: canvas.width, height: canvas.height });
            if (!Array.isArray(region) || region.length !== 4) return whole();
            const left = Math.max(0, Math.min(region[0], region[2]) * scale);
            const top = Math.max(0, Math.min(region[1], region[3]) * scale);
            const right = Math.min(canvas.width, Math.max(region[0], region[2]) * scale);
            const bottom = Math.min(canvas.height, Math.max(region[1], region[3]) * scale);
            const width = Math.ceil(right - left);
            const height = Math.ceil(bottom - top);
            if (width < 16 || height < 16) return whole();
            const cropped = root.document.createElement('canvas');
            cropped.width = width; cropped.height = height;
            try {
                cropped.getContext('2d').drawImage(canvas, left, top, width, height, 0, 0, width, height);
                return { url: cropped.toDataURL('image/jpeg', 0.9), width, height, region: [...region] };
            } finally { cropped.width = cropped.height = 0; }
        } finally { if (!sharedScope) await closeRenderScope(scope); }
    };
    // The model writes LaTeX, and LaTeX is full of braces, so a reply that stops in the middle of the
    // array cannot be cut at the last "}" of the text. This walks the reply once, ignoring anything
    // inside a string, and keeps every complete "{...}" item of the questions array. An item that is
    // incomplete or unreadable is simply not read; nothing is invented.
    const CONTROL_CHARACTERS_RE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g;
    // The model answers with LaTeX, and a LaTeX backslash is not a JSON escape: "\left\{", "\frac" and
    // "\sin" are all illegal inside a JSON string, so JSON.parse refuses the whole reply even when every
    // item is complete and correct - that is exactly what the first authorised call returned. The repair
    // doubles only those backslashes (a LaTeX backslash becomes a literal backslash) and leaves a legal
    // escape alone: \\, \", \/ and \uXXXX.
    const repairLatexJsonEscapes = (value = '') => {
        const text = String(value || '');
        let output = '';
        for (let index = 0; index < text.length; index += 1) {
            const character = text[index];
            if (character !== '\\') { output += character; continue; }
            const next = text[index + 1] || '';
            if (next === '\\' || next === '"' || next === '/' || next === 'u') {
                output += `\\${next}`;
                index += 1;
                continue;
            }
            output += '\\\\';
        }
        return output;
    };
    const readVisualQuestionItems = (value = '') => {
        const text = String(value || '');
        const declared = text.search(/"questions"\s*:\s*\[/);
        const from = declared < 0 ? -1 : text.indexOf('[', declared);
        if (from < 0) return [];

        const items = [];
        let depth = 0;
        let itemStart = -1;
        let inString = false;
        let escaped = false;

        for (let index = from; index < text.length; index += 1) {
            const character = text[index];
            if (inString) {
                if (escaped) escaped = false;
                else if (character === '\\') escaped = true;
                else if (character === '"') inString = false;
                continue;
            }
            if (character === '"') { inString = true; continue; }
            if (character === '{') {
                if (!depth) itemStart = index;
                depth += 1;
                continue;
            }
            if (character !== '}') continue;
            depth -= 1;
            if (depth > 0 || itemStart < 0) continue;
            const raw = text.slice(itemStart, index + 1);
            depth = 0;
            itemStart = -1;
            try {
                items.push(JSON.parse(raw));
            } catch (_) {
                try { items.push(JSON.parse(repairLatexJsonEscapes(raw.replace(CONTROL_CHARACTERS_RE, ' ')))); }
                catch (_) { /* an item that cannot be read is not read */ }
            }
        }

        return items.filter(item => item && typeof item === 'object');
    };
    const requestVisual = async (image, expectedNumbers, helpers, regionNumber) => {
        const images = Array.isArray(image) ? image : [image];
        const response = await helpers.request({
            model: helpers.model,
            messages: [{ role: 'user', content: [
                { type: 'text', text: (regionNumber
                    ? '这是第 ' + regionNumber + ' 题所在的图片区域（页面上该题的位置已由程序确定，题号不需要你判断）。'
                        + (images.length > 1 ? '多张图片按页顺序展示同一题的跨页内容。' : '')
                        + '只转录这一题，只返回 JSON {"questions":[{"questionNumber":"' + regionNumber
                        + '","stem":"","options":[],"answer":"","solution":""}]}。'
                    : '逐题转录页面，只返回 JSON {"questions":[{"questionNumber":"1","stem":"","options":[],"answer":"","solution":""}]}。'
                        + '保留公式的 LaTeX 和原有题号。不猜缺失内容。不把详解结论当成显式答案。'
                        + '跨页不完整的题干留空。题号必须来自此页面，文本层已证明的题号为：' + JSON.stringify(expectedNumbers)) },
                ...images.map(item => ({ type: 'image_url', image_url: { url: item.url } }))
            ] }], temperature: 0, max_tokens: 6000
        });
        const json = await response.json();
        if (!response.ok) throw Object.assign(new Error(json?.error?.message || json?.error || `HTTP ${response.status}`),
            { code: response.status === 401 || response.status === 403 ? 'API_AUTH_ERROR' : json?.code || 'API_RESPONSE_ERROR' });
        const content = json?.choices?.[0]?.message?.content;
        // A model answer is prose-shaped: it may be fenced with ```json, it may carry a sentence before or
        // after the JSON, and it may be cut off by the token budget in the middle of the array. Only
        // complete items are ever read, and every number is validated against the page's own text layer
        // afterwards (acceptVisual), so a salvaged prefix can never attach a question to the wrong page.
        const visualQuestions = (() => {
            const text = String(content ?? '');
            const start = text.indexOf('{');
            if (start < 0) return null;

            const bodies = [];
            for (let cut = text.lastIndexOf('}'); cut > start; cut = text.lastIndexOf('}', cut - 1)) {
                bodies.push(text.slice(start, cut + 1));
                if (bodies.length >= 60) break;
            }

            for (const body of bodies) {
                const trimmed = body.replace(/[\s,]+$/, '');
                for (const candidate of [trimmed, `${trimmed}]}`, `${trimmed}]}]}`, `${trimmed}}`]) {
                    for (const form of [candidate, repairLatexJsonEscapes(candidate),
                        candidate.replace(CONTROL_CHARACTERS_RE, ' '),
                        repairLatexJsonEscapes(candidate.replace(CONTROL_CHARACTERS_RE, ' '))]) {
                        try {
                            const parsed = JSON.parse(form);
                            if (Array.isArray(parsed?.questions)) return parsed.questions;
                        } catch (_) { /* the next candidate, or the next item boundary */ }
                    }
                }
            }

            const salvaged = readVisualQuestionItems(text);
            return salvaged.length ? salvaged : null;
        })();
        if (visualQuestions) return visualQuestions;

        // The model's own answer is evidence: when it cannot be read as the requested structure, a
        // bounded head of it travels with the failure, so the review page (and the next round) sees
        // what actually came back instead of only "not a valid question structure".
        throw Object.assign(new Error('视觉服务未返回有效题目结构'), {
            code: 'MALFORMED_MODEL_RESPONSE',
            rawContent: String(content ?? '').slice(0, 1200),
            rawLength: String(content ?? '').length,
            rawTail: String(content ?? '').slice(-300),
            finishReason: json?.choices?.[0]?.finish_reason ?? null
        });
    };
    const gateSupport = (answers, solutions, expectedNumbers, drafts) => {
        const aligned = root.Qisi.PdfSupportAligner.alignPdfSupport({ answerItems: answers,
            solutionItems: solutions, expectedQuestionNumbers: expectedNumbers });
        const controlled = root.Qisi.PdfSupportControlledWrite.buildPdfSupportFieldLevelControlledWrite({
            drafts: drafts.filter(d => key(d)), parserSafeAnswerItems: aligned.safeAnswerItems,
            parserSafeSolutionItems: aligned.safeSolutionItems, parserFusedQuestionNumbers: aligned.fusedQuestionNumbers
        });
        return { answers: controlled.effectiveAnswerItems, solutions: controlled.effectiveSolutionItems,
            mode: aligned.mode, fusedQuestionNumbers: aligned.fusedQuestionNumbers, decisions: controlled.fieldDecisions,
            warnings: controlled.warnings };
    };
    const mergeVisualQuestion = (existing, visual, sectionType = '') => {
        const merged = existing ? { ...existing } : { ...visual, type: sectionType };
        const conflicts = [];
        merged.fieldEvidence = { ...(existing?.fieldEvidence || {}) };
        for (const field of ['stem', 'options']) {
            const oldValue = existing?.[field];
            const newValue = visual[field];
            const oldPresent = Array.isArray(oldValue) ? oldValue.length > 0 : !!String(oldValue || '').trim();
            const newPresent = Array.isArray(newValue) ? newValue.length > 0 : !!String(newValue || '').trim();
            const evidence = existing
                ? { ...(existing.fieldEvidence?.[field] || {}), rawValue: oldValue,
                    vision: visual.fieldEvidence?.[field] }
                : visual.fieldEvidence?.[field];
            if (!existing || !oldPresent) {
                if (newPresent) merged[field] = newValue;
            } else if (JSON.stringify(oldValue) !== JSON.stringify(newValue) && newPresent) {
                const marker = '[[PDF_UNMAPPED]]';
                const parts = field === 'stem' && typeof oldValue === 'string' ? oldValue.split(marker) : [];
                let gapFilled = parts.length > 1 && typeof newValue === 'string'
                    && newValue.startsWith(parts[0]) && newValue.endsWith(parts.at(-1));
                let cursor = parts[0]?.length || 0;
                for (const part of parts.slice(1, -1)) {
                    const at = newValue.indexOf(part, cursor);
                    if (!part || at < 0) { gapFilled = false; break; }
                    cursor = at + part.length;
                }
                if (gapFilled && cursor <= newValue.length - parts.at(-1).length) merged[field] = newValue;
                else { conflicts.push(field); evidence.conflict = true; }
            }
            merged.fieldEvidence[field] = evidence;
        }
        if (existing) {
            merged.type = existing.type;
            merged.sourceTrace = existing.sourceTrace;
            merged.warnings = [...new Set([...(existing.warnings || []), ...(visual.warnings || [])])];
        }
        return { question: merged, conflicts };
    };
    const crossPageNumbers = (pages, role) => {
        const result = new Set();
        for (let i = 1; i < pages.length; i++) {
            const previous = pages[i - 1], next = pages[i];
            if (next.pageNo !== previous.pageNo + 1) continue;
            const last = previous.anchors.filter(a => a.role === role).at(-1);
            const first = next.anchors.find(a => a.role === role);
            if (!last) continue;
            const leading = next.lines.filter(l => l.bbox[1] > next.height * 0.035 && (!first || l.bbox[1] < first.bbox[1] - 2))
                .map(l => l.text).filter(t => !/^\s*[一二三四五六七八九十]+\s*[、．.]/.test(t));
            if (leading.length) result.add(last.questionNumber);
        }
        return result;
    };
    const ingest = async ({ file, questionRole, supportRole, fullRole, expectedNumbers = [], drafts = [], helpers }) => {
        let inspection;
        try { inspection = await root.Qisi.PdfInspection.inspect(file); }
        catch (error) {
            return { questions: [], answers: [], solutions: [], pageImages: [], unmatched: [], timings: [],
                contract: contract([]), inspection: { pages: [], timings: [] },
                withheld: [{ sourceFileId: file.id, reason: 'pdf-inspection-failed', errorCode: error.code || 'PDF_READ_ERROR', message: error.message,
                    reasonDisplay: reviewLabel('pdf-inspection-failed'), errorDisplay: reviewLabel(error.code || 'PDF_READ_ERROR') }] };
        }
        // A separately assigned support file supplies role evidence even when its markers
        // use ordinary decimal punctuation rather than an explicit 【答案】 label.
        if (!questionRole && supportRole) {
            const pages = inspection.pages.map(page => ({ ...page,
                anchors: page.anchors.map(anchor => ({ ...anchor, role: 'support' })) }));
            inspection = { ...inspection, pages, ...root.Qisi.PdfInspection.segment(pages, 'support') };
        }
        const trace = root.Qisi.IngestionContext.createTrace(file.id);
        const anchors = inspection.pages.flatMap(page => page.anchors || []);
        const questionContract = contract(anchors.filter(a => a.role === 'question'));
        const expected = questionRole ? questionContract.questionNumbers : expectedNumbers.map(String);
        const result = { questions: [], answers: [], solutions: [], pageImages: [], withheld: [...inspection.withheld.filter(w => !w.kind)], unmatched: [],
            contract: questionContract, inspection, timings: trace.stages, visualCalls: 0, cacheHits: 0 };
        // A hole in the numbering is shown to the teacher as its own withheld item: the numbers around it
        // keep working, and nobody has to guess what the missing one said.
        if (questionRole) for (const number of questionContract.missing) {
            result.withheld.push({ sourceFileId: file.id, questionNumbers: [number], status: 'withheld',
                reason: 'contract-gap', visualNeeded: false });
        }
        const rawAnswers = [], rawSolutions = [];
        const maxCalls = Number.isFinite(Number(helpers.maxCalls))
            ? Math.max(0, Number(helpers.maxCalls)) : 24;
        const supportContract = contract(anchors.filter(a => a.role === 'support'));
        const crossQuestions = crossPageNumbers(inspection.pages, 'question');
        const crossSupport = crossPageNumbers(inspection.pages, 'support');
        const evidenceFor = (block, source) => ({ source, sourceFileId: file.id, sourceFileName: file.filename,
            sourcePage: block.sourcePages[0], sourcePages: block.sourcePages, regions: block.regions,
            rawBlock: block.rawText || block.text });
        // Where each question actually sits on its page, taken from the block's own line boxes. The vision
        // plan and the review panel show that region instead of the whole page whenever the text layer could
        // prove it; a question without a provable box keeps the whole page.
        const questionRegionByPage = new Map();
        const questionRegionsByNumber = new Map();
        const questionTypeByNumber = new Map();
        const questionBlocksByNumber = new Map();
        const supportRegionsByNumber = new Map();
        const supportBlocksByNumber = new Map();
        for (const block of (inspection.blocks || []).filter(b => b.role === 'question')) {
            questionBlocksByNumber.set(block.questionNumber, block);
            if (block.type) questionTypeByNumber.set(block.questionNumber, block.type);
            for (const region of block.regionByPage || []) {
                questionRegionsByNumber.set(`${region.page}:${block.questionNumber}`, region.bbox);
            }
            for (const region of block.regionByPage || []) {
                const current = questionRegionByPage.get(region.page);
                questionRegionByPage.set(region.page, current
                    ? { page: region.page, bbox: [Math.min(current.bbox[0], region.bbox[0]), Math.min(current.bbox[1], region.bbox[1]),
                        Math.max(current.bbox[2], region.bbox[2]), Math.max(current.bbox[3], region.bbox[3])] }
                    : { page: region.page, bbox: [...region.bbox] });
            }
        }
        for (const block of (inspection.blocks || []).filter(b => b.role === 'support')) {
            supportBlocksByNumber.set(block.questionNumber, block);
            for (const region of block.regionByPage || []) {
                supportRegionsByNumber.set(`${region.page}:${block.questionNumber}`, region.bbox);
            }
        }
        if (questionRole) for (const block of inspection.blocks.filter(b => b.role === 'question')) {
            if (!questionContract.authoritative || !expected.includes(block.questionNumber)) continue;
            const items = helpers.parseQuestions(block.text, file, false);
            if (items.length !== 1 || key(items[0]) !== block.questionNumber) continue;
            result.questions.push({ ...items[0], type: block.type || '', answer: '', solution: '', sourceTrace: evidenceFor(block, 'pdf-text'),
                sourcePage: block.sourcePages[0], sourcePages: block.sourcePages,
                fieldEvidence: { stem: evidenceFor(block, 'pdf-text'), options: evidenceFor(block, 'pdf-text') } });
        }
        // Explicit objective answers can be read even when surrounding formula glyphs cannot.
        // Every other support field remains under the sequence and evidence gates.
        if (supportRole || fullRole) {
            const candidates = [];
            for (const page of inspection.pages) for (const anchor of page.anchors) {
                if (anchor.role !== 'support') continue;
                const match = anchor.rawText.match(/^\s*([1-9]\d{0,2})\s*【\s*答案\s*】\s*([A-D](?:\s*[A-D]){0,3})\s*$/)
                    || anchor.rawText.match(/^\s*([1-9]\d{0,2})\s*[.．、]\s*([A-D](?:\s*[A-D]){0,3})\s*$/);
                if (match) candidates.push({ question: match[1], answer: match[2].replace(/\s/g, ''),
                    sourceFileId: file.id, sourceFileName: file.filename, sourcePage: page.pageNo,
                    fieldEvidence: { answer: { ...anchor, source: 'pdf-text', sourceFileId: file.id } } });
            }
            if (supportContract.authoritative && supportContract.questionNumbers.every(n => expected.includes(n))) {
                rawAnswers.push(...candidates);
            } else result.unmatched.push(...candidates.map(c => ({ ...c, reason: 'unsafe-support-sequence' })));
            if (inspection.pages.every(p => p.kind === 'text')) {
                const parsed = helpers.parseSupport(inspection.pages.map(p => p.text).join('\n'), file);
                for (const field of ['answers', 'solutions']) for (const item of parsed[field] || []) {
                    const target = field === 'answers' ? rawAnswers : rawSolutions;
                    if (supportContract.authoritative && expected.includes(key(item)) && !target.some(i => key(i) === key(item))) target.push(item);
                }
            }
        }
        let transportFailure = null;
        const renderScope = { rasters: new Map() };
        const renderImage = helpers.render || ((source, pageNo, stage, region) =>
            renderPage(source, pageNo, stage, region, renderScope));
        try {
        for (const page of inspection.pages.filter(p => p.kind !== 'text')) {
            const supportOnly = (!questionRole && supportRole) || (fullRole &&
                !page.anchors.some(a => a.role === 'question') && page.anchors.some(a => a.role === 'support'));
            const pageNumbers = (page.anchors || []).filter(a => a.role === (supportOnly ? 'support' : 'question')).map(key);
            const provenRegion = supportOnly ? null : questionRegionByPage.get(page.pageNo)?.bbox;
            const pageRegion = provenRegion && provenRegion.length === 4
                ? provenRegion.map(Number) : [0, 0, page.width, page.height];
            const plan = { sourceFileId: file.id, sourcePage: page.pageNo, questionNumbers: pageNumbers,
                region: pageRegion, reason: page.reason,
                status: 'withheld', visualNeeded: true };
            try {
                const image = await renderImage(file, page.pageNo, trace);
                result.pageImages.push({ sourceFileId: file.id, sourceFileName: file.filename, pageNo: page.pageNo, imageUrl: image.url });
                // No independent number evidence means model output can only be an untrusted proposal.
                const proven = supportOnly ? supportContract.authoritative && pageNumbers.every(n => expected.includes(n)) : questionContract.authoritative;
                if (!proven || !pageNumbers.length || !helpers.request || transportFailure) {
                    result.withheld.push({ ...plan, errorCode: transportFailure || 'VISUAL_REVIEW_REQUIRED' });
                    continue;
                }
                // When every question of this page has its own box, the model gets one question at a time
                // and the number the text layer already proved: attribution stays with the program, and no
                // neighbouring question or footer can reach the request.
                const regionLookup = supportOnly ? supportRegionsByNumber : questionRegionsByNumber;
                const regionItems = pageNumbers
                    .map(number => ({ number, bbox: regionLookup.get(`${page.pageNo}:${number}`) }))
                    .filter(item => Array.isArray(item.bbox) && item.bbox.length === 4);
                if (regionItems.length && regionItems.length === pageNumbers.length) {
                    let regionFailure = '';
                    for (const item of regionItems) {
                        try {
                            const block = (supportOnly ? supportBlocksByNumber : questionBlocksByNumber).get(item.number);
                            const crosses = (supportOnly ? crossSupport : crossQuestions).has(item.number);
                            const regions = crosses
                                ? block?.regionByPage || [] : [{ page: page.pageNo, bbox: item.bbox }];
                            if ((crosses && regions.length < 2)
                                || !regions.length || regions.some((region, index) => !Array.isArray(region.bbox)
                                || region.bbox.length !== 4 || (index && region.page !== regions[index - 1].page + 1))) {
                                result.withheld.push({ ...plan, questionNumbers: [item.number],
                                    reason: 'cross-page-visual-block' });
                                continue;
                            }
                            const crops = [];
                            for (const region of regions) crops.push(await renderImage(file, region.page, trace, region.bbox));
                            const crop = crops[0];
                            const regionBytes = new TextEncoder().encode(crops.map(image => image.url).join('|') + helpers.model + item.number + ':' + VISUAL_SCHEMA_VERSION);
                            const regionHash = Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256', regionBytes))).map(n => n.toString(16).padStart(2, '0')).join('');
                            let regionPending = pageCache.get(regionHash);
                            if (!regionPending) {
                                if (result.visualCalls >= maxCalls) {
                                    result.withheld.push({ ...plan, questionNumbers: [item.number],
                                        errorCode: 'VISUAL_CALL_BUDGET_EXCEEDED' });
                                    continue;
                                }
                                result.visualCalls++;
                                regionPending = trace.measure(`vision:${page.pageNo}:${item.number}`,
                                    () => root.Qisi.IngestionContext.withTimeout(() => requestVisual(crops, [item.number], helpers, item.number), 90000, 'PDF_VISION_TIMEOUT'));
                                pageCache.set(regionHash, regionPending);
                                regionPending.catch(() => pageCache.delete(regionHash));
                                if (pageCache.size > 32) pageCache.delete(pageCache.keys().next().value);
                            } else result.cacheHits++;

                            const raw = await regionPending;
                            const checked = acceptVisual(raw, [item.number], supportOnly);
                            if (checked.reason || !checked.accepted.length) {
                                regionFailure = regionFailure || checked.reason || 'missing-visual-question';
                                result.withheld.push({ ...plan, questionNumbers: [item.number],
                                    reason: checked.reason || 'missing-visual-question', rawEvidence: raw });
                                continue;
                            }

                            const evidence = { source: 'pdf-vision', sourceFileId: file.id, sourcePage: page.pageNo,
                                region: item.bbox, regions, assetHash: regionHash, model: helpers.model };
                            for (const entry of checked.accepted) {
                                const candidate = { ...entry, question: key(entry), sourceFileId: file.id,
                                    sourceFileName: file.filename, sourcePage: page.pageNo, sourcePageImage: crop.url,
                                    sourceTrace: evidence,
                                    fieldEvidence: Object.fromEntries(['stem', 'options', 'answer', 'solution']
                                        .map(field => [field, { ...evidence, rawValue: entry[field] }])),
                                    warnings: ['PDF 视觉转录待人工逐题核对；题号由页面文本层确定。'] };
                                const existing = result.questions.findIndex(question => key(question) === key(entry));
                                const upgraded = { ...candidate, answer: '', solution: '' };
                                if (supportOnly) {
                                    // Same rules as the whole-page support path: a letter answer is never
                                    // reconstructed from a model reading, and a solution is taken as it is.
                                    if (entry.answer && !/^[A-D\s]+$/.test(entry.answer)
                                        && !rawAnswers.some(row => key(row) === key(entry))) rawAnswers.push(candidate);
                                    if (typeof entry.solution === 'string' && entry.solution.trim()) rawSolutions.push(candidate);
                                } else {
                                    const merged = mergeVisualQuestion(result.questions[existing], upgraded,
                                        questionTypeByNumber.get(item.number) || '');
                                    if (existing < 0) result.questions.push(merged.question);
                                    else result.questions[existing] = merged.question;
                                    if (merged.conflicts.length) result.withheld.push({ ...plan,
                                        questionNumbers: [item.number], reason: 'field-evidence-conflict',
                                        fields: merged.conflicts, rawEvidence: { deterministic: result.questions[existing]?.sourceTrace,
                                            vision: entry } });
                                }
                            }
                        } catch (error) {
                            const code = error.code || root.Qisi.Utils.classifyVisualServiceFailure?.(error)?.code || 'TRANSPORT_ERROR';
                            if (fileFatalVisualError(code)) transportFailure = code;
                            regionFailure = code;
                            result.withheld.push({ ...plan, questionNumbers: [item.number], errorCode: code,
                                message: error.message, rawEvidence: error.rawContent ?? null });
                            if (transportFailure) break;
                        }
                    }
                    if (regionFailure && !result.withheld.some(w => w.sourcePage === page.pageNo && w.visualNeeded)) {
                        result.withheld.push({ ...plan, errorCode: regionFailure });
                    }
                    continue;
                }
                const bytes = new TextEncoder().encode(image.url + helpers.model + JSON.stringify(pageNumbers) + ':' + supportOnly + ':' + VISUAL_SCHEMA_VERSION);
                const hash = Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256', bytes))).map(n => n.toString(16).padStart(2, '0')).join('');
                let pending = pageCache.get(hash);
                if (!pending) {
                    if (result.visualCalls >= maxCalls) {
                        result.withheld.push({ ...plan, errorCode: 'VISUAL_CALL_BUDGET_EXCEEDED' });
                        continue;
                    }
                    result.visualCalls++;
                    pending = trace.measure(`vision:${page.pageNo}`, () => root.Qisi.IngestionContext.withTimeout(() => requestVisual(image, pageNumbers, helpers), 90000, 'PDF_VISION_TIMEOUT'));
                    pageCache.set(hash, pending);
                    pending.catch(() => pageCache.delete(hash));
                    if (pageCache.size > 32) pageCache.delete(pageCache.keys().next().value);
                } else result.cacheHits++;
                const raw = await pending;
                const checked = acceptVisual(raw, pageNumbers, supportOnly);
                if (checked.reason) { result.withheld.push({ ...plan, reason: checked.reason, rawEvidence: raw }); continue; }
                for (const item of checked.accepted) {
                    if ((supportOnly ? crossSupport : crossQuestions).has(key(item))) {
                        result.withheld.push({ ...plan, questionNumbers: [key(item)], reason: 'cross-page-visual-block', rawEvidence: item });
                        continue;
                    }
                    const evidence = { source: 'pdf-vision', sourceFileId: file.id, sourcePage: page.pageNo,
                        region: plan.region, assetHash: hash, rawValue: item, model: helpers.model };
                    const candidate = { ...item, question: key(item), sourceFileId: file.id, sourceFileName: file.filename,
                        sourcePage: page.pageNo, sourcePageImage: image.url,
                        sourceTrace: evidence, fieldEvidence: Object.fromEntries(['stem', 'options', 'answer', 'solution'].map(f => [f, { ...evidence, rawValue: item[f] }])),
                        warnings: ['PDF 视觉转录待人工逐题核对；题号已与文本层验证。'] };
                    if (supportOnly) {
                        // Native explicit labels take precedence. A missing native objective answer
                        // must not be reconstructed from a worked solution by a model.
                        if (item.answer && !/^[A-D\s]+$/.test(item.answer) && !rawAnswers.some(a => key(a) === key(item))) rawAnswers.push(candidate);
                        if (typeof item.solution === 'string' && item.solution.trim()) rawSolutions.push(candidate);
                    } else {
                        // The same question may already be there from this page's own text (a "mixed" page
                        // keeps its readable text as a safe partial draft). The transcription carries the
                        // formulas the text could not, so it replaces that text-only version.
                        const existing = result.questions.findIndex(q => key(q) === key(item));
                        const upgraded = { ...candidate, answer: '', solution: '' };
                        const merged = mergeVisualQuestion(result.questions[existing], upgraded,
                            questionTypeByNumber.get(key(item)) || '');
                        if (existing < 0) result.questions.push(merged.question);
                        else result.questions[existing] = merged.question;
                        if (merged.conflicts.length) result.withheld.push({ ...plan,
                            questionNumbers: [key(item)], reason: 'field-evidence-conflict',
                            fields: merged.conflicts, rawEvidence: { deterministic: result.questions[existing]?.sourceTrace,
                                vision: item } });
                    }
                }
                if (checked.missing.length) result.withheld.push({ ...plan, questionNumbers: checked.missing, reason: 'missing-visual-question' });
            } catch (error) {
                const code = error.code || root.Qisi.Utils.classifyVisualServiceFailure?.(error)?.code || 'TRANSPORT_ERROR';
                if (fileFatalVisualError(code)) transportFailure = code;
                result.withheld.push({ ...plan, errorCode: code, message: error.message,
                    rawEvidence: error.rawContent ?? null,
                    rawDiagnostics: error.rawLength === undefined ? null : {
                        length: error.rawLength, tail: error.rawTail, finishReason: error.finishReason
                    } });
            }
        }
        } finally { await closeRenderScope(renderScope); }
        if (supportRole || fullRole) {
            rawAnswers.sort((a, b) => Number(key(a)) - Number(key(b)));
            // Never reorder model solutions: the sequence gate must see source order.
            const gated = gateSupport(rawAnswers, rawSolutions, expected, [...drafts, ...result.questions]);
            result.answers = gated.answers; result.solutions = gated.solutions; result.supportGate = gated;
            for (const [field, items] of [['answer', rawAnswers], ['solution', rawSolutions]]) {
                const accepted = field === 'answer' ? result.answers : result.solutions;
                for (const item of items) if (!accepted.some(a => key(a) === key(item))) result.unmatched.push({ ...item, field, reason: 'pdf-support-field-withheld' });
            }
        }
        for (const n of expected.filter(n => questionRole && !result.questions.some(q => key(q) === n))) {
            if (!result.withheld.some(w => w.questionNumbers?.includes(n))) result.withheld.push({ sourceFileId: file.id, questionNumbers: [n], reason: 'unresolved-question' });
        }
        if (!result.questions.length && questionRole && !result.withheld.length) result.withheld.push({ sourceFileId: file.id, reason: 'no-proven-question-markers' });
        for (const question of result.questions) {
            if (JSON.stringify([question.stem, question.options]).includes('[[PDF_UNMAPPED]]')) {
                question.warnings = [...new Set([...(question.warnings || []), '此处公式需视觉补全；补全前不能正式入库。'])];
            }
        }
        result.questions.sort((a, b) => Number(key(a)) - Number(key(b)));
        result.withheld = result.withheld.map(item => ({ ...item,
            reasonDisplay: reviewLabel(item.reason), errorDisplay: reviewLabel(item.errorCode) }));
        return result;
    };
    return { contract, acceptVisual, gateSupport, mergeVisualQuestion, reviewLabel,
        crossPageNumbers, renderPage, ingest };
});
