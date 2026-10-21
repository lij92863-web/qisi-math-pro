const test = require('node:test');
const assert = require('node:assert/strict');
const session = require('../qisi-review-session-commands.js');

test('resolveSelection is a no-op for a missing or identical draft id', () => {
    assert.equal(session.resolveSelection({ currentId: 'a', nextId: '', dirty: true }), 'noop');
    assert.equal(session.resolveSelection({ currentId: 'a', nextId: 'a', dirty: true }), 'noop');
    assert.equal(session.resolveSelection({}), 'noop');
});

test('resolveSelection only prompts when the editor is dirty', () => {
    assert.equal(session.resolveSelection({ currentId: 'a', nextId: 'b', dirty: true }), 'prompt');
    assert.equal(session.resolveSelection({ currentId: 'a', nextId: 'b', dirty: false }), 'switch');
});

test('persistDraftCommand routes draft and image commands to their service methods', async () => {
    const calls = [];
    const service = {
        async persistReviewDraftCommand(command) { calls.push(['draft', command]); return { ok: 'draft' }; },
        async persistReviewImageCommand(command) { calls.push(['image', command]); return { ok: 'image' }; }
    };
    const notify = message => { throw new Error('unexpected notify: ' + message); };
    assert.deepEqual(await session.persistDraftCommand({ service, command: { id: 1 }, notify }), { ok: 'draft' });
    assert.deepEqual(await session.persistDraftCommand({ service, command: { id: 2 }, kind: 'image', notify }), { ok: 'image' });
    assert.deepEqual(calls, [['draft', { id: 1 }], ['image', { id: 2 }]]);
});

test('persistDraftCommand converts storage failures into a notice and a null result', async () => {
    const notices = [];
    const service = {
        async persistReviewDraftCommand() { const error = new Error('boom'); error.code = 'DRAFT_WRITE_FAILED'; throw error; },
        async persistReviewImageCommand() { throw new Error('image boom'); }
    };
    const result = await session.persistDraftCommand({ service, command: {}, notify: message => notices.push(message) });
    assert.equal(result, null);
    assert.equal(notices[0], '草稿保存失败：DRAFT_WRITE_FAILED');
    const imageResult = await session.persistDraftCommand({
        service, command: {}, kind: 'image', failureMessage: '图片保存失败',
        notify: message => notices.push(message)
    });
    assert.equal(imageResult, null);
    assert.equal(notices[1], '图片保存失败：image boom');
});

test('persistDraftCommand falls back to storage-failure without a code or message', async () => {
    const notices = [];
    const service = {
        async persistReviewDraftCommand() { throw {}; },
        async persistReviewImageCommand() { throw {}; }
    };
    assert.equal(await session.persistDraftCommand({ service, command: {}, notify: message => notices.push(message) }), null);
    assert.equal(notices[0], '草稿保存失败：storage-failure');
});

test('persistDraftCommand fails closed without its owners', async () => {
    await assert.rejects(session.persistDraftCommand({ service: {}, command: {} }),
        error => error.code === 'REVIEW_SESSION_COMMAND_NOTIFY_REQUIRED');
    await assert.rejects(session.persistDraftCommand({ service: {}, command: {}, notify: () => {} }),
        error => error.code === 'REVIEW_SESSION_COMMAND_SERVICE_REQUIRED');
});
