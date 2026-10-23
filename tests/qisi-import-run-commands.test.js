const test = require('node:test');
const assert = require('node:assert/strict');
const commands = require('../qisi-import-run-commands.js');

test('runBatch requires a batch id and a controller', () => {
    assert.throws(() => commands.runBatch({ batchId: '' }), error => error.code === 'IMPORT_BATCH_ID_REQUIRED');
    assert.throws(() => commands.runBatch({ batchId: 'b1' }), error => error.code === 'IMPORT_RUN_CONTROLLER_REQUIRED');
});

test('runBatch warns when the same batch is already running and still delegates', () => {
    const warns = [];
    const runs = [];
    const controller = {
        isRunning: id => id === 'b1',
        run: id => { runs.push(id); return 'run-result'; }
    };
    const result = commands.runBatch({ batchId: 'b1', controller, warn: (message, payload) => warns.push([message, payload]) });
    assert.equal(result, 'run-result');
    assert.deepEqual(runs, ['b1']);
    assert.deepEqual(warns, [['[BATCH_DEBUG][duplicate-run-blocked]', { batchId: 'b1' }]]);
});

test('runBatch does not warn for an idle batch', () => {
    const warns = [];
    const controller = { isRunning: () => false, run: () => 'ok' };
    assert.equal(commands.runBatch({ batchId: 'b2', controller, warn: (...args) => warns.push(args) }), 'ok');
    assert.deepEqual(warns, []);
});

test('cancelBatch reports a missing request only when nothing was cancelled', () => {
    assert.equal(commands.cancelBatch({ batchId: 'b1', controller: { cancel: () => true } }), true);
    const notices = [];
    const cancelled = commands.cancelBatch({
        batchId: 'b1', controller: { cancel: () => false }, notify: message => notices.push(message)
    });
    assert.equal(cancelled, false);
    assert.deepEqual(notices, ['当前任务没有可取消的识别请求。']);
});

test('rerunBatch stops without a batch or when the user declines', async () => {
    const notices = [];
    assert.equal(await commands.rerunBatch({ batchId: '', notify: message => notices.push(message) }), false);
    assert.deepEqual(notices, ['当前没有可重新识别的任务']);
    let ran = false;
    assert.equal(await commands.rerunBatch({
        batchId: 'b1', confirmRerun: () => false, run: () => { ran = true; }, openReview: () => {}
    }), false);
    assert.equal(ran, false);
});

test('rerunBatch reuses the same batch id and reopens the review afterwards', async () => {
    const order = [];
    const result = await commands.rerunBatch({
        batchId: 'b7',
        confirmRerun: message => { order.push(['confirm', message]); return true; },
        run: async id => order.push(['run', id]),
        openReview: async id => order.push(['review', id])
    });
    assert.equal(result, true);
    assert.equal(order[0][0], 'confirm');
    assert.deepEqual(order.slice(1), [['run', 'b7'], ['review', 'b7']]);
});

const { createNormalUiImportController } = require('../qisi-normal-ui-import-controller');
const { createReviewSession } = require('../qisi-review-session-commands');
const fields = require('../qisi-review-draft-state');
const gate = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function workspaceFixture() {
    const notices = [], calls = [];
    const rows = id => [{ id: id + '_q1', batchId: id, version: 1, status: 'pending', stem: 'source ' + id, images: [], options: [] }];
    const persistence = {
        async reloadDraftBatch(id) { return { batch: { id, status: 'review' }, files: [], images: [], questions: rows(id) }; },
        async persistReviewDraftCommand() { throw new Error('unexpected save'); },
        async persistReviewImageCommand() { throw new Error('unexpected image save'); }
    };
    const storage = { async listRecentTasks() { return []; }, async get(table, id) { return { id, status: 'pending', sourceVersion: 1 }; } };
    const session = createReviewSession({ ref: value => ({ value }), fields, storage, persistence });
    const bridge = { async run(input) {
        calls.push(input); return { mode: 'production', batchId: input.batchId, state: { state: 'WAITING_CONFIRMATION' },
            readback: await persistence.reloadDraftBatch(input.batchId) };
    } };
    const sourceFor = q => q.stem;
    const workspace = commands.createWorkspace({ createController: createNormalUiImportController, bridge, storage, session,
        canReuseCommittedRequest: () => true, sourceFor, afterRender: async () => {}, notify: value => notices.push(value) });
    return { workspace, bridge, session, notices, calls, sourceFor };
}

