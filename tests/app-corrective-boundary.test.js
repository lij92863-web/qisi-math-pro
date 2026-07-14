const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
const lines = app.split(/\r?\n/);
const inventory = JSON.parse(execFileSync(
    process.execPath,
    ['scripts/app-shell-responsibility-inventory.js'],
    { cwd: ROOT, encoding: 'utf8' }
));
const functionSource = name => {
    const row = inventory.functions.find(item => item.name === name);
    if (!row) return '';
    return lines.slice(row.startLine - 1, row.endLine).join('\n');
};

test('app shell owns no import producer route selection', () => {
    const run = functionSource('runBatchRecognition');
    assert.doesNotMatch(app, /resolveProducerRoute\s*:/);
    assert.doesNotMatch(run, /ImportAdapterRegistry|testFixture|producerRoute/);
});

test('app shell owns no duplicate admission policy', () => {
    assert.doesNotMatch(app, /const\s+detectDraftDuplicate\b/);
    const submit = functionSource('submitDraftQuestion');
    assert.doesNotMatch(submit, /fingerprint|duplicateStatus|detectDraftDuplicate/);
    assert.doesNotMatch(submit, /batchFormalSubmit\.submit|reloadDraftBatch/);
});

test('app review commands own no persistence lifecycle business logic', () => {
    const forbidden = /reloadDraftBatch|persistReviewDraftBatch|batchPatch|finalDrafts|finalDraftImages/;
    for (const name of [
        'refreshBatchStats',
        'dedupeActiveBatchDraftsNow',
        'cleanupActiveBatchDisplayPollution'
    ]) {
        assert.doesNotMatch(functionSource(name), forbidden, name);
    }
    assert.doesNotMatch(
        functionSource('confirmBatchSubmit'),
        /for\s*\(|submitDraftQuestion\s*\(/
    );
});
