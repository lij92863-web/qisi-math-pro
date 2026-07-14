const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Controller = require('../qisi-normal-ui-import-controller.js');
const ROOT = path.resolve(__dirname, '..');

test('normal UI controller sends identity-free production commands', async () => {
    let bridgeInput;
    const controller = Controller.createNormalUiImportController({
        bridge: {
            run: async input => {
                bridgeInput = input;
                return {
                    mode: 'production',
                    state: { state: 'WAITING_CONFIRMATION' },
                    readback: {
                        batch: { id: 'batch-1', status: 'review' },
                        questions: [{ id: 'draft-1' }]
                    }
                };
            }
        },
        loadBatch: async () => ({
            id: 'batch-1', sourceVersion: 3,
            draftPersistence: { version: 2 }
        }),
        applyReviewModel: async () => {}
    });
    await controller.run('batch-1', { requestId: 'explicit-request' });
    assert.deepEqual(
        Object.keys(bridgeInput).filter(key => key !== 'signal').sort(),
        [
            'batchId', 'expectedSourceVersion', 'mode', 'requestId'
        ]
    );
});

test('controller and app contain no route-selection callback or fixture flag', () => {
    const controller = fs.readFileSync(
        path.join(ROOT, 'qisi-normal-ui-import-controller.js'), 'utf8'
    );
    const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    assert.doesNotMatch(
        controller,
        /resolveProducerRoute|producerRoute|testFixture|ImportAdapterRegistry/
    );
    assert.doesNotMatch(
        app,
        /resolveProducerRoute|producerRoute|testFixture|ImportAdapterRegistry/
    );
});
