const test = require('node:test'); const assert = require('node:assert/strict');
const { normalizeBatchImportInput, summarizeBatchImportResult } = require('../qisi-batch-orchestrator.js');
test('BM06: normalize input', () => { const r = normalizeBatchImportInput([{ name: 'a.docx', size: 10 }]); assert.equal(r[0].name, 'a.docx'); });
test('BM06: summarize result', () => { const r = summarizeBatchImportResult([{ question: '1', answer: 'A' }, { question: '2' }]); assert.equal(r.total, 2); assert.equal(r.withAnswers, 1); assert.deepEqual(r.missingAnswers, ['2']); });
