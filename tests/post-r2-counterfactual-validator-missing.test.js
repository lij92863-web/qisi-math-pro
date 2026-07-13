const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Import = require('../qisi-import-orchestrator.js');
const { createReviewController } = require('../qisi-review-controller.js');

test('Phase 3 missing-validator attack cannot hand off or confirm', async () => {
    let handoffCalls = 0;
    const orchestrator = Import.createImportOrchestrator({
        handlers: { pdf: async () => [{ id: 'candidate-1' }] },
        handoff: async value => {
            handoffCalls += 1;
            return value;
        }
    });
    await assert.rejects(
        orchestrator.run({ id: 'source-1', type: 'pdf' }),
        error => error.code === 'validator-required'
    );
    assert.equal(handoffCalls, 0);

    const result = createReviewController().confirm({
        id: 'draft-1', stem: 'question', status: 'pending'
    });
    assert.equal(result.accepted, false);
    assert.equal(result.validation.errors[0]?.code, 'validator-required');
    assert.equal(result.draft.status, 'pending');
});

test('Phase 3 matrix records the missing-validator attack evidence', () => {
    const matrixPath = path.resolve(
        __dirname,
        '..',
        'docs/testing/POST_R2_COUNTERFACTUAL_MATRIX_R1.md'
    );
    assert.equal(fs.existsSync(matrixPath), true);
    const matrix = fs.readFileSync(matrixPath, 'utf8');
    assert.match(matrix, /\| validator missing \|[^\n]+\| PASS \|/);
});
