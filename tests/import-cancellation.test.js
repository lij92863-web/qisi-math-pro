const test = require('node:test');
const assert = require('node:assert/strict');

const Import = require('../qisi-import-orchestrator.js');

test('cancellation and duplicate runs are explicit and release the lock', async () => {
    let release;
    const pending = new Promise(resolve => { release = resolve; });
    const orchestrator = Import.createImportOrchestrator({
        handlers: { batch: async () => pending },
        validate: value => ({ valid: true, value })
    });
    const first = orchestrator.run({ id: 'b1', type: 'batch' });
    await assert.rejects(
        orchestrator.run({ id: 'b1', type: 'batch' }),
        error => error.code === 'duplicate-run'
    );
    release([]);
    await first;
    assert.equal(orchestrator.isRunning('b1'), false);

    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
        orchestrator.run(
            { id: 'b2', type: 'batch' },
            { signal: controller.signal }
        ),
        error => error.code === 'cancelled'
    );
    assert.equal(orchestrator.isRunning('b2'), false);
});

test('handler errors map without exposing implementation details', async () => {
    const orchestrator = Import.createImportOrchestrator({
        handlers: { docx: async () => { throw new Error('parser unavailable'); } }
    });
    await assert.rejects(
        orchestrator.run({ id: 'd1', type: 'docx' }),
        error => error.code === 'handler-failed' && error.stage === 'docx'
    );
});
