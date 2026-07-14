const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.resolve(__dirname, '../app.js'), 'utf8');

test('app shell has no duplicate decision owner or stale fingerprint admission', () => {
    assert.doesNotMatch(app, /detectDraftDuplicate|duplicateLabel/);
    assert.doesNotMatch(app, /duplicateStatus\s*!==\s*['"]none['"]/);
    assert.doesNotMatch(app, /batchFormalSubmit\.submit\s*\(/);
    assert.match(app, /reviewWorkflowService\.submitDraft\s*\(/);
    assert.match(app, /QuestionDuplicatePolicy/);
});
