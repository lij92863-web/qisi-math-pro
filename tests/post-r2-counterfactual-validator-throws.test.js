const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Import = require('../qisi-import-orchestrator.js');
const { createReviewController } = require('../qisi-review-controller.js');

test('Phase 3 throwing-validator attack cannot hand off or confirm', async () => {
    let handoffCalls = 0;
    const orchestrator = Import.createImportOrchestrator({
        handlers: { pdf: async () => [{ id: 'candidate-1' }] },
        validate: async () => { throw new Error('private validator internals'); },
        handoff: async value => { handoffCalls += 1; return value; }
    });
    await assert.rejects(
        orchestrator.run({ id: 'source-throw', type: 'pdf' }),
        error => error.code === 'validator-failed'
    );
    assert.equal(handoffCalls, 0);
    assert.equal(orchestrator.isRunning('source-throw'), false);

    const result = createReviewController({
        validateDraft: () => { throw new Error('private validator internals'); }
    }).confirm({ id: 'draft-throw', stem: 'question', status: 'pending' });
    assert.equal(result.accepted, false);
    assert.equal(result.validation.errors[0]?.code, 'validator-failed');
    assert.equal(result.draft.status, 'pending');
});

test('Phase 3 matrix records the throwing-validator attack evidence', () => {
    const matrix = fs.readFileSync(path.resolve(__dirname, '..', 'docs/testing/POST_R2_COUNTERFACTUAL_MATRIX_R1.md'), 'utf8');
    assert.match(matrix, /\| validator throws \|[^\n]+\| PASS \|/);
});
