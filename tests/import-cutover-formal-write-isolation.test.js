const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { createHarness } = require('./helpers/production-import-harness.js');
const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('Bridge production reaches review persistence with zero formal writes', async () => {
    const harness = createHarness();
    const result = await harness.bridge.run({
        mode: 'production', batchId: 'batch-1', requestId: 'formal-isolation-1'
    });
    assert.equal(result.readback.questions.length, 1);
    assert.equal(harness.metrics.persistenceCalls, 1);
    assert.equal(harness.metrics.formalWrites, 0);
});

test('cutover owners have no formal table or automatic admission authority', () => {
    const sources = [
        'qisi-production-import-bridge.js',
        'qisi-normal-ui-import-controller.js',
        'qisi-draft-persistence-service.js'
    ].map(read).join('\n');
    assert.doesNotMatch(sources, /db\.questions|table\(['"]questions|confirmDraftToQuestion/);
    assert.doesNotMatch(sources, /teacher-confirm|FORMAL_ADMISSION|automaticConfirmation/);
});
