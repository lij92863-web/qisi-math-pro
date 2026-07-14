const test = require('node:test');
const assert = require('node:assert/strict');

const Machine = require('../qisi-import-state-machine.js');
const { createHarness } = require('./helpers/production-import-harness.js');

test('deterministic production progress covers its review states monotonically', async () => {
    const harness = createHarness();
    const result = await harness.bridge.run({
        mode: 'production', batchId: 'batch-1', requestId: 'progress-1'
    });
    const values = harness.metrics.progress.map(event => event.progress);
    assert.deepEqual(values, [...values].sort((a, b) => a - b));
    for (const required of [2, 10, 55, 65, 75, 85]) {
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
