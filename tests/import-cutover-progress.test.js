const test = require('node:test');
const assert = require('node:assert/strict');

const Machine = require('../qisi-import-state-machine.js');
const { createHarness, makeDraft } = require('./helpers/production-import-harness.js');

test('production progress covers every review-building state in monotonic order', async () => {
    const harness = createHarness({
        runFixtureImport: async () => ({
            drafts: [makeDraft()], draftImages: [], warnings: []
        })
    });
    const result = await harness.bridge.run({
        mode: 'production', batchId: 'batch-1', requestId: 'progress-1',
        producerRoute: 'fixture', testFixture: true
    });
    const values = harness.metrics.progress.map(event => event.progress);
    assert.deepEqual(values, [...values].sort((a, b) => a - b));
    for (const required of [2, 10, 25, 45, 55, 65, 75, 85]) {
        assert.equal(values.includes(required), true, `missing progress ${required}`);
    }
    assert.equal(result.state.state, 'WAITING_CONFIRMATION');
    assert.equal(result.readback.batch.status, 'review');
});

test('unknown progress/state events fail safely and never mutate the state snapshot', async () => {
    const machine = Machine.createImportStateMachine();
    const before = machine.snapshot();
    await assert.rejects(
        machine.transition('unknown-production-event'),
        error => error.code === 'IMPORT_INVALID_TRANSITION'
    );
    assert.deepEqual(machine.snapshot(), before);
});
