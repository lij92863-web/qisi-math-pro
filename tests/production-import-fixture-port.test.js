const test = require('node:test');
const assert = require('node:assert/strict');

const Bridge = require('../qisi-production-import-bridge.js');
const Controller = require('../qisi-normal-ui-import-controller.js');

const forbiddenInputs = [
    'producerRoute',
    'testFixture',
    'fixtureTransport',
    'prebuiltCandidates'
];

function inertBridge() {
    const ports = Object.fromEntries(
        Bridge.REQUIRED_PORTS.map(name => [name, async () => undefined])
    );
    return Bridge.createProductionImportBridge(ports);
}

test('production Bridge exports no final-candidate fixture runner', () => {
    assert.equal(Bridge.createFixtureImportRunner, undefined);
    assert.equal(Bridge.REQUIRED_PORTS.includes('runFixtureImport'), false);
});

test('every former fixture-selection input fails closed', async () => {
    const bridge = inertBridge();
    for (const field of forbiddenInputs) {
        await assert.rejects(
            bridge.run({ [field]: field === 'testFixture' ? true : 'fixture' }),
            error => error.code === 'PRODUCTION_IMPORT_INPUT_FORBIDDEN' &&
                error.causeCode === field
        );
    }
});

test('normal UI controller emits only a production source command', async () => {
    let received = null;
    const controller = Controller.createNormalUiImportController({
        bridge: {
            async run(command) {
                received = command;
                return {
                    mode: 'production',
                    state: { state: 'WAITING_CONFIRMATION' },
                    readback: { batch: { id: 'batch-1' }, questions: [] }
                };
            }
        },
        loadBatch: async () => ({
            id: 'batch-1',
            status: 'pending',
            sourceVersion: 1,
            draftPersistence: { version: 0 }
        }),
        applyReviewModel: async () => undefined
    });
    await controller.run('batch-1');
    assert.equal(received.mode, 'production');
    assert.equal(received.batchId, 'batch-1');
    forbiddenInputs.forEach(field => assert.equal(field in received, false));
});
