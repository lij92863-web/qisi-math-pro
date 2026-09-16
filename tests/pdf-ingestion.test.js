const test = require('node:test');
const assert = require('node:assert/strict');
require('../qisi-utils.js');
require('../qisi-ingestion-context.js');
require('../qisi-pdf-support-aligner.js');
global.Qisi.PdfSupportControlledWrite = require('../qisi-pdf-support-controlled-write.js');
const Inspection = require('../qisi-pdf-inspection.js');
const Ingestion = require('../qisi-pdf-ingestion.js');
const line = (text, y = 100) => ({ text, bbox: [90, y, 500, y + 12] });
const page = (pageNo, lines, kind = 'text') => {
    const p = { pageNo, lines, kind, width: 600, height: 840, text: lines.map(l => l.text).join('\n') };
    p.anchors = Inspection.collectAnchors(p); return p;
};

test('PDF inspector distinguishes usable text from glyph, layout and scan uncertainty', () => {
    const lines = [line('1. This is an ordinary sufficiently long question without diagrams.')];
    assert.equal(Inspection.classify({ lines }).kind, 'text');
    for (const more of [{ imageCount: 1 }, { rotation: 90 }, { hasSmallText: true }, { lines: [line('1. A formula \uf02b with corrupted unicode and a sufficiently long question.')] }]) {
        assert.equal(Inspection.classify({ lines, ...more }).kind, 'mixed');
    }
    assert.equal(Inspection.classify({ lines: [line('1')] }).kind, 'scanned');
    assert.deepEqual(Inspection.collectAnchors(page(1, [line('1 1 . 如图，在四边形中，计算其面积')])).map(a => a.questionNumber), ['11']);
});

test('mixed PDF text keeps readable words around an explicit unmapped gap', () => {
    const p = page(1, [line('1. 可靠中文 \uf02b 可靠结尾', 100)], 'mixed');
    const block = Inspection.segment([p]).blocks[0];
    assert.equal(block.text, '1. 可靠中文 [[PDF_UNMAPPED]] 可靠结尾');
    assert.equal(block.rawText, '1. 可靠中文 \uf02b 可靠结尾');
});

test('PDF review labels explain reasons in Chinese and retain machine codes', () => {
    assert.equal(Ingestion.reviewLabel('unmapped-glyphs'),
        '公式字符无法从 PDF 文本层可靠映射（unmapped-glyphs）');
    assert.match(Ingestion.reviewLabel('MALFORMED_MODEL_RESPONSE'), /模型回复格式无效（MALFORMED_MODEL_RESPONSE）/);
});

test('PDF text blocks carry cross-page evidence and do not turn footer numbers into questions', () => {
    const pages = [page(1, [line('1. First question'), line('page footer', 812)]),
        page(2, [line('continued'), line('2. Second question', 180)])];
    const blocks = Inspection.segment(pages).blocks;
    assert.deepEqual(blocks.map(b => b.questionNumber), ['1', '2']);
    assert.deepEqual(blocks[0].sourcePages, [1, 2]);
    assert.match(blocks[0].text, /continued/); assert.doesNotMatch(blocks[0].text, /footer/);
    assert.deepEqual([...Ingestion.crossPageNumbers(pages, 'question')], ['1']);
});

// "程序负责归属" needs the region a question actually occupies, not just the page. Every block now carries
// the union of its own line boxes, page by page - the footer and the neighbouring question stay outside.
test('every question block carries the region it occupies on each page', () => {
    const pages = [page(1, [line('1. First question', 100), line('its second line', 130), line('page footer', 812)]),
        page(2, [line('2. Second question', 190)])];
    const blocks = Inspection.segment(pages).blocks;

    assert.deepEqual(blocks[0].regionByPage, [{ page: 1, bbox: [30, 98, 570, 798] }],
        'the question band includes figures to the right while excluding the footer');
    assert.deepEqual(blocks[1].regionByPage, [{ page: 2, bbox: [30, 188, 570, 798] }]);
});

