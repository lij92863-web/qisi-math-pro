const test = require('node:test'); const assert = require('node:assert/strict');
const { createAppFacade } = require('../qisi-app-facade.js');
const { normalizeDocxPipelineResult } = require('../qisi-docx-pipeline.js');
const { attachPdfPageTrace } = require('../qisi-pdf-safe-partial-pipeline.js');
const { normalizeBatchImportInput, summarizeBatchImportResult } = require('../qisi-batch-orchestrator.js');
const { summarizeDraftStatus } = require('../qisi-review-draft-state.js');
const { buildReviewViewModel } = require('../qisi-review-view-model.js');
const { classifyFileType, buildDispatchPlan } = require('../qisi-file-dispatcher.js');

test('BM13: all active facades and converted DOCX page trace are callable', () => { const f = createAppFacade({}); assert.ok(f); assert.ok(normalizeDocxPipelineResult([],[],[])); assert.ok(attachPdfPageTrace([{ question: '1' }], { id: 'converted-docx', filename: 'q.docx' }, 1, '')); assert.ok(normalizeBatchImportInput([])); assert.ok(summarizeBatchImportResult([])); assert.ok(summarizeDraftStatus([])); assert.ok(buildReviewViewModel({ question: '1' }, 0)); assert.equal(classifyFileType('a.docx'), 'docx'); assert.ok(buildDispatchPlan([{ name: 'q.docx' }])); });
test('BM13: DOCX pipeline facade is functional', () => { const r = normalizeDocxPipelineResult([{q:'1'}], [{q:'1',a:'A'}], [{q:'1',s:'S'}]); assert.equal(r.mode, 'full'); });
test('BM13: remaining PDF trace owner has no retired recognition facade', () => { const owner = require('../qisi-pdf-safe-partial-pipeline.js'); assert.deepEqual(Object.keys(owner), ['attachPdfPageTrace', 'attachSinglePdfPageTrace']); });
test('BM13: batch orchestrator summarizes correctly', () => { const r = summarizeBatchImportResult([{ question: '1', answer: 'A' }, { question: '2' }]); assert.equal(r.missingAnswers.length, 1); });
