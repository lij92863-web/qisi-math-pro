const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Policy = require('../qisi-formal-admission-policy.js');
const Validation = require('../qisi-production-review-validator.js');
const { createReviewController } = require('../qisi-review-controller.js');

test('Phase 3 confirm-only attack cannot accept a rejected AI field', () => {
    const provenance = Object.fromEntries(Policy.FORMAL_FIELDS.map(field => [field,
        field === 'images' ? { status: 'missing' } : { status: 'controlled-write', sourceId: 'pdf-1', controlledWriteAccepted: true, controlledWriteDecisionId: `cw-${field}` }
    ]));
    provenance.answer = { status: 'rejected', reasonCode: 'wrong-ownership' };
    const draft = {
        id: 'd1', version: 1, status: 'pending', questionNumber: '1', type: '解答题',
        stem: 'stem', options: [], answer: 'A', solution: 'solution', images: [],
        source: { mode: 'pdf-ai', sourceId: 'pdf-1', batchId: 'b1' }, fieldProvenance: provenance
    };
    const validator = Validation.createProductionReviewValidator({ policy: Policy, clock: () => Date.parse('2026-07-13T00:00:00Z') });
    const result = createReviewController({ validateDraft: value => validator.validate(value) }).confirm(draft);
    assert.equal(result.accepted, false);
    assert.equal(result.draft.status, 'pending');
    assert.equal(result.draft.fieldProvenance.answer.status, 'rejected');
    assert.ok(result.validation.errors.some(error => error.code === 'admission-field-rejected'));
});

test('Phase 3 matrix records rejected AI field only confirm', () => {
    const matrix = fs.readFileSync(path.resolve(__dirname, '..', 'docs/testing/POST_R2_COUNTERFACTUAL_MATRIX_R1.md'), 'utf8');
    assert.match(matrix, /\| rejected AI field only confirm \|[^\n]+\| PASS \|/);
});
