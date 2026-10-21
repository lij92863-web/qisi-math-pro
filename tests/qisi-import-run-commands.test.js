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
