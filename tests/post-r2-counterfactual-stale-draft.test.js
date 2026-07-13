const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Policy = require('../qisi-formal-admission-policy.js');
const { FakeDatabase } = require('./storage-test-harness.js');
const { makeDraft, makeContext, createRepository, options } = require('./fixtures/formal-admission-transaction.js');

test('Phase 3 stale draft cannot write a formal question', async () => {
    const draft = makeDraft({ version: 2 });
    const repository = createRepository(new FakeDatabase({ draftQuestions: [draft] }));
    const decision = Policy.evaluateDraftAdmission(draft, makeContext());
    await assert.rejects(
        repository.confirmDraftToQuestion(draft.id, decision, options({ expectedDraftVersion: 1 })),
        error => error.code === 'draft-version-conflict'
    );
    assert.deepEqual(await repository.listTable('questions'), []);
    assert.equal((await repository.get('draftQuestions', draft.id)).version, 2);
});

test('Phase 3 matrix records stale draft', () => {
    const matrix = fs.readFileSync(path.resolve(__dirname, '..', 'docs/testing/POST_R2_COUNTERFACTUAL_MATRIX_R1.md'), 'utf8');
    assert.match(matrix, /\| stale draft \|[^\n]+\| PASS \|/);
});
