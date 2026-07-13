const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Policy = require('../qisi-formal-admission-policy.js');

test('Phase 3 ownership rewind cannot enter formal admission', () => {
    const accepted = field => ({ status: 'controlled-write', sourceId: 's1', controlledWriteAccepted: true, controlledWriteDecisionId: `cw-${field}` });
    const provenance = Object.fromEntries(Policy.FORMAL_FIELDS.map(field => [field, field === 'images' ? { status: 'missing' } : accepted(field)]));
    provenance.answer = { status: 'rejected', reasonCode: 'ownership-rewind' };
    provenance.solution = { status: 'rejected', reasonCode: 'solution-ownership-rewind' };
    const draft = { id: 'd1', version: 1, questionNumber: '1', type: '解答题', stem: 'stem', options: [], answer: 'A', solution: 'rewound', images: [], source: { mode: 'pdf-ai', sourceId: 's1', batchId: 'b1' }, fieldProvenance: provenance };
    const context = Policy.createAdmissionContext({ mode: 'pdf-ai', actorId: 'teacher', explicitConfirmation: true, requestId: 'r1', idempotencyKey: 'i1', evaluatedAt: '2026-07-13T00:00:00Z', source: { sourceId: 's1', batchId: 'b1' } });
    const result = Policy.evaluateDraftAdmission(draft, context);
    assert.equal(result.accepted, false);
    assert.ok(result.errors.filter(error => error.code === 'admission-field-rejected').length >= 2);
});

test('Phase 3 matrix records ownership rewind', () => {
    const matrix = fs.readFileSync(path.resolve(__dirname, '..', 'docs/testing/POST_R2_COUNTERFACTUAL_MATRIX_R1.md'), 'utf8');
    assert.match(matrix, /\| ownership rewind \|[^\n]+\| PASS \|/);
});
