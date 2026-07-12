const test = require('node:test');
const assert = require('node:assert/strict');

const Import = require('../qisi-import-orchestrator.js');

const source = { id: 'source-1', type: 'pdf' };

const make = ({ validate, onHandoff = () => {} } = {}) =>
    Import.createImportOrchestrator({
        handlers: { pdf: async () => [{ id: 'candidate-1' }] },
        ...(validate === undefined ? {} : { validate }),
        handoff: async value => {
            onHandoff(value);
            return value;
        }
    });

test('missing import validator is rejected before handoff', async () => {
    let handoffCalls = 0;
    const orchestrator = make({ onHandoff: () => { handoffCalls += 1; } });
    await assert.rejects(
        orchestrator.run(source),
        error => error.code === 'validator-required' && error.stage === 'validation'
    );
    assert.equal(handoffCalls, 0);
});

test('malformed import validator results fail closed', async () => {
    for (const result of [null, {}, { valid: 'true' }, { valid: true, errors: 'bad' }]) {
        let handoffCalls = 0;
        const orchestrator = make({
            validate: async () => result,
            onHandoff: () => { handoffCalls += 1; }
        });
        await assert.rejects(
            orchestrator.run({ ...source, id: `source-${String(result)}` }),
            error => error.code === 'validator-malformed'
        );
        assert.equal(handoffCalls, 0);
    }
});

test('throwing import validator fails closed and releases the run lock', async () => {
    let handoffCalls = 0;
    const orchestrator = make({
        validate: async () => { throw new Error('validator internals'); },
        onHandoff: () => { handoffCalls += 1; }
    });
    await assert.rejects(
        orchestrator.run(source),
        error => error.code === 'validator-failed' && error.stage === 'validation'
    );
    assert.equal(handoffCalls, 0);
    assert.equal(orchestrator.isRunning(source.id), false);
});

test('explicit invalid import result never reaches handoff', async () => {
    let handoffCalls = 0;
    const orchestrator = make({
        validate: async () => ({
            valid: false,
            errors: [{ code: 'unsafe', message: 'unsafe candidate' }],
            warnings: []
        }),
        onHandoff: () => { handoffCalls += 1; }
    });
    await assert.rejects(
        orchestrator.run(source),
        error => error.code === 'validation-failed'
    );
    assert.equal(handoffCalls, 0);
});
