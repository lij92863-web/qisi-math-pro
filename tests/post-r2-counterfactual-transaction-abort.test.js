const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Policy = require('../qisi-formal-admission-policy.js');
const { FakeDatabase } = require('./storage-test-harness.js');
const { makeDraft, makeContext, createRepository, options } = require('./fixtures/formal-admission-transaction.js');

test('Phase 3 transaction abort rolls back every formal mutation', async () => {
    const draft = makeDraft();
    const database = new FakeDatabase({ draftQuestions: [draft], draftImportBatches: [{ id: 'batch-1', submittedCount: 0 }] });
    database.failAfterWork = true;
    const repository = createRepository(database);
    const decision = Policy.evaluateDraftAdmission(draft, makeContext());
    await assert.rejects(repository.confirmDraftToQuestion(draft.id, decision, options()), error => error.code === 'interrupted-write');
    database.failAfterWork = false;
    assert.equal(await repository.get('questions', 'question-1'), undefined);
    assert.equal((await repository.get('draftQuestions', draft.id)).status, 'reviewed');
    assert.equal((await repository.get('draftImportBatches', 'batch-1')).submittedCount, 0);
});

test('Phase 3 matrix records transaction abort', () => {
    const matrix = fs.readFileSync(path.resolve(__dirname, '..', 'docs/testing/POST_R2_COUNTERFACTUAL_MATRIX_R1.md'), 'utf8');
    assert.match(matrix, /\| transaction abort \|[^\n]+\| PASS \|/);
});