// A page whose anchors are proved keeps a question region in the vision plan; the review panel shows it
// instead of the whole page.
test('a withheld page carries the question region when the text layer proved it', async () => {
    const inspect = Inspection.inspect;
    try {
        const mixed = [page(1, [line('1. First question', 120), line('2. Second question', 400)], 'mixed')];
        mixed[0].anchors = Inspection.collectAnchors(mixed[0]);
        Inspection.inspect = async () => ({ pages: mixed, ...Inspection.segment(mixed), timings: [] });
        const result = await Ingestion.ingest({ file: { id: 'region' }, questionRole: true, helpers: {
            parseQuestions: () => [{ question: '1', stem: 'First question' }], parseSupport: () => ({})
        } });

        const withheld = result.withheld.find(w => w.sourcePage === 1 && w.visualNeeded);
        assert.deepEqual(withheld.region, [30, 118, 570, 798], 'the page plan carries the question band');
        assert.ok(withheld.region[3] - withheld.region[1] < mixed[0].height, 'not the whole page');
    } finally { Inspection.inspect = inspect; }
});

test('question bands include right-side figures and stop before the next anchor', () => {
    const p = page(1, [line('1. Left-hand stem', 100), line('A. option below graph', 250),
        line('2. Next question', 400), line('page footer', 812)], 'mixed');
    const blocks = Inspection.segment([p]).blocks;
    assert.deepEqual(blocks[0].regionByPage[0].bbox, [30, 98, 570, 398]);
    assert.ok(blocks[0].regionByPage[0].bbox[2] > 520, 'right-side figure at x=520 remains in crop');
    assert.ok(blocks[0].regionByPage[0].bbox[3] < 400, 'neighbour is excluded');
    assert.ok(blocks[1].regionByPage[0].bbox[3] < 812, 'footer is excluded');
});

test('PDF section headings, rather than visual type guesses, determine question type', () => {
    const p = page(1, [line('一、单项选择题', 60), line('1. First', 100),
        line('二、多项选择题', 200), line('7. Multiple', 240),
        line('三、填空题', 400), line('10. Blank', 440)]);
    assert.deepEqual(Inspection.segment([p]).blocks.map(block => [block.questionNumber, block.type]),
        [['1', '单选题'], ['7', '多选题'], ['10', '填空题']]);
    const visionOnly = Ingestion.mergeVisualQuestion(null, { question: '7', type: '单选题', stem: 'text' });
    assert.equal(visionOnly.question.type, '', 'model type alone is not structural evidence');
});

test('deterministic PDF fields survive visual conflict and only explicit gaps can be filled', () => {
    const deterministic = { question: '1', type: '多选题', stem: 'sin(nπ/2)', options: ['A', 'B'],
        sourceTrace: { source: 'pdf-text' }, fieldEvidence: { stem: { source: 'pdf-text' } } };
    const visual = { question: '1', type: '单选题', stem: 'sin(m/2)', options: ['A', 'C'],
        fieldEvidence: { stem: { source: 'pdf-vision', rawValue: 'sin(m/2)' } } };
    const conflict = Ingestion.mergeVisualQuestion(deterministic, visual);
    assert.equal(conflict.question.stem, 'sin(nπ/2)');
    assert.equal(conflict.question.type, '多选题');
    assert.deepEqual(conflict.question.options, ['A', 'B']);
    assert.deepEqual(conflict.conflicts, ['stem', 'options']);
    assert.equal(conflict.question.fieldEvidence.stem.vision.rawValue, 'sin(m/2)');

    const vectorConflict = Ingestion.mergeVisualQuestion({ ...deterministic,
        stem: 'BA·AC / |BC|' }, { ...visual, stem: 'BC / |BC|' });
    assert.equal(vectorConflict.question.stem, 'BA·AC / |BC|');
    assert.deepEqual(vectorConflict.conflicts, ['stem', 'options']);

    const gap = Ingestion.mergeVisualQuestion({ ...deterministic, stem: 'sin([[PDF_UNMAPPED]])' },
        { ...visual, stem: 'sin(nπ/2)', options: ['A', 'B'] });
    assert.equal(gap.question.stem, 'sin(nπ/2)');
    assert.deepEqual(gap.conflicts, []);
    assert.equal(gap.question.fieldEvidence.stem.rawValue, 'sin([[PDF_UNMAPPED]])');
    const twoGaps = Ingestion.mergeVisualQuestion({ ...deterministic,
        stem: '前 [[PDF_UNMAPPED]] 中 [[PDF_UNMAPPED]] 后' },
        { ...visual, stem: '前 公式甲 中 公式乙 后', options: ['A', 'B'] });
    assert.equal(twoGaps.question.stem, '前 公式甲 中 公式乙 后');
    assert.deepEqual(twoGaps.conflicts, []);
});

