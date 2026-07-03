const test = require('node:test'); const assert = require('node:assert/strict');
const { normalizePdfPipelineResult, assertSafePartialInvariants, attachPdfPageTrace, attachSinglePdfPageTrace } = require('../qisi-pdf-safe-partial-pipeline.js');
test('BM12: safe partial mode', () => { const r = normalizePdfPipelineResult({ answerQuestionNumbers: ['1','3','4'], warnings: [{ questionNumber: '2' }], solutionQuestionNumbers: ['1','2','3','4'] }); assert.equal(r.mode, 'safe-partial'); assert.ok(r.isSafePartial); assert.ok(!r.isComplete); assert.ok(r.requiresManualReview); });
test('BM12: invariant enforced', () => { const r = normalizePdfPipelineResult({ answerQuestionNumbers: ['1'], warnings: [] }); assert.ok(r.isSafePartial); assert.throws(() => assertSafePartialInvariants({ isComplete: true })); });

/* BMR8: attachPdfPageTrace */
test('BMR8: attachPdfPageTrace attaches trace to array of items', () => {
    const file = { id: 'f1', filename: 'test.pdf' };
    const items = [{ question: '1+1=?', answer: '2' }];
    const result = attachPdfPageTrace(items, file, 3, 'http://img/page3.png', 'raw page 3 text');
    assert.equal(result.length, 1);
    assert.equal(result[0].sourceFileId, 'f1');
    assert.equal(result[0].sourceFileName, 'test.pdf');
    assert.equal(result[0].sourcePage, 3);
    assert.equal(result[0].pageIndex, 3);
    assert.equal(result[0].sourcePageImage, 'http://img/page3.png');
    // rawText field is from item.rawText || item.rawBlock || item.stem, not the rawText arg
    assert.equal(result[0].rawText, '');
    assert.equal(result[0].sourceTrace.sourceFileId, 'f1');
    assert.equal(result[0].sourceTrace.sourcePage, 3);
    assert.equal(result[0].sourceTrace.pageText, 'raw page 3 text');
});

test('BMR8: attachPdfPageTrace preserves existing fields', () => {
    const file = { id: 'f1', filename: 'test.pdf' };
    const items = [{ question: 'x', sourceFileId: 'old-id', stem: 'original stem' }];
    const result = attachPdfPageTrace(items, file, 5, 'http://img/p5.png', '');
    assert.equal(result[0].sourceFileId, 'old-id');
    assert.equal(result[0].rawText, 'original stem');
});

test('BMR8: attachPdfPageTrace handles empty and null items', () => {
    const file = { id: 'f1', filename: 't.pdf' };
    assert.deepEqual(attachPdfPageTrace([], file, 1, 'u', 't'), []);
    assert.deepEqual(attachPdfPageTrace(null, file, 1, 'u', 't'), []);
});

test('BMR8: attachPdfPageTrace uses rawBlock and stem fallbacks for rawText', () => {
    const file = { id: 'f1', filename: 't.pdf' };
    const items = [{ question: 'q', rawBlock: 'block-text' }];
    const result = attachPdfPageTrace(items, file, 1, 'u', '');
    assert.equal(result[0].rawText, 'block-text');
    const items2 = [{ question: 'q', stem: 'stem-text' }];
    const result2 = attachPdfPageTrace(items2, file, 1, 'u', '');
    assert.equal(result2[0].rawText, 'stem-text');
});

/* BMR8: attachSinglePdfPageTrace */
test('BMR8: attachSinglePdfPageTrace attaches trace to single item', () => {
    const file = { id: 'f1', filename: 'test.pdf' };
    const item = { question: '2+2=?', answer: '4' };
    const result = attachSinglePdfPageTrace(item, file, 2, 'http://img/page2.png', 'page 2 text');
    assert.equal(result.sourceFileId, 'f1');
    assert.equal(result.sourceFileName, 'test.pdf');
    assert.equal(result.sourcePage, 2);
    assert.equal(result.pageIndex, 2);
    assert.equal(result.sourcePageImage, 'http://img/page2.png');
    assert.equal(result.pageText, 'page 2 text');
    assert.equal(result.sourceText, 'page 2 text');
    assert.equal(result.sourceTrace.sourceFileId, 'f1');
    assert.equal(result.sourceTrace.sourcePage, 2);
    assert.equal(result.sourceTrace.pageText, 'page 2 text');
});

test('BMR8: attachSinglePdfPageTrace preserves existing fields', () => {
    const file = { id: 'f1', filename: 'test.pdf' };
    const item = { question: 'q', sourceFileId: 'existing', pageText: 'old-text' };
    const result = attachSinglePdfPageTrace(item, file, 7, 'http://img/p7.png', 'new-text');
    assert.equal(result.sourceFileId, 'existing');
    assert.equal(result.pageText, 'old-text');
});

test('BMR8: attachSinglePdfPageTrace handles null/undefined item', () => {
    const file = { id: 'f1', filename: 't.pdf' };
    const result = attachSinglePdfPageTrace(null, file, 1, 'u', 't');
    assert.equal(result.sourceFileId, 'f1');
    assert.equal(result.sourcePage, 1);
});

test('BMR8: attachSinglePdfPageTrace preserves existing sourceTrace fields', () => {
    const file = { id: 'f1', filename: 't.pdf' };
    const item = { sourceTrace: { sourceFileId: 'old', rawBlock: 'old-block' } };
    const result = attachSinglePdfPageTrace(item, file, 4, 'http://img/p4.png', 'text');
    assert.equal(result.sourceTrace.sourceFileId, 'old');
    assert.equal(result.sourceTrace.rawBlock, 'old-block');
    assert.equal(result.sourceTrace.pageText, 'text');
});
