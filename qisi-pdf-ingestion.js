(function (root, factory) {
    const api = factory(root);
    root.Qisi = root.Qisi || {};
    root.Qisi.PdfIngestion = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';
    const pageCache = new Map();
    const key = item => String(item?.questionNumber || item?.question || '');
    const contract = anchors => {
        const numbers = anchors.map(key);
        const valid = numbers.length > 0 && new Set(numbers).size === numbers.length &&
            numbers.every((n, i) => /^[1-9]\d{0,2}$/.test(n) && (!i || Number(n) === Number(numbers[i - 1]) + 1));
        return { authoritative: valid, questionNumbers: valid ? numbers : [], evidence: 'pdf-text-geometry', anchors };
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
    const renderPage = async (file, pageNo, trace) => {
        const bounded = root.Qisi.IngestionContext.withTimeout;
        const bytes = await bounded(async () => new Uint8Array(await (await root.fetch(file.uploadPath)).arrayBuffer()), 15000, 'PDF_READ_TIMEOUT');
        const loading = root.pdfjsLib.getDocument({ data: bytes });
        let pdf;
        try {
            pdf = await bounded(() => loading.promise, 15000, 'PDF_OPEN_TIMEOUT', () => loading.destroy());
            const page = await bounded(() => pdf.getPage(pageNo), 15000, 'PDF_PAGE_TIMEOUT');
            const base = page.getViewport({ scale: 1 });
            const scale = Math.min(2, 2200 / Math.max(base.width, base.height), Math.sqrt(4000000 / (base.width * base.height)));
            const viewport = page.getViewport({ scale });
            const canvas = root.document.createElement('canvas');
            canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
            try {
                const task = page.render({ canvasContext: canvas.getContext('2d'), viewport });
                await trace.measure(`render:${pageNo}`, () => bounded(() => task.promise, 20000, 'PDF_RENDER_TIMEOUT', () => task.cancel()));
                return { url: canvas.toDataURL('image/jpeg', 0.88), width: canvas.width, height: canvas.height };
            } finally { canvas.width = canvas.height = 0; }
        } finally { await (pdf ? pdf.destroy() : loading.destroy()); }
    };
    const requestVisual = async (image, expectedNumbers, helpers) => {
        const response = await helpers.request({
            model: helpers.model,
            messages: [{ role: 'user', content: [
                { type: 'text', text: '逐题转录页面，只返回 JSON {"questions":[{"questionNumber":"1","stem":"","options":[],"answer":"","solution":""}]}。'
                    + '保留公式的 LaTeX 和原有题号。不猜缺失内容。不把详解结论当成显式答案。'
                    + '跨页不完整的题干留空。题号必须来自此页面，文本层已证明的题号为：' + JSON.stringify(expectedNumbers) },
                { type: 'image_url', image_url: { url: image.url } }
            ] }], temperature: 0, max_tokens: 6000
        });
        const json = await response.json();
        if (!response.ok) throw Object.assign(new Error(json?.error?.message || json?.error || `HTTP ${response.status}`),
            { code: response.status === 401 || response.status === 403 ? 'API_AUTH_ERROR' : json?.code || 'API_RESPONSE_ERROR' });
        const content = json?.choices?.[0]?.message?.content;
        try {
            const parsed = JSON.parse(String(content || '').replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, ''));
            if (!Array.isArray(parsed.questions)) throw Error('questions');
            return parsed.questions;
        } catch (_) { throw Object.assign(new Error('视觉服务未返回有效题目结构'), { code: 'MALFORMED_MODEL_RESPONSE' }); }
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
                withheld: [{ sourceFileId: file.id, reason: 'pdf-inspection-failed', errorCode: error.code || 'PDF_READ_ERROR', message: error.message }] };
        }
        // A separately assigned support file supplies role evidence even when its markers
        // use ordinary decimal punctuation rather than an explicit 【答案】 label.
        if (!questionRole && supportRole) inspection = { ...inspection, pages: inspection.pages.map(page => ({ ...page,
            anchors: page.anchors.map(anchor => ({ ...anchor, role: 'support' })) })) };
        const trace = root.Qisi.IngestionContext.createTrace(file.id);
        const anchors = inspection.pages.flatMap(page => page.anchors || []);
        const questionContract = contract(anchors.filter(a => a.role === 'question'));
        const expected = questionRole ? questionContract.questionNumbers : expectedNumbers.map(String);
        const result = { questions: [], answers: [], solutions: [], pageImages: [], withheld: [...inspection.withheld.filter(w => !w.kind)], unmatched: [],
            contract: questionContract, inspection, timings: trace.stages, visualCalls: 0, cacheHits: 0 };
        const rawAnswers = [], rawSolutions = [];
        const supportContract = contract(anchors.filter(a => a.role === 'support'));
        const crossQuestions = crossPageNumbers(inspection.pages, 'question');
        const crossSupport = crossPageNumbers(inspection.pages, 'support');
        const evidenceFor = (block, source) => ({ source, sourceFileId: file.id, sourceFileName: file.filename,
            sourcePage: block.sourcePages[0], sourcePages: block.sourcePages, regions: block.regions, rawBlock: block.text });
        if (questionRole) for (const block of inspection.blocks.filter(b => b.role === 'question')) {
            if (!questionContract.authoritative || !expected.includes(block.questionNumber)) continue;
            const items = helpers.parseQuestions(block.text, file, false);
            if (items.length !== 1 || key(items[0]) !== block.questionNumber) continue;
            result.questions.push({ ...items[0], answer: '', solution: '', sourceTrace: evidenceFor(block, 'pdf-text'),
                sourcePage: block.sourcePages[0], sourcePages: block.sourcePages,
                fieldEvidence: { stem: evidenceFor(block, 'pdf-text'), options: evidenceFor(block, 'pdf-text') } });
        }
        // Explicit objective answers can be read even when surrounding formula glyphs cannot.
        // Every other support field remains under the sequence and evidence gates.
        if (supportRole || fullRole) {
            const candidates = [];
            for (const page of inspection.pages) for (const anchor of page.anchors) {
                if (anchor.role !== 'support') continue;
                const match = anchor.rawText.match(/^\s*([1-9]\d{0,2})\s*【\s*答案\s*】\s*([A-D](?:\s*[A-D]){0,3})\s*$/);
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
        for (const page of inspection.pages.filter(p => p.kind !== 'text')) {
            const supportOnly = (!questionRole && supportRole) || (fullRole &&
                !page.anchors.some(a => a.role === 'question') && page.anchors.some(a => a.role === 'support'));
            const pageNumbers = (page.anchors || []).filter(a => a.role === (supportOnly ? 'support' : 'question')).map(key);
            const plan = { sourceFileId: file.id, sourcePage: page.pageNo, questionNumbers: pageNumbers,
                region: [0, 0, page.width, page.height], reason: page.reason,
                status: 'withheld', visualNeeded: true };
            try {
                const image = await (helpers.render || renderPage)(file, page.pageNo, trace);
                result.pageImages.push({ sourceFileId: file.id, sourceFileName: file.filename, pageNo: page.pageNo, imageUrl: image.url });
                // No independent number evidence means model output can only be an untrusted proposal.
                const proven = supportOnly ? supportContract.authoritative && pageNumbers.every(n => expected.includes(n)) : questionContract.authoritative;
                if (!proven || !pageNumbers.length || !helpers.request || transportFailure) {
                    result.withheld.push({ ...plan, errorCode: transportFailure || 'VISUAL_REVIEW_REQUIRED' });
                    continue;
                }
                const bytes = new TextEncoder().encode(image.url + helpers.model + JSON.stringify(pageNumbers) + ':' + supportOnly + ':pdf-v2');
                const hash = Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256', bytes))).map(n => n.toString(16).padStart(2, '0')).join('');
                let pending = pageCache.get(hash);
                if (!pending) {
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
                    } else if (!result.questions.some(q => key(q) === key(item))) {
                        result.questions.push({ ...candidate, answer: '', solution: '' });
                    }
                }
                if (checked.missing.length) result.withheld.push({ ...plan, questionNumbers: checked.missing, reason: 'missing-visual-question' });
            } catch (error) {
                const code = error.code || root.Qisi.Utils.classifyVisualServiceFailure?.(error)?.code || 'TRANSPORT_ERROR';
                transportFailure = code;
                result.withheld.push({ ...plan, errorCode: code, message: error.message });
            }
        }
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
        result.questions.sort((a, b) => Number(key(a)) - Number(key(b)));
        return result;
    };
    return { contract, acceptVisual, gateSupport, crossPageNumbers, renderPage, ingest };
});