// A question whose page is not plain text has text the model must be allowed to replace: a fraction or a
// radical is drawn as several rows, so the linear text can carry a neighbouring question's row. The text
// value stays in evidence and the draft keeps a review warning.
test('a text layer proved unusable is replaced by the visual transcription, a usable one is not', () => {
    const partial = { question: '1', type: '单选题', stem: '5 . 在 中， ， ，则 的形状为（ ）\nBC BC BC AB 2',
        options: ['直角三角形', '三边均不相等的三角形', '等边三角形', '等腰（非等边）三角形'],
        sourceTrace: { source: 'pdf-text' },
        fieldEvidence: { stem: { source: 'pdf-text', textLayerReliable: false },
            options: { source: 'pdf-text', textLayerReliable: false } } };
    const visual = { question: '1', stem: '在△ABC中，$\\frac{\\vec{BA}\\cdot\\vec{AC}}{|\\vec{BC}|}=0$，则△ABC的形状为（ ）',
        options: ['直角三角形', '三边均不相等的三角形', '等边三角形', '等腰（非等边）三角形'],
        fieldEvidence: { stem: { source: 'pdf-vision', rawValue: 'text' },
            options: { source: 'pdf-vision', rawValue: ['直角三角形'] } } };
    const replaced = Ingestion.mergeVisualQuestion(partial, visual);
    assert.match(replaced.question.stem, /\\frac/, 'the reading of the page replaces the stacked text');
    assert.deepEqual(replaced.conflicts, []);
    assert.equal(replaced.question.fieldEvidence.stem.rawValue, partial.stem, 'the text stays as evidence');
    assert.equal(replaced.question.fieldEvidence.stem.textLayerReplaced, true);
    assert.equal(replaced.question.fieldEvidence.stem.valueSource, 'pdf-vision');
    assert.match(replaced.question.warnings.join('\n'), /视觉转录/);

    const trusted = Ingestion.mergeVisualQuestion({ ...partial,
        fieldEvidence: { stem: { source: 'pdf-text', textLayerReliable: true },
            options: { source: 'pdf-text', textLayerReliable: true } } }, visual);
    assert.equal(trusted.question.stem, partial.stem);
    assert.deepEqual(trusted.conflicts, ['stem']);

    const withGap = Ingestion.mergeVisualQuestion({ ...partial, stem: 'sin([[PDF_UNMAPPED]])' },
        { ...visual, stem: 'sin([[PDF_UNMAPPED]]) 仍缺' });
    assert.deepEqual(withGap.conflicts, ['stem'], 'a reply that still carries a gap is not an improvement');
});

test('a separately assigned support PDF has support blocks and per-question regions', async () => {
    const inspect = Inspection.inspect;
    const asked = [];
    try {
        const pages = [page(1, [line('1. Answer and reasoning', 100), line('2. Answer and reasoning', 400)], 'mixed')];
        Inspection.inspect = async () => ({ pages, ...Inspection.segment(pages), timings: [] });
        const result = await Ingestion.ingest({ file: { id: 'support-role' }, supportRole: true,
            expectedNumbers: ['1', '2'], helpers: { model: 'support-role-mock',
                render: async (_, __, ___, region) => ({ url: `support-${region?.[1] || 'page'}` }),
                request: async payload => {
                    asked.push(payload.messages[0].content[0].text);
                    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({
                        questions: [{ questionNumber: (/第 (\d+) 题/.exec(payload.messages[0].content[0].text) || [])[1],
                            stem: '', answer: '', solution: '' }]
                    }) } }] }) };
                } } });
        assert.deepEqual(result.inspection.blocks.map(b => b.role), ['support', 'support']);
        assert.equal(result.inspection.rawBlocks.every(b => b.role === 'support'), true);
        assert.equal(asked.length, 2);
        assert.ok(asked.every(text => text.includes('所在的图片区域')));
    } finally { Inspection.inspect = inspect; }
});

test('an explicit support answer row is distinct from a solution conclusion', async () => {
    const inspect = Inspection.inspect;
    try {
        const p = page(1, [line('8. C', 100), line('9. 故选 C, with detailed working', 300)], 'mixed');
        Inspection.inspect = async () => ({ pages: [p], ...Inspection.segment([p]), timings: [] });
        const result = await Ingestion.ingest({ file: { id: 'explicit-answer' }, supportRole: true,
            expectedNumbers: ['8', '9'], drafts: [8, 9].map(n => ({ question: String(n), type: '单选题',
                options: ['one', 'two', 'three', 'four'] })),
            helpers: { parseSupport: () => ({}), render: async () => ({ url: 'mock-page' }) } });
        assert.deepEqual(result.answers, [], 'existing answer/solution sequence gate still fails closed');
        assert.ok(result.unmatched.some(item => item.question === '8' && item.answer === 'C'),
            'the explicit row remains a candidate with raw evidence for review');
        assert.equal(result.unmatched.some(item => item.question === '9' && item.answer), false,
            'the solution conclusion never becomes an answer candidate');
    } finally { Inspection.inspect = inspect; }
});

