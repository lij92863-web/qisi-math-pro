(function (root, factory) {
    const api = factory(root);
    root.Qisi = root.Qisi || {};
    root.Qisi.PdfInspection = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
    'use strict';
    const cache = new WeakMap();
    const marker = /^\s*(?:第\s*)?([1-9](?:\s?\d){0,2})\s*(?:题)?[.．、]\s*(\S.*)$/;
    const collectAnchors = (page, initialRole = 'question') => {
        let role = initialRole;
        return page.lines.flatMap(line => {
        if (/^\s*(?:参考答案|答案|答案[与及和]解析|参考答案[与及和]解析)\s*[:：]?\s*$/.test(line.text)) { role = 'support'; return []; }
        if (line.bbox[0] > page.width * 0.35) return [];
        const question = line.text.match(marker);
        const support = line.text.match(/^\s*([1-9]\d{0,2})\s*【\s*(?:答案|解析|详解)\s*】/);
        if (!question && !support) return [];
        if (support) role = 'support';
        return [{ questionNumber: (question || support)[1].replace(/\s/g, ''), role,
            page: page.pageNo, bbox: line.bbox, rawText: line.text }];
        });
    };
    const groupLines = items => {
        const rows = [];
        for (const item of [...items].sort((a, b) => a.y - b.y || a.x - b.x)) {
            let row = rows.find(r => Math.abs(r.y - item.y) <= Math.max(2, Math.min(r.height, item.height) * 0.3));
            if (!row) { row = { y: item.y, height: item.height, items: [] }; rows.push(row); }
            row.items.push(item);
        }
        return rows.map(row => {
            row.items.sort((a, b) => a.x - b.x);
            return { text: row.items.map(i => i.str).join(' '),
                bbox: [Math.min(...row.items.map(i => i.x)), row.y,
                    Math.max(...row.items.map(i => i.x + i.width)), row.y + row.height],
                wideGap: row.items.some((item, i, all) => i > 0 && item.x - all[i - 1].x - all[i - 1].width > 100) };
        });
    };
    const classify = ({ lines = [], imageCount = 0, vectorCount = 0, rotation = 0, hasSmallText = false }) => {
        const text = lines.map(l => l.text).join('\n');
        const meaningful = text.replace(/[\s\d.．、:：()（）]/g, '').length;
        if (meaningful < 20) return { kind: 'scanned', reason: 'insufficient-text', text };
        if (/[\uFFFD\uE000-\uF8FF]/.test(text)) return { kind: 'mixed', reason: 'unmapped-glyphs', text };
        if (rotation % 180 !== 0) return { kind: 'mixed', reason: 'rotated-layout', text };
        if (hasSmallText) return { kind: 'mixed', reason: 'possible-scripts-or-detached-text', text };
        if (lines.some(l => l.wideGap)) return { kind: 'mixed', reason: 'columns-or-detached-text', text };
        if (imageCount || vectorCount > 10) return { kind: 'mixed', reason: 'non-text-content', text };
        return { kind: 'text', reason: 'text-geometry', text };
    };
    const segment = (pages, initialRole = 'question') => {
        const blocks = [];
        const withheld = [];
        let active = null;
        let role = initialRole;
        let sectionType = '';
        let previousPage = 0;
        for (const page of pages) {
            // A "mixed" page has a text layer the teacher can read: the parts that could not be mapped
            // are the formula glyphs, which the page carries as pictures. Throwing that text away made the
            // whole file produce nothing whenever the visual service was unavailable (the teacher saw
            // "0 题" for 完整版题目.pdf). The page is still listed as needing visual review, but what the
            // text proves is kept as a safe partial draft.
            const usable = page.kind !== 'scanned';
            if (page.pageNo !== previousPage + 1 || !usable) active = null;
            previousPage = page.pageNo;
            if (!usable) {
                withheld.push({ sourcePage: page.pageNo, reason: page.reason, kind: page.kind });
                continue;
            }
            if (page.kind !== 'text') {
                withheld.push({ sourcePage: page.pageNo, reason: page.reason, kind: page.kind });
            }
            for (const line of page.lines) {
                const rawText = line.text.trim();
                const text = rawText.replace(/[\uFFFD\uE000-\uF8FF]+/g, '[[PDF_UNMAPPED]]');
                if (/^(?:参考答案|答案|答案[与及和]解析|参考答案[与及和]解析)\s*[:：]?$/.test(text)) {
                    role = 'support'; active = null; continue;
                }
                const heading = text.match(/^\s*[一二三四五六七八九十]+\s*[、.．]\s*(单项选择题|单选题|多项选择题|多选题|填空题|解答题)/);
                if (heading) {
                    sectionType = /多项|多选/.test(heading[1]) ? '多选题'
                        : /单项|单选/.test(heading[1]) ? '单选题' : heading[1];
                    active = null;
                    continue;
                }
                // A margin page number can never establish or extend a question.
                if (line.bbox[1] > page.height * 0.95 || line.bbox[3] < page.height * 0.035) continue;
                const hit = text.match(marker) || (role === 'support'
                    ? text.match(/^\s*([1-9]\d{0,2})\s*【\s*(?:答案|解析|详解)\s*】/) : null);
                if (hit) {
                    active = { questionNumber: hit[1].replace(/\s/g, ''), role, type: role === 'question' ? sectionType : '', text, rawText,
                        sourcePages: [page.pageNo],
                        regions: [{ page: page.pageNo, bbox: [...line.bbox] }] };
                    blocks.push(active);
                } else if (active) {
                    active.text += `\n${text}`;
                    active.rawText += `\n${rawText}`;
                    if (!active.sourcePages.includes(page.pageNo)) active.sourcePages.push(page.pageNo);
                    active.regions.push({ page: page.pageNo, bbox: [...line.bbox] });
                }
            }
        }
        const seen = new Set();
        let previous = 0;
        const safe = [];
        for (const block of blocks) {
            const key = `${block.role}:${block.questionNumber}`;
            const n = Number(block.questionNumber);
            if ((block.role === 'question' && seen.has(key)) || (block.role === 'question' && n <= previous)) {
                withheld.push({ questionNumber: block.questionNumber, reason: 'duplicate-or-backward-marker' });
                // The first occurrence is ambiguous too. Keep raw evidence but publish neither.
                for (let i = safe.length - 1; i >= 0; i--) if (`${safe[i].role}:${safe[i].questionNumber}` === key) safe.splice(i, 1);
                continue;
            }
            seen.add(key);
            if (block.role === 'question') previous = n;
            safe.push(block);
        }
        // Use the proved anchor boundaries as a vertical band. A text-box union cuts off diagrams
        // beside the text; the band includes the page content width while excluding adjacent questions.
        const regionByPage = block => {
            const map = new Map();
            for (const region of block.regions || []) {
                const current = map.get(region.page) || { page: region.page, bbox: [...region.bbox] };
                current.bbox = [Math.min(current.bbox[0], region.bbox[0]), Math.min(current.bbox[1], region.bbox[1]),
                    Math.max(current.bbox[2], region.bbox[2]), Math.max(current.bbox[3], region.bbox[3])];
                map.set(region.page, current);
            }
            for (const current of map.values()) {
                const page = pages.find(item => item.pageNo === current.page);
                const anchors = (page?.anchors || []).filter(anchor => anchor.role === block.role)
                    .sort((a, b) => a.bbox[1] - b.bbox[1]);
                const own = anchors.find(anchor => anchor.questionNumber === block.questionNumber);
                const continuation = !own && current.page !== block.sourcePages[0];
                const next = anchors.find(anchor => anchor.bbox[1] > (own?.bbox[1] ?? -1));
                if (!page || (!own && !continuation)) { map.delete(current.page); continue; }
                const headingAfter = page.lines.find(line => line.bbox[1] > (own?.bbox[1] ?? page.height * 0.035)
                    && /^\s*[一二三四五六七八九十]+\s*[、.．]\s*(?:单项选择题|单选题|多项选择题|多选题|填空题|解答题)/.test(line.text));
                current.bbox = [page.width * 0.05, own ? Math.max(page.height * 0.035, own.bbox[1] - 2) : page.height * 0.035,
                    page.width * 0.95, Math.min(page.height * 0.95,
                        next ? next.bbox[1] - 2 : page.height * 0.95,
                        headingAfter ? headingAfter.bbox[1] - 2 : page.height * 0.95)];
            }
            return [...map.values()].sort((left, right) => left.page - right.page);
        };

        const withRegions = block => ({ ...block, regionByPage: regionByPage(block) });

        return { blocks: safe.map(withRegions), rawBlocks: blocks.map(withRegions), withheld };
    };
    const inspect = (file, deps = {}) => {
        const cached = cache.get(file);
        if (cached?.uploadPath === file.uploadPath) return cached.promise;
        const trace = root.Qisi.IngestionContext.createTrace(file.id);
        const bounded = root.Qisi.IngestionContext.withTimeout;
        const promise = (async () => {
            const pdfjs = deps.pdfjs || root.pdfjsLib;
            const bytes = await trace.measure('read', () => bounded(async () =>
                new Uint8Array(await (await root.fetch(file.uploadPath)).arrayBuffer()), 15000, 'PDF_READ_TIMEOUT'));
            const loading = pdfjs.getDocument({ data: bytes });
            let pdf;
            try {
                pdf = await trace.measure('pdf-open', () => bounded(() => loading.promise, 15000, 'PDF_OPEN_TIMEOUT', () => loading.destroy()));
                const numbers = root.Qisi.Utils.expandPageRange(file.pageRange, pdf.numPages);
                const pages = [];
                let role = 'question';
                for (const pageNo of numbers) {
                    try {
                    const page = await bounded(() => pdf.getPage(pageNo), 15000, 'PDF_PAGE_TIMEOUT');
                    const viewport = page.getViewport({ scale: 1 });
                    const content = await trace.measure(`text:${pageNo}`, () => bounded(() => page.getTextContent(), 15000, 'PDF_TEXT_TIMEOUT'));
                    const operators = await bounded(() => page.getOperatorList(), 15000, 'PDF_OPERATORS_TIMEOUT');
                    const imageOps = new Set(['paintImageXObject', 'paintInlineImageXObject', 'paintImageMaskXObject', 'paintImageXObjectRepeat', 'paintImageMaskXObjectRepeat'].map(n => pdfjs.OPS[n]));
                    const vectorOps = new Set(['stroke', 'fill', 'eoFill', 'fillStroke', 'eoFillStroke'].map(n => pdfjs.OPS[n]));
                    const items = content.items.filter(i => i.str?.trim()).map(i => {
                        const t = pdfjs.Util.transform(viewport.transform, i.transform);
                        const height = Math.max(Math.abs(i.height || 0), 1);
                        return { str: i.str, x: t[4], y: t[5] - height, width: i.width, height };
                    });
                    const lines = groupLines(items);
                    const heights = items.map(i => i.height).sort((a, b) => a - b);
                    const meta = { lines, imageCount: operators.fnArray.filter(n => imageOps.has(n)).length,
                        vectorCount: operators.fnArray.filter(n => vectorOps.has(n)).length, rotation: page.rotate,
                        hasSmallText: heights.length > 0 && heights[0] < heights[Math.floor(heights.length / 2)] * 0.78 };
                    const inspected = { pageNo, width: viewport.width, height: viewport.height, ...meta, ...classify(meta) };
                    inspected.anchors = collectAnchors(inspected, role);
                    role = inspected.anchors.at(-1)?.role || role;
                    pages.push(inspected);
                    page.cleanup();
                    } catch (error) {
                        pages.push({ pageNo, kind: 'unresolved', reason: error.code || 'PDF_PAGE_READ_ERROR',
                            lines: [], anchors: [], text: '', width: 0, height: 0, message: error.message });
                    }
                }
                return { pages, ...segment(pages), timings: trace.stages, totalPages: pdf.numPages };
            } finally { await (pdf ? pdf.destroy() : loading.destroy()); }
        })();
        cache.set(file, { uploadPath: file.uploadPath, promise });
        promise.catch(() => { if (cache.get(file)?.promise === promise) cache.delete(file); });
        return promise;
    };
    return { groupLines, classify, segment, collectAnchors, inspect };
});
