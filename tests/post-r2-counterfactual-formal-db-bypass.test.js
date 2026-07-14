const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');

test('Phase 3 formal submit cannot bypass policy and repository', () => {
    const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    const start = app.indexOf('const submitDraftQuestion = async');
    const submit = app.slice(start, app.indexOf('const openBatchSubmitSummary', start));
    assert.ok(start >= 0);
    assert.doesNotMatch(submit, /db\.questions\.(?:put|add|bulkPut)/);
    assert.doesNotMatch(submit, /batchFormalSubmit\.submit/);
    assert.match(submit, /reviewWorkflowService\.submitDraft/);
    const workflow = fs.readFileSync(
        path.join(ROOT, 'qisi-review-workflow-service.js'), 'utf8'
    );
    assert.match(workflow, /formalSubmit\.submit/);
    const owner = fs.readFileSync(path.join(ROOT, 'qisi-batch-formal-submit.js'), 'utf8');
    assert.match(owner, /policy\.evaluateDraftAdmission/);
    assert.match(owner, /repository\.confirmDraftToQuestion/);
});

test('Phase 3 matrix records formal submit direct DB bypass', () => {
    const matrix = fs.readFileSync(path.join(ROOT, 'docs/testing/POST_R2_COUNTERFACTUAL_MATRIX_R1.md'), 'utf8');
    assert.match(matrix, /\| formal submit direct DB bypass \|[^\n]+\| PASS \|/);
});