test('malformed response withholds one region while later proved regions continue', async () => {
    const inspect = Inspection.inspect;
    let calls = 0;
    try {
        const pages = [page(1, [line('1. First', 100), line('2. Second', 300), line('3. Third', 500)], 'mixed')];
        Inspection.inspect = async () => ({ pages, ...Inspection.segment(pages), timings: [] });
        const result = await Ingestion.ingest({ file: { id: 'local-failure' }, questionRole: true,
            helpers: { model: 'local-failure-mock', parseQuestions: () => [],
                render: async (_, __, ___, region) => ({ url: `local-${region?.[1] || 'page'}` }),
                request: async payload => {
                    calls++;
                    if (calls === 2) return { ok: true, json: async () => ({ choices: [{ message: { content: 'broken' } }] }) };
                    const number = (/第 (\d+) 题/.exec(payload.messages[0].content[0].text) || [])[1];
                    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({
                        questions: [{ questionNumber: number, stem: `stem ${number}` }]
                    }) } }] }) };
                } } });
        assert.equal(calls, 3);
        assert.deepEqual(result.questions.map(q => q.question), ['1', '3']);
        assert.ok(result.withheld.some(w => w.errorCode === 'MALFORMED_MODEL_RESPONSE'
            && w.questionNumbers[0] === '2'));
    } finally { Inspection.inspect = inspect; }
});

test('proxy upstream failure stops later regions in the file', async () => {
    const inspect = Inspection.inspect;
    let calls = 0;
    try {
        const pages = [page(1, [line('1. First', 100), line('2. Second', 300)], 'mixed'),
            page(2, [line('3. Third', 100)], 'mixed')];
        Inspection.inspect = async () => ({ pages, ...Inspection.segment(pages), timings: [] });
        const result = await Ingestion.ingest({ file: { id: 'upstream-failure' }, questionRole: true,
            helpers: { model: 'upstream-failure-mock', parseQuestions: () => [],
                render: async (_, pageNo, __, region) => ({ url: `page-${pageNo}-${region?.[1] || 'whole'}` }),
                request: async () => {
                    calls++;
                    throw Object.assign(Error('DashScope upstream request failed.'), { code: 'AI_PROXY_FETCH_FAILED' });
                } } });
        assert.equal(calls, 1, 'an unreachable upstream must not spend the remaining region budget');
        assert.equal(result.visualCalls, 1);
        assert.ok(result.withheld.some(item => item.errorCode === 'AI_PROXY_FETCH_FAILED'));
        assert.equal(result.pageImages.length, 2, 'both original pages remain available for review');
    } finally { Inspection.inspect = inspect; }
});

test('visual maxCalls stops further requests and leaves remaining regions withheld', async () => {
    const inspect = Inspection.inspect;
    let calls = 0;
    try {
        const pages = [page(1, [line('1. First', 100), line('2. Second', 300)], 'mixed')];
        Inspection.inspect = async () => ({ pages, ...Inspection.segment(pages), timings: [] });
        const result = await Ingestion.ingest({ file: { id: 'budget' }, questionRole: true,
            helpers: { model: 'budget-mock', maxCalls: 1, parseQuestions: () => [],
                render: async (_, __, ___, region) => ({ url: `budget-${region?.[1] || 'page'}` }),
                request: async payload => {
                    calls++;
                    const number = (/第 (\d+) 题/.exec(payload.messages[0].content[0].text) || [])[1];
                    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({
                        questions: [{ questionNumber: number, stem: `stem ${number}` }]
                    }) } }] }) };
                } } });
        assert.equal(calls, 1);
        assert.ok(result.withheld.some(item => item.errorCode === 'VISUAL_CALL_BUDGET_EXCEEDED'
            && item.questionNumbers[0] === '2'));
    } finally { Inspection.inspect = inspect; }
});

