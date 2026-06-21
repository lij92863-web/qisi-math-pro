const test = require('node:test'); const assert = require('node:assert/strict');
const { createAppFacade } = require('../qisi-app-facade.js');
const { normalizeDocxPipelineResult } = require('../qisi-docx-pipeline.js');
const { normalizePdfPipelineResult } = require('../qisi-pdf-safe-partial-pipeline.js');
const { normalizeBatchImportInput, summarizeBatchImportResult } = require('../qisi-batch-orchestrator.js');
const { summarizeDraftStatus } = require('../qisi-review-draft-state.js');
const { buildReviewViewModel } = require('../qisi-review-view-model.js');
const { classifyFileType, buildDispatchPlan } = require('../qisi-file-dispatcher.js');

test('BM13: all facades load and are callable', () => { const f = createAppFacade({}); assert.ok(f); assert.ok(normalizeDocxPipelineResult([],[],[])); assert.ok(normalizePdfPipelineResult({ answerQuestionNumbers: ['1'], warnings: [] })); assert.ok(normalizeBatchImportInput([])); assert.ok(summarizeBatchImportResult([])); assert.ok(summarizeDraftStatus([])); assert.ok(buildReviewViewModel({ question: '1' }, 0)); assert.equal(classifyFileType('a.docx'), 'docx'); assert.ok(buildDispatchPlan([{ name: 'q.docx' }])); });
test('BM13: DOCX pipeline facade is functional', () => { const r = normalizeDocxPipelineResult([{q:'1'}], [{q:'1',a:'A'}], [{q:'1',s:'S'}]); assert.equal(r.mode, 'full'); });
test('BM13: PDF safe partial facade enforces invariants', () => { const r = normalizePdfPipelineResult({ answerQuestionNumbers: ['1','3'], warnings: [{ questionNumber: '2' }] }); assert.ok(r.isSafePartial); assert.ok(!r.isComplete); });
test('BM13: batch orchestrator summarizes correctly', () => { const r = summarizeBatchImportResult([{ question: '1', answer: 'A' }, { question: '2' }]); assert.equal(r.missingAnswers.length, 1); });