test('workspace delegates one controller request for duplicate runs and adopts the verified review model', async () => {
    const f = workspaceFixture(), waiting = gate(), run = f.bridge.run;
    f.bridge.run = async input => { await waiting.promise; return run(input); };
    const first = f.workspace.run('b'), second = f.workspace.run('b');
    assert.equal(first, second); assert.equal(f.workspace.isRunning('b'), true);
    waiting.resolve(); await first;
    assert.equal(f.calls.length, 1); assert.equal(f.workspace.isRunning('b'), false);
    assert.equal(f.session.refs.activeBatchId.value, 'b'); assert.equal(f.session.current().id, 'b_q1');
    assert.equal(f.session.refs.activeDraftEditorBuffer.value, 'source b'); assert.equal(f.session.dirty(), false);
    f.workspace.dispose(); f.session.dispose();
});

test('workspace cleans a failed request and a later explicit retry starts a fresh controller request', async () => {
    const f = workspaceFixture(), run = f.bridge.run;
    let attempts = 0;
    f.bridge.run = input => { if (++attempts === 1) throw new Error('fixture failure'); return run(input); };
    await assert.rejects(f.workspace.run('b'));
    assert.equal(f.workspace.isRunning('b'), false);
    await f.workspace.run('b'); assert.equal(attempts, 2);
    assert.equal(f.session.current().id, 'b_q1');
    f.workspace.dispose(); f.session.dispose();
});

test('workspace completion does not adopt into a different or dirty review visit', async () => {
    for (const mode of ['new-visit', 'dirty']) {
        const f = workspaceFixture(), waiting = gate(), run = f.bridge.run;
        if (mode === 'dirty') await f.session.openBatch('b', { sourceFor: f.sourceFor });
        f.bridge.run = async input => { await waiting.promise; return run(input); };
        const importing = f.workspace.run('b');
        if (mode === 'new-visit') await f.session.openBatch('other', { sourceFor: f.sourceFor });
        f.session.refs.activeDraftEditorBuffer.value = 'new unsaved source';
        f.session.refs.selectedDraftIds.value = ['keep-selection'];
        waiting.resolve(); await importing;
        assert.equal(f.session.refs.activeBatchId.value, mode === 'new-visit' ? 'other' : 'b');
        assert.equal(f.session.refs.activeDraftEditorBuffer.value, 'new unsaved source');
        assert.deepEqual(f.session.refs.selectedDraftIds.value, ['keep-selection']);
        assert.match(f.notices.at(-1), /任务列表打开审核/);
        f.workspace.dispose(); f.session.dispose();
    }
});

test('workspace disposal cancels the active signal and blocks late model publication and future runs', async () => {
    const f = workspaceFixture(), waiting = gate(), entered = gate(), run = f.bridge.run;
    let signal;
    f.bridge.run = async input => { signal = input.signal; entered.resolve(); await waiting.promise; return run(input); };
    const importing = f.workspace.run('b'); await entered.promise;
    f.workspace.dispose(); f.workspace.dispose(); assert.equal(signal.aborted, true);
    waiting.resolve(); await importing;
    assert.equal(f.session.current(), null); assert.deepEqual(f.notices, []);
    await assert.rejects(f.workspace.run('b'), error => error.code === 'IMPORT_WORKSPACE_DISPOSED');
    f.session.dispose();
});

test('workspace fails closed without required controller and review-session ports', () => {
    assert.throws(() => commands.createWorkspace(), error => error.code === 'IMPORT_WORKSPACE_PORT_REQUIRED');
});
