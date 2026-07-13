const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Policy = require('../qisi-formal-admission-policy.js');
const { FakeDatabase } = require('./storage-test-harness.js');
const { makeDraft, makeContext, createRepository, options } = require('./fixtures/formal-admission-transaction.js');

test('Phase 3 duplicate submit is idempotent and writes once', async () => {
    const draft = makeDraft();
    const repository = createRepository(new FakeDatabase({ draftQuestions: [draft] }));
    const decision = Policy.evaluateDraftAdmission(draft, makeContext());
    const first = await repository.confirmDraftToQuestion(draft.id, decision, options());
    const second = await repository.confirmDraftToQuestion(draft.id, decision, options());
    assert.equal(first.idempotent, false);
    assert.equal(second.idempotent, true);
    assert.equal(second.question.id, first.question.id);
    assert.equal((await repository.listTable('questions')).length, 1);
});

test('Phase 3 matrix records duplicate submit', () => {
    const matrix = fs.readFileSync(path.resolve(__dirname, '..', 'docs/testing/POST_R2_COUNTERFACTUAL_MATRIX_R1.md'), 'utf8');
    assert.match(matrix, /\| duplicate submit \|[^\n]+\| PASS \|/);
});
