const test = require('node:test');
const assert = require('node:assert/strict');

const Machine = require('../qisi-import-state-machine.js');

const advanceToLoading = async machine => {
    await machine.transition('start');
    await machine.transition('prepared');
};

test('exports the complete immutable state and transition contracts', () => {
    assert.deepEqual(Machine.STATES, [
        'IDLE', 'PREPARING', 'LOADING_SOURCE', 'RECOGNIZING', 'NORMALIZING',
        'STRUCTURING', 'VALIDATING', 'BUILDING_REVIEW', 'PERSISTING_DRAFT',
        'WAITING_CONFIRMATION', 'FORMAL_ADMISSION', 'COMMITTING', 'COMPLETED',
        'CANCELLED', 'FAILED'
    ]);
    assert.equal(Object.isFrozen(Machine.STATES), true);
    assert.equal(Machine.TRANSITIONS.length, 28);
    assert.equal(Object.isFrozen(Machine.TRANSITIONS), true);
});

test('runs the deterministic success path with monotonic progress', async () => {
    const machine = Machine.createImportStateMachine();
    const path = [
        ['start', 'PREPARING'], ['prepared', 'LOADING_SOURCE'],
        ['deterministic-source-loaded', 'NORMALIZING'], ['normalized', 'STRUCTURING'],
        ['structured', 'VALIDATING'], ['validation-complete', 'BUILDING_REVIEW'],
        ['review-built', 'PERSISTING_DRAFT'], ['draft-transaction-committed', 'WAITING_CONFIRMATION'],
        ['teacher-confirm', 'FORMAL_ADMISSION'], ['admitted', 'COMMITTING'],
        ['repository-committed', 'COMPLETED']
    ];
    let progress = 0;
    for (const [trigger, state] of path) {
        const snapshot = await machine.transition(trigger);
        assert.equal(snapshot.state, state);
        assert.equal(snapshot.progress >= progress, true);
        progress = snapshot.progress;
    }
    assert.equal(machine.snapshot().progress, 100);
    assert.equal(Object.isFrozen(machine.snapshot()), true);
});

test('invalid transition rejects before command or state mutation', async () => {
    let calls = 0;
    const machine = Machine.createImportStateMachine({ commands: { admitted: () => { calls += 1; } } });
    await assert.rejects(machine.transition('admitted'), error => error.code === 'IMPORT_INVALID_TRANSITION');
    assert.equal(calls, 0);
    assert.equal(machine.snapshot().state, 'IDLE');
    assert.equal(machine.snapshot().sequence, 0);
});

test('cancel during recognition aborts the command and ignores its late result', async () => {
    let release;
    let observedSignal;
    const machine = Machine.createImportStateMachine({
        commands: {
            'recognition-source-loaded': ({ signal }) => {
                observedSignal = signal;
                return new Promise(resolve => { release = resolve; });
            }
        }
    });
    await advanceToLoading(machine);
    const pending = machine.transition('recognition-source-loaded');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(machine.snapshot().state, 'RECOGNIZING');
    const cancelled = machine.cancel('teacher-request');
    assert.equal(cancelled.state, 'CANCELLED');
    assert.equal(observedSignal.aborted, true);
    release({ candidates: ['late-private-result'] });
    await pending;
    assert.equal(machine.snapshot().state, 'CANCELLED');
    assert.equal(JSON.stringify(machine.snapshot()).includes('late-private-result'), false);
});

test('stable failures are sanitized and retry is bounded', async () => {
    let attempts = 0;
    const machine = Machine.createImportStateMachine({
        maxRetries: 1,
        commands: {
            'recognition-source-loaded': () => {
                attempts += 1;
                const error = new Error('private source text must not leak');
                error.code = 'NETWORK_TIMEOUT';
                error.retryable = true;
                throw error;
            }
        }
    });
    await advanceToLoading(machine);
    await assert.rejects(machine.transition('recognition-source-loaded'), error => error.code === 'IMPORT_RECOGNITION_FAILED');
    const failed = machine.snapshot();
    assert.equal(failed.state, 'FAILED');
    assert.equal(failed.error.code, 'IMPORT_RECOGNITION_FAILED');
    assert.equal(JSON.stringify(failed).includes('private source'), false);
    await machine.transition('retry');
    assert.equal(machine.snapshot().state, 'PREPARING');
    await machine.transition('prepared');
    await assert.rejects(machine.transition('recognition-source-loaded'));
    await assert.rejects(machine.transition('retry'), error => error.code === 'IMPORT_RETRY_EXHAUSTED');
    assert.equal(attempts, 2);
});

test('state snapshots contain data only and do not expose injected commands', () => {
    const machine = Machine.createImportStateMachine({ commands: { start: () => 1 } });
    const snapshot = machine.snapshot();
    assert.equal(JSON.stringify(snapshot).includes('command'), false);
    assert.equal(Object.values(snapshot).some(value => typeof value === 'function'), false);
});
