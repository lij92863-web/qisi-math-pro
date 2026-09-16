const test = require('node:test');
const assert = require('node:assert/strict');
require('../qisi-utils.js');
const Context = require('../qisi-ingestion-context.js');
const Ingestion = require('../qisi-docx-ingestion.js');

test('a mark-sheet answer heading does not truncate questions; conflicting keys stay unmatched', async () => {
    const get = Context.getDocx;
    Context.getDocx = async () => ({ trace: Context.createTrace('synthetic') });
    let parsedText;
    try {
        const result = await Ingestion.ingest({
            file: { id: 'q' }, questionRole: true, fullRole: true,
            helpers: {
                extractText: async () => '题号\n1\n2\n答案\n1. 第一题\n2. 第二题\n参考答案\n1. A 2. B\n2. C',
                extractSkeleton: async () => ({ authoritative: true, questionNumbers: ['1', '2'] }),
                parseQuestions: text => { parsedText = text; return [{ question: '1' }, { question: '2' }]; },
                parseSupport: () => ({ answers: [{ question: '1', answer: 'A' }, { question: '2', answer: 'B' }], solutions: [] })
            }
        });
        assert.match(parsedText, /第二题/);
        assert.doesNotMatch(parsedText, /参考答案/);
        assert.deepEqual(result.answers.map(a => a.question), ['1']);
        assert.equal(result.unmatched[0].reason, 'conflicting-explicit-answers');
        assert.deepEqual(result.unmatched[0].evidence, ['B', 'C']);
    } finally { Context.getDocx = get; }
});

test('unsupported picture evidence is visible and rejects only the affected fields', () => {
    const draft = { stem: '见图 [[IMAGE_UNRESOLVED:rId4]]', options: ['a', 'b'], answer: 'A' };
    Ingestion.markImageGaps(draft);
    assert.equal(draft.withheld, true);
    assert.equal(draft.fieldProvenance.stem.status, 'rejected');
    assert.equal(draft.fieldProvenance.answer, undefined);
    assert.equal(draft.answer, 'A');
});
