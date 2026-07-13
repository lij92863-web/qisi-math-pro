const test = require('node:test');
const assert = require('node:assert/strict');

const Submit = require('../qisi-batch-formal-submit.js');
const Machine = require('../qisi-import-state-machine.js');

const draft = () => ({
    id: 'draft-1', version: 3,
    source: { sourceId: 'source-1', format: 'docx' },
    producer: { mode: 'deterministic-docx' },
    route: { identity: 'docx-deterministic-import' }
});

function harness({ accepted = true, repositoryError = null } = {}) {
    let writes = 0;
    let machine;
    const service = Submit.createBatchFormalSubmit({
        policy: {
            FORMAL_FIELDS: ['stem', 'answer'],
            createAdmissionContext: input => input,
            evaluateDraftAdmission: () => ({
                accepted,
                errors: accepted ? [] : [{ code: 'manual-review-required' }]
            })
        },
        repository: {
            confirmDraftToQuestion: async () => {
                writes += 1;
                if (repositoryError) throw repositoryError;
                return { question: { id: 'question-1' } };
            }
        },
        createStateMachine: options => {
            machine = Machine.createImportStateMachine(options);
            return machine;
        },
        clock: () => 100,
        random: () => 0.5
    });
    return { service, writes: () => writes, machine: () => machine };
}

test('accepted formal submission uses the unique formal lifecycle edges', async () => {
    const value = harness();
    const result = await value.service.submit({ draft: draft() });

    assert.equal(result.accepted, true);
    assert.equal(value.writes(), 1);
    assert.equal(result.state.state, 'COMPLETED');
    assert.deepEqual(result.trace.map(item => item.state), [
        'WAITING_CONFIRMATION', 'FORMAL_ADMISSION', 'COMMITTING', 'COMPLETED'
    ]);
});

test('admission rejection returns to review and performs zero formal writes', async () => {
    const value = harness({ accepted: false });
    const result = await value.service.submit({ draft: draft() });

    assert.equal(result.accepted, false);
    assert.equal(value.writes(), 0);
    assert.equal(result.state.state, 'WAITING_CONFIRMATION');
    assert.deepEqual(result.trace.map(item => item.state), [
        'WAITING_CONFIRMATION', 'FORMAL_ADMISSION', 'WAITING_CONFIRMATION'
    ]);
});

test('repository failure is terminal FAILED and never reports formal success', async () => {
    const value = harness({ repositoryError: new Error('private repository') });
    await assert.rejects(
        value.service.submit({ draft: draft() }),
        error => error.code === 'IMPORT_ADMISSION_REJECTED'
    );
    assert.equal(value.writes(), 1);
    assert.equal(value.machine().snapshot().state, 'FAILED');
    assert.equal(
        JSON.stringify(value.machine().snapshot()).includes('private repository'),
        false
    );
});
