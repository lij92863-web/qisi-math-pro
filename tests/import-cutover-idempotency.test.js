const test = require('node:test');
const assert = require('node:assert/strict');

const Controller = require('../qisi-normal-ui-import-controller.js');
const RoutePolicy = require('../qisi-production-import-route-policy.js');
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

test('completed PDF rerecognition creates a new draft request while explicit idempotent retries keep their identity', async () => {
    assert.equal(RoutePolicy.canReuseNormalUiCommittedRequest({ producerMode: 'docx-deterministic' }), true);
    assert.equal(RoutePolicy.canReuseNormalUiCommittedRequest({ producerMode: 'docx-vision' }), true);
    const previous = 'normal-ui:pdf-batch:source:1:draft:1';
    const inputs = [];
    const controller = Controller.createNormalUiImportController({
        canReuseCommittedRequest: RoutePolicy.canReuseNormalUiCommittedRequest,
        loadBatch: async () => ({ id: 'pdf-batch', producerMode: 'pdf', sourceVersion: 1, status: 'review', draftPersistence: { version: 1, idempotencyKey: previous } }),
        bridge: { run: async input => {
            inputs.push(input);
            return { mode: 'production', state: { state: 'WAITING_CONFIRMATION' }, readback: { batch: { id: input.batchId }, questions: [] } };
        } },
        applyReviewModel: async () => {}
    });
    await controller.run('pdf-batch');
    assert.equal(inputs[0].requestId, 'normal-ui:pdf-batch:source:1:draft:2');
    await controller.run('pdf-batch', { requestId: previous });
    assert.equal(inputs[1].requestId, previous);
    assert.equal(inputs.every(input => input.expectedSourceVersion === 1), true);
});
