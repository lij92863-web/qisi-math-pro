const test = require('node:test');
const assert = require('node:assert/strict');

const Controller = require('../qisi-normal-ui-import-controller.js');
const { createHarness } = require('./helpers/production-import-harness.js');

test('a lost UI response retries the committed request without rerunning producer or persistence', async () => {
    const harness = createHarness();
    const requestIds = [];
    let applyCalls = 0;
    const controller = Controller.createNormalUiImportController({
        bridge: {
            run: input => {
                requestIds.push(input.requestId);
                return harness.bridge.run(input);
            }
        },
        loadBatch: async () => harness.getBatch(),
        applyReviewModel: async () => {
            applyCalls += 1;
            if (applyCalls === 1) throw new Error('simulated-response-loss');
        }
    });

    await assert.rejects(controller.run('batch-1'));
    const recovered = await controller.run('batch-1');

    assert.equal(recovered.state.state, 'WAITING_CONFIRMATION');
    assert.equal(recovered.persistence.idempotent, true);
    assert.deepEqual(requestIds, [requestIds[0], requestIds[0]]);
    assert.equal(harness.metrics.producerCalls, 1);
    assert.equal(harness.metrics.persistenceCalls, 1);
    assert.equal(harness.metrics.formalWrites, 0);
});

test('an idempotent request fails closed if committed readback identity is inconsistent', async () => {
    const harness = createHarness({
        reloadDraftBatch: async () => ({
            batch: {
                id: 'batch-1', status: 'review',
                draftPersistence: {
                    version: 1, idempotencyKey: 'request-1'
                }
            },
            files: [], questions: [], images: []
        })
    });
    harness.setBatch({
        id: 'batch-1', sourceType: 'docx', producerMode: 'docx-deterministic',
        sourceVersion: 1,
        status: 'review', progress: 100,
        draftPersistence: { version: 1, idempotencyKey: 'request-1' }
    });
    await assert.rejects(
        harness.bridge.run({
            mode: 'production', batchId: 'batch-1', requestId: 'request-1'
        }),
        error => error.code === 'PRODUCTION_IMPORT_READBACK_MISMATCH'
    );
    assert.equal(harness.metrics.producerCalls, 0);
    assert.equal(harness.metrics.persistenceCalls, 0);
});
