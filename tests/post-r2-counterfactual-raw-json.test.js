const test = require('node:test');
const assert = require('node:assert/strict');
const Contracts = require('../qisi-recognition-contracts.js');

test('Phase 3 raw JSON cannot become a structured draft', () => {
    const draft = Contracts.createStructuredQuestionDraft({
        sourceId: 'source-1', sourceOrder: 1, questionNumber: '1', type: 'single-choice',
        stem: '{"questions":[{"stem":"private","answer":"A"}]}',
        options: ['1', '2', '3', '4'], answer: 'A', solution: 'solution', images: [],
        provenance: { stem: { page: 1, engine: 'mock' } },
        confidenceByField: { stem: 0.9 }, warnings: [], rawEvidence: {}
    });
    const result = Contracts.validateStructuredQuestionDraft(draft);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => error.code === 'unsafe-wrapper'));
});
