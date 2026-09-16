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

    assert.deepEqual(blocks[0].regionByPage, [{ page: 1, bbox: [90, 100, 500, 142] }],
        'the question region is the union of its lines, without the footer');
    assert.deepEqual(blocks[1].regionByPage, [{ page: 2, bbox: [90, 190, 500, 202] }]);
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
        assert.deepEqual(withheld.region, [90, 120, 500, 412], 'the page plan carries the question band');
        assert.ok(withheld.region[3] - withheld.region[1] < mixed[0].height, 'not the whole page');
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
