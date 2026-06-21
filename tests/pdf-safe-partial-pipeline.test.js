const test = require('node:test'); const assert = require('node:assert/strict');
const { normalizePdfPipelineResult, assertSafePartialInvariants } = require('../qisi-pdf-safe-partial-pipeline.js');
test('BM12: safe partial mode', () => { const r = normalizePdfPipelineResult({ answerQuestionNumbers: ['1','3','4'], warnings: [{ questionNumber: '2' }], solutionQuestionNumbers: ['1','2','3','4'] }); assert.equal(r.mode, 'safe-partial'); assert.ok(r.isSafePartial); assert.ok(!r.isComplete); assert.ok(r.requiresManualReview); });
test('BM12: invariant enforced', () => { const r = normalizePdfPipelineResult({ answerQuestionNumbers: ['1'], warnings: [] }); assert.ok(r.isSafePartial); assert.throws(() => assertSafePartialInvariants({ isComplete: true })); });