test('a proved cross-page question sends both regions without the next question or heading', async () => {
    const inspect = Inspection.inspect;
    const calls = [];
    try {
        const pages = [page(1, [line('6. Stem on first page', 700)], 'mixed'),
            page(2, [line('A. continued option', 45), line('二、多项选择题', 180),
                line('7. Next question', 230)], 'mixed')];
        Inspection.inspect = async () => ({ pages, ...Inspection.segment(pages), timings: [] });
        const q6 = Inspection.segment(pages).blocks[0];
        assert.equal(q6.regionByPage.length, 2);
        assert.ok(q6.regionByPage[1].bbox[3] < 180);
        const result = await Ingestion.ingest({ file: { id: 'cross-region' }, questionRole: true,
            helpers: { model: 'cross-region-mock', parseQuestions: () => [],
                render: async (_, pageNo, __, region) => ({ url: `${pageNo}:${region?.[1] || 'page'}` }),
                request: async payload => {
                    calls.push(payload.messages[0].content);
                    const number = (/第 (\d+) 题/.exec(payload.messages[0].content[0].text) || [])[1];
                    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({
                        questions: [{ questionNumber: number, stem: `stem ${number}` }]
                    }) } }] }) };
                } } });
        assert.equal(calls[0].length, 3, 'q6 request has two page crops');
        assert.deepEqual(result.questions.map(q => q.question), ['6', '7']);
    } finally { Inspection.inspect = inspect; }
});

test('one PDF ingest opens the document once and rasterises a page once for several regions', async () => {
    const inspect = Inspection.inspect;
    const originals = { fetch: global.fetch, pdfjsLib: global.pdfjsLib, document: global.document };
    let opens = 0;
    let renders = 0;
    let destroyed = 0;
    const canvases = [];
    try {
        const pages = [page(1, [line('1. First', 100), line('2. Second', 300)], 'mixed')];
        Inspection.inspect = async () => ({ pages, ...Inspection.segment(pages), timings: [] });
        global.fetch = async () => ({ arrayBuffer: async () => new Uint8Array([1, 2]).buffer });
        global.pdfjsLib = { getDocument: () => {
            opens++;
            return { promise: Promise.resolve({ getPage: async () => ({
                getViewport: ({ scale }) => ({ width: 600 * scale, height: 840 * scale }),
                render: () => { renders++; return { promise: Promise.resolve(), cancel() {} }; },
                cleanup() {}
            }), destroy: async () => { destroyed++; } }), destroy: async () => {} };
        } };
        global.document = { createElement: () => {
            const canvas = { width: 0, height: 0, getContext: () => ({ drawImage() {} }),
                toDataURL() { return `raster-${this.width}x${this.height}`; } };
            canvases.push(canvas);
            return canvas;
        } };
        await Ingestion.ingest({ file: { id: 'render-count', uploadPath: 'mock-pdf' }, questionRole: true,
            helpers: { model: 'render-count-mock', parseQuestions: () => [],
                request: async payload => {
                    const number = (/第 (\d+) 题/.exec(payload.messages[0].content[0].text) || [])[1];
                    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({
                        questions: [{ questionNumber: number, stem: `stem ${number}` }]
                    }) } }] }) };
                } } });
        assert.equal(opens, 1);
        assert.equal(renders, 1);
        assert.equal(destroyed, 1);
        assert.ok(canvases.every(canvas => canvas.width === 0 && canvas.height === 0));
    } finally { Inspection.inspect = inspect; Object.assign(global, originals); }
});

// With a box per question, the request carries one question and one number: the model cannot mix two
// questions up, and the number it returns is only ever the one the text layer proved.
test('a page with per-question boxes is transcribed one question at a time', async () => {
    const inspect = Inspection.inspect;
    const asked = [];
    try {
        const mixed = [page(1, [line('1. First question', 120), line('2. Second question', 400)], 'mixed')];
        mixed[0].anchors = Inspection.collectAnchors(mixed[0]);
        Inspection.inspect = async () => ({ pages: mixed, ...Inspection.segment(mixed), timings: [] });
        const result = await Ingestion.ingest({ file: { id: 'region-calls' }, questionRole: true, helpers: {
            model: 'region-mock',
            parseQuestions: () => [], parseSupport: () => ({}),
            render: async (file, pageNo, trace, region) => ({ url: `crop-${region ? region[1] : 'whole'}`, region }),
            request: async payload => {
                const text = payload.messages[0].content[0].text;
                const number = (/这是第\s*(\d+)\s*题/.exec(text) || [])[1] || '?';
                asked.push(text.includes('所在的图片区域') ? `region:${number}` : 'whole-page');
                return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({
                    questions: [{ questionNumber: number, stem: `stem ${number}`, options: [], answer: '', solution: '' }]
                }) } }] }) };
            }
        } });

        assert.deepEqual(asked, ['region:1', 'region:2'], 'one request per question, with its own number');
        assert.deepEqual(result.questions.map(q => q.question), ['1', '2']);
        assert.equal(result.visualCalls, 2);
        assert.equal(result.withheld.some(w => w.visualNeeded), false,
            'every question of the page was transcribed, so nothing is left to review');
    } finally { Inspection.inspect = inspect; }
});

