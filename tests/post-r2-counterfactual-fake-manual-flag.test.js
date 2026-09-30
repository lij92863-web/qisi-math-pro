const test = require('node:test');
const assert = require('node:assert/strict');
const Policy = require('../qisi-formal-admission-policy.js');

test('Phase 3 fake manual flags cannot launder rejected provenance', () => {
    const accepted = field => ({ status: 'controlled-write', sourceId: 's1', controlledWriteAccepted: true, controlledWriteDecisionId: `cw-${field}` });
    const draft = {
        id: 'd1', version: 1, questionNumber: '1', type: '解答题',
        stem: 'stem', options: [], answer: 'A', solution: 'solution', images: [],
        source: { mode: 'pdf-ai', sourceId: 's1', batchId: 'b1' },
        userEdited: true, manualEdited: true, manualConfirmed: true,
        fieldProvenance: {
            questionNumber: accepted('questionNumber'), stem: accepted('stem'),
            options: accepted('options'), answer: { status: 'rejected', reasonCode: 'ownership-invalid' },
            solution: accepted('solution'), images: { status: 'missing' }
        }
    };
    const decision = Policy.evaluateDraftAdmission(draft, Policy.createAdmissionContext({
        mode: 'pdf-ai', actorId: 'teacher', explicitConfirmation: true,
        requestId: 'r1', idempotencyKey: 'i1', evaluatedAt: '2026-07-13T00:00:00.000Z',
        source: { sourceId: 's1', batchId: 'b1' }
    }));
    assert.equal(decision.accepted, false);
    assert.ok(decision.errors.some(error => error.code === 'admission-field-rejected'));
});
