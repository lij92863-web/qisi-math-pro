const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Coordinator = require('../qisi-legacy-batch-run-coordinator.js');

const ROOT = path.resolve(__dirname, '..');

test('legacy coordinator reports the real business-and-persistence boundary', async () => {
    const batch = { id: 'batch-1', status: 'review', totalCount: 2 };
    const calls = [];
    const coordinator = Coordinator.createLegacyBatchRunCoordinator({
        runLegacyBatch: async id => { calls.push(['run', id]); },
        loadBatchState: async id => {
            calls.push(['load', id]);
            return batch;
        }
    });
    const result = await coordinator.run(batch.id);
    assert.deepEqual(calls, [['run', 'batch-1'], ['load', 'batch-1']]);
    assert.equal(result.owner, 'LegacyBatchRunCoordinator');
    assert.equal(result.boundary, 'legacy-business-and-persistence');
    assert.equal(result.validationBoundary, false);
    assert.deepEqual(result.batch, batch);
});

test('legacy coordinator fails when persisted terminal state is failed', async () => {
    const coordinator = Coordinator.createLegacyBatchRunCoordinator({
        runLegacyBatch: async () => undefined,
        loadBatchState: async () => ({
            id: 'batch-1', status: 'failed', errorMessage: 'legacy failure'
        })
    });
    await assert.rejects(
        coordinator.run('batch-1'),
        error => error.code === 'legacy-run-failed' && error.stage === 'legacy-run'
    );
    assert.equal(coordinator.isRunning('batch-1'), false);
});

test('legacy coordinator blocks duplicate runs and releases its lock', async () => {
    let release;
    const pending = new Promise(resolve => { release = resolve; });
    const coordinator = Coordinator.createLegacyBatchRunCoordinator({
        runLegacyBatch: async () => pending,
        loadBatchState: async () => ({ id: 'batch-1', status: 'review' })
    });
    const first = coordinator.run('batch-1');
    await assert.rejects(
        coordinator.run('batch-1'),
        error => error.code === 'duplicate-run'
    );
    release();
    await first;
    assert.equal(coordinator.isRunning('batch-1'), false);
});

test('production app names the legacy owner and contains no no-op validator', () => {
    const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    assert.match(app, /LegacyBatchRunCoordinator\.createLegacyBatchRunCoordinator/);
    assert.match(app, /legacyBatchRunCoordinator\.run\s*\(/);
    assert.doesNotMatch(app, /ImportOrchestrator\.createImportOrchestrator/);
    assert.doesNotMatch(
        app,
        /validate\s*:\s*result\s*=>\s*\(\{\s*valid\s*:\s*true/
    );
});
