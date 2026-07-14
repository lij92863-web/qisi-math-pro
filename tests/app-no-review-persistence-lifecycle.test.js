const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.resolve(__dirname, '../app.js'), 'utf8');

const body = name => {
    const start = app.indexOf(`const ${name} =`);
    assert.notEqual(start, -1, `${name} missing`);
    const next = app.indexOf('\n                const ', start + 10);
    return app.slice(start, next === -1 ? app.length : next);
};

test('review and maintenance UI commands delegate without persistence lifecycle', () => {
    const commands = [
        'markDraftReviewed',
        'submitDraftQuestion',
        'refreshBatchStats',
        'openBatchSubmitSummary',
        'confirmBatchSubmit',
        'dedupeActiveBatchDraftsNow',
        'cleanupActiveBatchDisplayPollution',
        'deleteBatchImport'
    ];
    for (const name of commands) {
        const source = body(name);
        assert.doesNotMatch(source, /persistReviewDraftBatch|reloadDraftBatch/);
        assert.doesNotMatch(source, /batchFormalSubmit\.submit/);
        assert.ok(source.split('\n').length <= 60, `${name} exceeds 60 lines`);
    }
    assert.match(app, /createReviewWorkflowService\s*\(/);
    assert.match(app, /createDraftMaintenanceService\s*\(/);
});
