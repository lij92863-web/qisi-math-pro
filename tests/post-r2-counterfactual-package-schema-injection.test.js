const test = require('node:test');
const assert = require('node:assert/strict');
const Policy = require('../qisi-formal-admission-policy.js');

test('Phase 3 package schema injection fails formal admission', () => {
    const provenance = Object.fromEntries(Policy.FORMAL_FIELDS.map(field => [field, field === 'images' ? { status: 'missing' } : { status: 'deterministic-source', sourceId: 'pkg-1', evidenceRef: `pkg:${field}` }]));
    const draft = { id: 'd1', version: 1, questionNumber: '1', type: '解答题', stem: 'stem', options: [], answer: 'A', solution: 'solution', images: [], source: { mode: 'imported-package', sourceId: 'pkg-1' }, fieldProvenance: provenance };
    const context = Policy.createAdmissionContext({ mode: 'imported-package', actorId: 'teacher', explicitConfirmation: true, requestId: 'r1', idempotencyKey: 'i1', evaluatedAt: '2026-07-13T00:00:00Z', packageSchemaValid: false, source: { sourceId: 'pkg-1', packageHash: 'forged' } });
    const result = Policy.evaluateDraftAdmission(draft, context);
    assert.equal(result.accepted, false);
    assert.ok(result.errors.some(error => error.code === 'admission-package-schema-invalid'));
});