// The owner's rule of 2026-09-17: a gap in the numbering must not take the whole file's identity away.
// The numbers the text proved stay usable, the hole is reported, and a duplicate / backward / unreadable
// anchor is recorded on its own. (This test used to require `authoritative: false` for all three shapes.)
test('PDF contracts keep safe segments, report the gap, and record bad anchors', () => {
    const byGap = Ingestion.contract(['1', '2', '3', '5', '6'].map(question => ({ question })));
    assert.deepEqual(byGap.segments, [['1', '2', '3'], ['5', '6']], 'the proved runs stay usable');
    assert.deepEqual(byGap.missing, ['4'], 'the hole is named, never guessed');
    assert.deepEqual(byGap.questionNumbers, ['1', '2', '3', '5', '6']);
    assert.equal(byGap.authoritative, true);

    const duplicate = Ingestion.contract(['1', '1'].map(question => ({ question })));
    assert.deepEqual(duplicate.questionNumbers, ['1'], 'a repeated anchor is not published twice');
    assert.deepEqual(duplicate.conflicts, [{ number: '1', reason: 'duplicate-question-number' }]);

    const backward = Ingestion.contract(['2', '1'].map(question => ({ question })));
    assert.deepEqual(backward.questionNumbers, ['2'], 'a number that goes backwards is recorded, not trusted');
    assert.deepEqual(backward.conflicts, [{ number: '1', reason: 'question-number-not-increasing' }]);

    const unknown = Ingestion.contract(['1', 'x'].map(question => ({ question })));
    assert.deepEqual(unknown.questionNumbers, ['1']);
    assert.deepEqual(unknown.conflicts, [{ number: 'x', reason: 'unknown-question-number' }]);

    const none = Ingestion.contract([].map(question => ({ question })));
    assert.equal(none.authoritative, false, 'nothing proved means nothing to publish');

    // A model number is never allowed to authorize a row on its own.
    for (const values of [['1', '3'], ['1', '1'], ['2', '1']]) assert.ok(Ingestion.acceptVisual(values.map(question => ({ question, stem: 'text' })), ['1', '2']).reason);
    const blank = Ingestion.acceptVisual([{ question: '1', stem: '' }], ['1']);
    assert.deepEqual(blank.missing, ['1']);
});

test('PDF support still uses fail-closed sequence and field-level answer rejection', () => {
    const drafts = ['1', '2', '3'].map(question => ({ question, type: '单选题', options: ['x', 'x', 'y', 'z'] }));
    const rows = ['1', '3', '2'].map(question => ({ question, answer: 'A', solution: 'Here is a sufficiently detailed derivation of the answer.' }));
    const bad = Ingestion.gateSupport(rows, rows, ['1', '2', '3'], drafts);
    assert.ok(bad.answers.every(a => a.question === '1'));
    assert.ok(bad.solutions.every(a => a.question === '1'));
    const ambiguous = [{ question: '1', answer: 'x', solution: 'Here is a sufficiently detailed derivation of the answer.' }];
    const safe = Ingestion.gateSupport(ambiguous, ambiguous, ['1'], drafts);
    assert.equal(safe.answers.length, 0);
});

test('PDF pure-text ingestion requires no renderer or paid service; failed transport preserves page evidence', async () => {
    const inspect = Inspection.inspect;
    let calls = 0;
    try {
        const p = page(1, [line('1. A sufficiently long ordinary question')]);
        Inspection.inspect = async () => ({ pages: [p], ...Inspection.segment([p]), timings: [] });
        const helpers = { parseQuestions: () => [{ question: '1', stem: 'Question', answer: 'UNTRUSTED' }], parseSupport: () => ({}) };
        const text = await Ingestion.ingest({ file: { id: 'pure' }, questionRole: true, helpers });
        assert.equal(text.questions.length, 1); assert.equal(text.visualCalls, 0); assert.equal(text.questions[0].answer, '');
        const mixed = [page(1, [line('1. First mixed question')], 'mixed'), page(2, [line('2. Second mixed question')], 'mixed')];
        Inspection.inspect = async () => ({ pages: mixed, blocks: [], withheld: [], timings: [] });
        const failed = await Ingestion.ingest({ file: { id: 'mixed' }, questionRole: true, helpers: {
            ...helpers, model: 'mock-only', render: async () => ({ url: 'data:image/jpeg;base64,AA==' }),
            request: async () => { calls++; throw Object.assign(Error('denied'), { code: 'API_AUTH_ERROR' }); }
        } });
        assert.equal(calls, 1); assert.equal(failed.questions.length, 0); assert.equal(failed.pageImages.length, 2);
        assert.equal(failed.withheld.length, 2); assert.ok(failed.withheld.every(w => w.errorCode === 'API_AUTH_ERROR'));
    } finally { Inspection.inspect = inspect; }
});

