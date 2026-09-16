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
            return { text: row.items.map(i => i.str).filter(part => part !== '').join(' '),
                rawText: row.items.map(i => i.raw ?? i.str).join(' '),
                structural: row.items.some(i => i.structural),
                bbox: [Math.min(...row.items.map(i => i.x)), row.y,
                    Math.max(...row.items.map(i => i.x + i.width)), row.y + row.height],
                wideGap: row.items.some((item, i, all) => i > 0 && item.x - all[i - 1].x - all[i - 1].width > 100) };
        });
    };
    // Word writes a MathType/Equation preview with the Symbol and MT Extra fonts. Both are *symbolic*
    // fonts whose Windows encoding lives in the private-use area (U+F020-U+F0FF), so the PDF's own
    // ToUnicode hands a text extractor U+F0xx instead of the character the teacher sees: every =, {, ∈,
    // ⋅, ∠, ° and triangle arrived as a wall of [[PDF_UNMAPPED]] and no question could be read. The low
    // byte of those code points is the character code of the font's published encoding, so the glyph can
    // be read back from the font standard instead of guessed: `SymbolMT` uses the Adobe Symbol encoding
    // and `MT-Extra` the MathType extra-font encoding. Codes outside the proved set stay unmapped on
    // purpose - a wrong symbol is worse than a missing one.
    const SYMBOL_GLYPHS = new Map([
        [0x22, '∀'], [0x24, '∃'], [0x27, '∋'], [0x2a, '∗'], [0x2d, '−'], [0x40, '≅'],
        [0x41, 'Α'], [0x42, 'Β'], [0x43, 'Χ'], [0x44, 'Δ'], [0x45, 'Ε'], [0x46, 'Φ'], [0x47, 'Γ'],
        [0x48, 'Η'], [0x49, 'Ι'], [0x4a, 'ϑ'], [0x4b, 'Κ'], [0x4c, 'Λ'], [0x4d, 'Μ'], [0x4e, 'Ν'],
        [0x4f, 'Ο'], [0x50, 'Π'], [0x51, 'Θ'], [0x52, 'Ρ'], [0x53, 'Σ'], [0x54, 'Τ'], [0x55, 'Υ'],
        [0x56, 'ς'], [0x57, 'Ω'], [0x58, 'Ξ'], [0x59, 'Ψ'], [0x5a, 'Ζ'], [0x5c, '∴'], [0x5e, '⊥'],
        [0x60, '‾'],
        [0x61, 'α'], [0x62, 'β'], [0x63, 'χ'], [0x64, 'δ'], [0x65, 'ε'], [0x66, 'φ'], [0x67, 'γ'],
        [0x68, 'η'], [0x69, 'ι'], [0x6a, 'ϕ'], [0x6b, 'κ'], [0x6c, 'λ'], [0x6d, 'μ'], [0x6e, 'ν'],
        [0x6f, 'ο'], [0x70, 'π'], [0x71, 'θ'], [0x72, 'ρ'], [0x73, 'σ'], [0x74, 'τ'], [0x75, 'υ'],
        [0x76, 'ϖ'], [0x77, 'ω'], [0x78, 'ξ'], [0x79, 'ψ'], [0x7a, 'ζ'], [0x7e, '∼'],
        [0xa0, '€'], [0xa1, 'ϒ'], [0xa2, '′'], [0xa3, '≤'], [0xa4, '⁄'], [0xa5, '∞'], [0xa6, 'ƒ'],
        [0xa7, '♣'], [0xa8, '♦'], [0xa9, '♥'], [0xaa, '♠'], [0xab, '↔'], [0xac, '←'], [0xad, '↑'],
        [0xae, '→'], [0xaf, '↓'],
        [0xb0, '°'], [0xb1, '±'], [0xb2, '″'], [0xb3, '≥'], [0xb4, '×'], [0xb5, '∝'], [0xb6, '∂'],
        [0xb7, '•'], [0xb8, '÷'], [0xb9, '≠'], [0xba, '≡'], [0xbb, '≈'], [0xbc, '…'], [0xbf, '↵'],
        [0xc0, 'ℵ'], [0xc1, 'ℑ'], [0xc2, 'ℜ'], [0xc3, '℘'], [0xc4, '⊗'], [0xc5, '⊕'], [0xc6, '∅'],
        [0xc7, '∩'], [0xc8, '∪'], [0xc9, '⊃'], [0xca, '⊇'], [0xcb, '⊄'], [0xcc, '⊂'], [0xcd, '⊆'],
        [0xce, '∈'], [0xcf, '∉'],
        [0xd0, '∠'], [0xd1, '∇'], [0xd2, '®'], [0xd3, '©'], [0xd4, '™'], [0xd5, '∏'], [0xd6, '√'],
        [0xd7, '⋅'], [0xd8, '¬'], [0xd9, '∧'], [0xda, '∨'], [0xdb, '⇔'], [0xdc, '⇐'], [0xdd, '⇑'],
        [0xde, '⇒'], [0xdf, '⇓'],
        [0xe0, '◊'], [0xe1, '⟨'], [0xe2, '⟩'], [0xe3, '∫'], [0xe5, '∑']
    ]);
    // A stretched delimiter or radical is drawn as stacked pieces (top, extender, bottom) at one x. They
    // are one character for the reader, so the first piece of a family at one position is emitted and the
    // rest of that column is dropped. Verified against the rendered pages of the real papers.
    const SYMBOL_STRUCTURE = new Map([
        [0xe6, '√'], [0xe7, '√'], [0xe8, '√'],
        [0xe9, '['], [0xea, '['], [0xeb, '['],
        [0xec, '{'], [0xed, '{'], [0xee, '{'],
        [0xf6, ')'], [0xf7, ')'], [0xf8, ')'],
        [0xf9, ']'], [0xfa, ']'], [0xfb, ']'],
        [0xfc, '}'], [0xfd, '}'], [0xfe, '}'],
        // Pure extensions only lengthen a mark the base character already carries.
        [0xbd, ''], [0xbe, '']
    ]);
    const MT_EXTRA_GLYPHS = new Map([[0x49, '∩'], [0x51, '∵'], [0x56, '△'], [0x6f, '°']]);
    // Arrow heads, arrow shafts and the wide slur are drawn marks over other characters, not characters.
    const MT_EXTRA_STRUCTURE = new Set([0x72, 0x75, 0xbb]);
    // A multi-paper PDF names its fonts "<SUBSET>+<Family>"; the subset tag is per file, not per font.
    const fontFamily = name => String(name || '').replace(/^[A-Z]{6}\+/, '');
    const decodeGlyphRun = (value, fontName, seen = new Set(), x = 0) => {
        const family = fontFamily(fontName);
        const symbol = /(^|[^a-z])symbol/i.test(family);
        const extra = /mt[-_ ]?extra/i.test(family);
        let text = '';
        let structural = false;
        for (const character of String(value ?? '')) {
            const code = character.codePointAt(0);
            if (code < 0xe000 || code > 0xf8ff) { text += character; continue; }
            const low = code & 0xff;
            if (extra) {
                if (MT_EXTRA_GLYPHS.has(low)) { text += MT_EXTRA_GLYPHS.get(low); continue; }
                if (MT_EXTRA_STRUCTURE.has(low)) { structural = true; continue; }
                text += character;
                continue;
            }
            if (!symbol) { text += character; continue; }
            if (SYMBOL_STRUCTURE.has(low)) {
                structural = true;
                const drawn = SYMBOL_STRUCTURE.get(low);
                // One delimiter column per position: the pieces share an x, so a 2pt bucket is one glyph.
                const column = `${drawn}|${Math.round(Number(x) / 2)}`;
                if (drawn && !seen.has(column)) { seen.add(column); text += drawn; }
                continue;
            }
            if (SYMBOL_GLYPHS.has(low)) { text += SYMBOL_GLYPHS.get(low); continue; }
            // The rest of the Symbol encoding is ASCII, so a code point that is already a visible
            // character is the character the reader sees.
            text += low >= 0x20 && low <= 0x7e ? String.fromCharCode(low) : character;
        }
        return { text, structural };
    };
    const classify = ({ lines = [], imageCount = 0, vectorCount = 0, rotation = 0, hasSmallText = false }) => {
        const text = lines.map(l => l.text).join('\n');
        const meaningful = text.replace(/[\s\d.．、:：()（）]/g, '').length;
        if (meaningful < 20) return { kind: 'scanned', reason: 'insufficient-text', text };
        if (/[\uFFFD\uE000-\uF8FF]/.test(text)) return { kind: 'mixed', reason: 'unmapped-glyphs', text };
        if (lines.some(line => line.structural)) return { kind: 'mixed', reason: 'stacked-formula-glyphs', text };
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
                // `line.rawText` keeps the page's own code points as evidence even where they were
                // decoded for display; anything the decoder could not prove is still marked unmapped.
                const rawText = String(line.rawText ?? line.text).trim();
                const text = String(line.text).trim().replace(/[\uFFFD\uE000-\uF8FF]+/g, '[[PDF_UNMAPPED]]');
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
                        structuralGlyphs: Boolean(line.structural),
                        textLayerReliable: page.kind === 'text' && !line.structural,
                        regions: [{ page: page.pageNo, bbox: [...line.bbox] }] };
                    blocks.push(active);
                } else if (active) {
                    active.text += `\n${text}`;
                    active.rawText += `\n${rawText}`;
                    if (line.structural) active.structuralGlyphs = true;
                    if (page.kind !== 'text' || line.structural) active.textLayerReliable = false;
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
                    // getOperatorList above is what resolves the page's fonts; without it the font lookup
                    // throws and the symbolic glyphs would stay undecoded. A font that is still unknown is
                    // left alone rather than guessed.
                    const familyOf = loadedName => {
                        try { return page.commonObjs?.get?.(loadedName)?.name || ''; } catch { return ''; }
                    };
                    const seenColumns = new Set();
                    const items = content.items.filter(i => i.str?.trim()).map(i => {
                        const t = pdfjs.Util.transform(viewport.transform, i.transform);
                        const height = Math.max(Math.abs(i.height || 0), 1);
                        const decoded = decodeGlyphRun(i.str, familyOf(i.fontName), seenColumns, t[4]);
                        return { str: decoded.text, raw: i.str, structural: decoded.structural,
                            x: t[4], y: t[5] - height, width: i.width, height };
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
    return { groupLines, classify, segment, collectAnchors, inspect, decodeGlyphRun };
});
