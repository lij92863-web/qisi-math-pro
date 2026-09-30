const test = require('node:test');
const assert = require('node:assert/strict');
const boundary = require('../qisi-pdf-question-boundary');
const row = (q, top, extra = {}) => ({ questionNumber: String(q), type: '解答题',
    stem: `第${q}题原始题干`, question_bbox: [100, top, 900, Math.min(top + 100, 950)], ...extra });
const pages = [1, 2, 3].map(pageNo => ({ pageNo, url: `page-${pageNo}` }));
const input = () => ({ pages: pages.slice(0, 2), pageResults: [[row(16, 764)],
    [{ questionNumber: '(1)(2)', stem: '后续表格和两个小问' }, row(17, 747)]] });

test('adjacent page tail owns one repair while unnumbered continuation remains evidence', () => {
    const plan = boundary.planQuestionBoundaries(input());
    assert.equal(plan.plans.length, 1);
    assert.equal(plan.plans[0].question, 16);
    assert.deepEqual(plan.items.map(x => x.questionNumber), ['16', '17']);
    assert.equal(plan.fragments[0].item.questionNumber, '(1)(2)');
});

test('choice split and explicit fragment trigger but normal pages make no extra request', () => {
    assert.equal(boundary.planQuestionBoundaries({ pages: pages.slice(0, 2),
        pageResults: [[row(10, 659, { type: '多选题', options: ['A', 'B'] })], [row(11, 152)]]
    }).plans.length, 1);
    assert.equal(boundary.planQuestionBoundaries({ pages: pages.slice(0, 2),
        pageResults: [[row(17, 747, { recognitionRaw: { isFragment: true } })], [row(18, 612)]]
    }).plans.length, 1);
    assert.equal(boundary.planQuestionBoundaries({ pages: pages.slice(0, 2),
        pageResults: [[row(18, 612)], [row(19, 150)]] }).plans.length, 0);
});

test('duplicate, gaps, jump-back, physical reorder and page gaps never stitch', () => {
    for (const number of [16, 15, 18]) {
        const value = input(); value.pageResults[1] = [row(number, 747)];
        assert.equal(boundary.planQuestionBoundaries(value).plans.length, 0);
    }
    assert.equal(boundary.planQuestionBoundaries({ pages: [pages[1], pages[0]],
        pageResults: input().pageResults }).plans.length, 0);
    assert.equal(boundary.planQuestionBoundaries({ pages: [pages[0], pages[2]],
        pageResults: input().pageResults }).plans.length, 0);
    assert.equal(boundary.planQuestionBoundaries({ pages: pages.slice(0, 2),
        pageResults: [[row(15, 800), row(16, 600)], [row(17, 747)]] }).plans.length, 0);
});

test('repair requires same anchored question and bounding region spanning both image bands', () => {
    const plan = boundary.planQuestionBoundaries(input()).plans[0];
    const composite = { url: 'composite', splitY: 300 };
    const repair = row(16, 0, { stem: '完整题干、表格与两个小问', question_bbox: [80, 0, 950, 900] });
    const result = boundary.acceptBoundaryResult(plan, composite, [repair]);
    assert.equal(result.sourcePageImage, 'composite');
    assert.deepEqual(result.sourcePages, [1, 2]);
    assert.equal(result.sourceTrace.boundary.original, plan.target);
    assert.equal(result.sourceTrace.boundary.continuationEvidence.length, 1);
    for (const bad of [[], [repair, repair], [{ ...repair, questionNumber: '17' }],
        [{ ...repair, isFragment: true }], [{ ...repair, question_bbox: [80, 400, 950, 900] }],
        [{ ...repair, question_bbox: [80, 0, 950, 290] }],
        [{ ...repair, question_bbox: [80, 100, 950, 900] }]]) {
        assert.equal(boundary.acceptBoundaryResult(plan, composite, bad), null);
    }
});

test('incomplete repaired choices remain original with warning', async () => {
    const data = { pages: pages.slice(0, 2), pageResults: [[row(10, 659,
        { type: '多选题', options: ['A', 'B'] })], [row(11, 152)]] };
    let calls = 0;
    const result = await boundary.reconstructQuestionBoundaries(data, {
        composeBoundaryImage: async () => ({ url: 'composite', splitY: 600 }),
        recognizePage: async () => { calls++; return [row(10, 0,
            { type: '多选题', options: ['A', 'B'], question_bbox: [80, 0, 950, 900] })]; }
    });
    assert.equal(calls, 1);
    assert.deepEqual(result.items[0].options, ['A', 'B']);
    assert.equal(result.items[0].warnings.length, 1);
    assert.equal(result.diagnostics[0].accepted, false);
});

test('fatal network errors and cancellation escape instead of triggering retries', async () => {
    let calls = 0;
    await assert.rejects(boundary.reconstructQuestionBoundaries(input(), {
        composeBoundaryImage: async () => ({ url: 'composite', splitY: 300 }),
        recognizePage: async () => { calls++; throw Object.assign(Error('fatal'), { code: 'FATAL' }); },
        isFatalServiceError: error => error.code === 'FATAL'
    }), /fatal/);
    assert.equal(calls, 1);
    await assert.rejects(boundary.reconstructQuestionBoundaries({ ...input(), signal: { aborted: true } }, {
        recognizePage: () => assert.fail('cancelled request must not run')
    }), { name: 'AbortError' });
});

test('canvas composition crops original page bands without changing coordinate ownership', async () => {
    const draw = [];
    class Image { naturalWidth = 1000; naturalHeight = 1400;
        set src(value) { this.url = value; queueMicrotask(() => this.onload()); } }
    const canvas = { getContext: () => ({ fillRect() {}, drawImage: (...args) => draw.push(args) }),
        toDataURL: () => 'data:image/jpeg;base64,composite' };
    const plan = boundary.planQuestionBoundaries(input()).plans[0];
    const result = await boundary.composeBoundaryImage(plan, {
        Image, document: { createElement: () => canvas }
    });
    assert.equal(draw.length, 2);
    assert.equal(draw[0][0].url, 'page-1');
    assert.equal(draw[1][0].url, 'page-2');
    assert.equal(draw[0][2], 1400 * plan.leftTop / 1000);
    assert.equal(draw[1][4], 1400 * plan.rightBottom / 1000);
    assert.equal(canvas.height, draw[0][8] + draw[1][8]);
    assert.equal(result.splitY, draw[0][8] / canvas.height * 1000);
});