test('successful visual transcription is cached, cannot sneak in answers, and cannot claim a cross-page question', async () => {
    const inspect = Inspection.inspect;
    let calls = 0;
    try {
        const pages = [page(1, [line('1. First question')], 'mixed'),
            page(2, [line('A. continuation of options'), line('2. Next question', 200)], 'mixed')];
        Inspection.inspect = async () => ({ pages, blocks: [], withheld: [], timings: [] });
        const helpers = { model: 'successful-mock', render: async (_, n) => ({ url: 'synthetic-page-' + n }),
            request: async payload => {
                calls++;
                const question = payload.messages[0].content[1].image_url.url.endsWith('1') ? '1' : '2';
                return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ questions: [
                    { question, stem: 'A complete looking transcription', options: ['one', 'two', 'three', 'four'], answer: 'A', solution: 'Unverified' }
                ] }) } }] }) };
            }
        };
        for (let i = 0; i < 2; i++) {
            const result = await Ingestion.ingest({ file: { id: 'cache-' + i }, questionRole: true, helpers });
            assert.deepEqual(result.questions.map(q => q.question), ['2']);
            assert.equal(result.questions[0].answer, ''); assert.equal(result.questions[0].solution, '');
            assert.ok(result.withheld.some(w => w.reason === 'cross-page-visual-block'));
            assert.equal(result.cacheHits, i ? 2 : 0);
            assert.equal(result.questions[0].fieldEvidence.stem.sourceFileId, 'cache-' + i);
        }
        assert.equal(calls, 2);
    } finally { Inspection.inspect = inspect; }
});

// The first authorised real vision call (2026-09-16, 简略版题目（只有一页）.pdf) came back as something
// the reader could not parse, and the failure said only "not a valid question structure": the model's
// own text was thrown away with the error, so nothing could tell a truncated JSON reply apart from a
// refusal. A model answer that cannot be read as the requested structure is evidence like any other,
// and a bounded head of it now travels with the withheld page.
test('a visual answer that cannot be parsed keeps the model text as evidence', async () => {
    const inspect = Inspection.inspect;
    try {
        const pages = [page(1, [line('1. First question')], 'mixed')];
        Inspection.inspect = async () => ({ pages, blocks: [], withheld: [], timings: [] });
        const result = await Ingestion.ingest({ file: { id: 'malformed' }, questionRole: true, helpers: {
            model: 'malformed-mock', render: async () => ({ url: 'data:image/jpeg;base64,AA==' }),
            request: async () => ({ ok: true, json: async () => ({
                choices: [{ message: { content: 'I cannot read this page, here is a description instead.' } }]
            }) })
        } });

        assert.equal(result.questions.length, 0);
        const withheld = result.withheld.find(w => w.errorCode === 'MALFORMED_MODEL_RESPONSE');
        assert.ok(withheld, `expected a malformed-response entry, saw ${JSON.stringify(result.withheld)}`);
        assert.match(String(withheld.rawEvidence), /cannot read this page/,
            'the model text must survive the failure');
        assert.deepEqual(withheld.questionNumbers, ['1'], 'the page keeps the numbers the text layer proved');
    } finally { Inspection.inspect = inspect; }
});

