const test = require('node:test');
const assert = require('node:assert/strict');
const Import = require('../qisi-import-orchestrator.js');
const { createReviewController } = require('../qisi-review-controller.js');

test('Phase 3 malformed-admission attacks fail closed', async () => {
    for (const malformed of [null, {}, { valid: 'true' }, { valid: true, errors: 'none' }]) {
        let handoffs = 0;
        const orchestrator = Import.createImportOrchestrator({
            handlers: { pdf: async () => [{ id: 'candidate' }] },
            validate: async () => malformed,
            handoff: async value => { handoffs += 1; return value; }
        });
        await assert.rejects(orchestrator.run({ id: `source-${handoffs}`, type: 'pdf' }), error => error.code === 'validator-malformed');
        assert.equal(handoffs, 0);
        const result = createReviewController({ validateDraft: () => malformed })
            .confirm({ id: 'draft', stem: 'question', status: 'pending' });
        assert.equal(result.accepted, false);
        assert.equal(result.validation.errors[0]?.code, 'validator-malformed');
        assert.equal(result.draft.status, 'pending');
    }
});
