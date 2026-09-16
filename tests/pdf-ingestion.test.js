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

test('PDF contracts reject gaps, duplicates and reversal; model numbers alone cannot authorize a row', () => {
    for (const values of [['1', '3'], ['1', '1'], ['2', '1']]) assert.equal(Ingestion.contract(values.map(question => ({ question }))).authoritative, false);
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