// The real reply of that first authorised call started exactly like the requested structure and was
// fenced in ```json; a reply can also be cut off by the token budget in the middle of the array. Both
// shapes are read now - every complete item, nothing invented - and the numbers still have to match the
// page's own text layer.
test('a fenced or cut-off visual reply keeps its complete items', async () => {
    const inspect = Inspection.inspect;
    const first = { questionNumber: '1', stem: 'First question', options: ['A', 'B', 'C', 'D'], answer: '', solution: '' };
    try {
        const pages = [page(1, [line('1. First question'), line('2. Second question', 200)], 'mixed')];
        Inspection.inspect = async () => ({ pages, blocks: [], withheld: [], timings: [] });

        const cases = [
            ['```json\n' + JSON.stringify({ questions: [first, { ...first, questionNumber: '2', stem: 'Second question' }] }) + '\n```', ['1', '2']],
            ['```json\n' + JSON.stringify({ questions: [first] }).slice(0, -2) + ',{"questionNumber":"2","stem":"Sec', ['1']],
            // The shape of the real reply: every stem carries LaTeX braces, and the array stops in the
            // middle of an item, so "cut at the last }" is not the same as "cut at an item boundary".
            ['{"questions":[{"questionNumber":"1","stem":"已知 $\\left\\{ x \\mid x = \\sin \\frac{n\\pi}{2} \\right\\}$，则（　　）",'
                + '"options":["A. $A = \\{0, 1\\}$"],"answer":"B","solution":""},{"questionNumber":"2","stem":"正四棱台的上、下底面的边长分别为 $2$，$8$', ['1']],
            // The same LaTeX but a complete reply: every item is read, and the backslashes survive as the
            // model wrote them.
            ['{"questions":[{"questionNumber":"1","stem":"已知 $\\left\\{ x \\mid x = \\sin \\frac{n\\pi}{2} \\right\\}$",'
                + '"options":["A. $\\\\frac{1}{2}$"],"answer":"B","solution":""},'
                + '{"questionNumber":"2","stem":"正四棱台的上、下底面的边长分别为 $2$，$8$","options":[],"answer":"C","solution":""}]}',
                ['1', '2']]
        ];
        for (const [index, [content, expected]] of cases.entries()) {
            const result = await Ingestion.ingest({ file: { id: 'fenced' }, questionRole: true, helpers: {
                // A fresh model name per shape: the page cache is keyed by the rendered image and the
                // model, and a cached reply would hide the parse this test is about.
                model: `fenced-mock-${index}`, render: async () => ({ url: 'data:image/jpeg;base64,AA==' }),
                request: async () => ({ ok: true, json: async () => ({ choices: [{ message: { content } }] }) })
            } });
            assert.deepEqual(result.questions.map(q => q.question), expected,
                `only the item whose number the page proves is read: ${content.slice(0, 40)}`);
            assert.equal(result.questions[0].fieldEvidence.stem.source, 'pdf-vision');
            if (expected.length < 2) {
                assert.ok(result.withheld.some(w => w.reason === 'missing-visual-question'),
                   'the item that never arrived stays withheld');
            }
        }
    } finally { Inspection.inspect = inspect; }
});

// The teacher's real case: 完整版题目.pdf is two "mixed" pages (the formula glyphs cannot be mapped), the
// visual service was unreachable, and the whole file produced **0 题**. The readable text of a mixed page
// is now kept as a safe partial draft while the page is still listed for visual review.
test('a mixed page keeps the text it can read when the visual service is unavailable', async () => {
    const inspect = Inspection.inspect;
    try {
        const mixed = [page(1, [line('1. A sufficiently long ordinary question')], 'mixed')];
        Inspection.inspect = async () => ({ pages: mixed, ...Inspection.segment(mixed), timings: [] });
        const result = await Ingestion.ingest({ file: { id: 'mixed-partial' }, questionRole: true, helpers: {
            parseQuestions: () => [{ question: '1', stem: 'A sufficiently long ordinary question' }],
            parseSupport: () => ({})
        } });

        assert.deepEqual(result.questions.map(q => q.question), ['1'],
            'the text of a mixed page still makes a draft');
        assert.equal(result.visualCalls, 0);
        assert.ok(result.withheld.some(w => w.sourcePage === 1 && w.visualNeeded),
            'the page is still listed as needing visual review');
    } finally { Inspection.inspect = inspect; }
});

test('an unresolved PDF glyph gap stays visible with a teacher-facing warning', async () => {
    const inspect = Inspection.inspect;
    try {
        const pages = [page(1, [line('1. 前文 \uf02b 后文')], 'mixed')];
        Inspection.inspect = async () => ({ pages, ...Inspection.segment(pages), timings: [] });
        const result = await Ingestion.ingest({ file: { id: 'glyph-gap' }, questionRole: true,
            helpers: { parseQuestions: text => [{ question: '1', stem: text }], parseSupport: () => ({}) } });
        assert.match(result.questions[0].stem, /前文 \[\[PDF_UNMAPPED\]\] 后文/);
        assert.ok(result.questions[0].warnings.some(warning => warning.includes('此处公式需视觉补全')));
    } finally { Inspection.inspect = inspect; }
});
