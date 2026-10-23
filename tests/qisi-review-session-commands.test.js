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

const fields = require('../qisi-review-draft-state');
const gate = () => {
    let resolve;
    const promise = new Promise(yes => { resolve = yes; });
    return { promise, resolve };
};
function ownerFixture() {
    const saved = [], notices = [];
    const rows = batchId => [1, 2].map(n => ({ id: batchId + '_q' + n, batchId, version: 1,
        stem: 'original ' + n, options: [], images: [], status: 'pending', meta: {} }));
    const persistence = {
        async reloadDraftBatch(batchId) { return { batch: { id: batchId }, questions: rows(batchId), images: [], files: [] }; },
        async persistReviewDraftCommand(command) {
            saved.push(structuredClone(command));
            return { draft: { ...structuredClone(command.draft), version: command.expectedDraftVersion + 1 } };
        },
        async persistReviewImageCommand() { throw new Error('unexpected image write'); }
    };
    const owner = session.createReviewSession({ ref: value => ({ value }), fields,
        storage: { async listRecentTasks() { return []; } }, persistence });
    const sourceFor = q => q.stem;
    const open = id => owner.openBatch(id, { sourceFor });
    const prepareDraft = ({ question, source }) => ({ draft: { ...structuredClone(question), stem: source }, source });
    const save = () => owner.save({ prepareDraft, refreshStats: async () => {}, notify: text => notices.push(text) });
    return { owner, persistence, saved, notices, open, save, sourceFor };
}

test('the review owner keeps one ref set and selection cancellation preserves dirty editor state', async () => {
    const f = ownerFixture();
    await f.open('batch');
    f.owner.refs.activeDraftEditorBuffer.value = 'unsaved';
    assert.equal(f.owner.dirty(), true);
    assert.equal(await f.owner.select('batch_q2', { sourceFor: f.sourceFor, confirmLeave: () => false }), false);
    assert.equal(f.owner.current().id, 'batch_q1');
    assert.equal(f.owner.refs.activeDraftEditorBuffer.value, 'unsaved');
    assert.equal(await f.owner.select('batch_q2', { sourceFor: f.sourceFor, confirmLeave: () => true }), true);
    assert.equal(f.owner.current().id, 'batch_q2');
    assert.equal(f.owner.dirty(), false);
    f.owner.dispose();
});

test('switching batches clears selection and a late earlier read cannot publish into the new batch', async () => {
    const f = ownerFixture(), old = gate();
    const original = f.persistence.reloadDraftBatch;
    f.persistence.reloadDraftBatch = async id => id === 'old' ? old.promise : original(id);
    const pending = f.open('old');
    await Promise.resolve();
    await f.open('new');
    f.owner.refs.selectedDraftIds.value = ['new_q1'];
    old.resolve(await original('old'));
    assert.equal(await pending, false);
    assert.equal(f.owner.current().id, 'new_q1');
    assert.deepEqual(f.owner.refs.selectedDraftIds.value, ['new_q1']);
    await f.open('third');
    assert.deepEqual(f.owner.refs.selectedDraftIds.value, []);
    f.owner.dispose();
});

test('a storage rejection keeps source and saved baseline, and an explicit retry uses the original version', async () => {
    const f = ownerFixture();
    await f.open('batch');
    const original = f.persistence.persistReviewDraftCommand;
    f.persistence.persistReviewDraftCommand = async command => {
        assert.equal(command.expectedDraftVersion, 1);
        throw Object.assign(new Error('stale'), { code: 'REVIEW_WORKFLOW_STALE_DRAFT' });
    };
    f.owner.refs.activeDraftEditorBuffer.value = 'typed';
    assert.equal(await f.save(), false);
    assert.equal(f.owner.refs.activeDraftEditorBuffer.value, 'typed');
    assert.equal(f.owner.refs.activeDraftEditorOriginal.value, 'original 1');
    assert.equal(f.owner.current().version, 1);
    assert.match(f.notices[0], /REVIEW_WORKFLOW_STALE_DRAFT/);
    f.persistence.persistReviewDraftCommand = original;
    assert.equal(await f.save(), true);
    assert.equal(f.saved.length, 1);
    assert.equal(f.saved[0].expectedDraftVersion, 1);
    assert.equal(f.owner.current().version, 2);
    f.owner.dispose();
});

test('typing and changing metadata while a save is pending remains dirty after the earlier content is saved', async () => {
    const f = ownerFixture(), pending = gate();
    await f.open('batch');
    const persist = f.persistence.persistReviewDraftCommand;
    f.persistence.persistReviewDraftCommand = async command => { await pending.promise; return persist(command); };
    f.owner.refs.activeDraftEditorBuffer.value = 'submitted source';
    const saving = f.save();
    f.owner.refs.activeDraftEditorBuffer.value = 'newer typed source';
    f.owner.current().year = '2033';
    pending.resolve();
    assert.equal(await saving, false, 'new edits must stop a following automatic confirmation');
    assert.equal(f.owner.refs.activeDraftEditorOriginal.value, 'submitted source');
    assert.equal(f.owner.refs.activeDraftEditorBuffer.value, 'newer typed source');
    assert.equal(f.owner.current().year, '2033');
    assert.equal(f.owner.current().version, 2);
    assert.equal(f.owner.dirty(), true);
    f.owner.dispose();
});

test('saving an earlier batch never overwrites the newly selected batch editor', async () => {
    const f = ownerFixture(), pending = gate();
    await f.open('old');
    const persist = f.persistence.persistReviewDraftCommand;
    f.persistence.persistReviewDraftCommand = async command => { await pending.promise; return persist(command); };
    f.owner.refs.activeDraftEditorBuffer.value = 'saved old source';
    const saving = f.save();
    await f.owner.openBatch('new', { sourceFor: f.sourceFor, confirmLeave: () => true });
    f.owner.refs.activeDraftEditorBuffer.value = 'unsaved new source';
    pending.resolve();
    assert.equal(await saving, false);
    assert.equal(f.saved.length, 1);
    assert.equal(f.saved[0].batchId, 'old');
    assert.equal(f.owner.refs.activeDraftEditorBuffer.value, 'unsaved new source');
    assert.equal(f.owner.refs.activeDraftEditorOriginal.value, 'original 1');
    assert.equal(f.owner.current().batchId, 'new');
    f.owner.dispose();
});

test('submitted drafts cannot be saved and exit protection is released on dispose', async () => {
    const f = ownerFixture(), listeners = new Map();
    await f.open('batch');
    f.owner.current().status = 'submitted';
    assert.equal(await f.save(), false);
    assert.deepEqual(f.saved, []);
    const target = { addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) };
    f.owner.protectExit({ target });
    f.owner.refs.activeDraftEditorBuffer.value = 'unsaved';
    let prevented = false;
    listeners.get('beforeunload')({ preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
    f.owner.dispose(); f.owner.dispose();
    assert.equal(listeners.size, 0);
});



test('readback replacing the same draft object cannot lose a successful save version', async () => {
    const f = ownerFixture(), pending = gate();
    await f.open('batch');
    const persist = f.persistence.persistReviewDraftCommand;
    f.persistence.persistReviewDraftCommand = async command => { await pending.promise; return persist(command); };
    f.owner.refs.activeDraftEditorBuffer.value = 'saved after reload';
    const oldObject = f.owner.current();
    const saving = f.save();
    await f.owner.reload();
    assert.notEqual(f.owner.current(), oldObject);
    pending.resolve();
    assert.equal(await saving, true);
    assert.equal(f.owner.current().version, 2);
    assert.equal(f.owner.current().stem, 'saved after reload');
    f.owner.dispose();
});

test('leaving and reopening the same identity does not revive a previous visit save callback', async () => {
    const f = ownerFixture(), pending = gate();
    await f.open('old');
    const persist = f.persistence.persistReviewDraftCommand;
    f.persistence.persistReviewDraftCommand = async command => { await pending.promise; return persist(command); };
    f.owner.refs.activeDraftEditorBuffer.value = 'prior visit';
    const saving = f.save();
    await f.owner.openBatch('new', { sourceFor: f.sourceFor, confirmLeave: () => true });
    await f.open('old');
    f.owner.refs.activeDraftEditorBuffer.value = 'new visit';
    pending.resolve();
    assert.equal(await saving, false);
    assert.equal(f.owner.refs.activeDraftEditorOriginal.value, 'original 1');
    assert.equal(f.owner.refs.activeDraftEditorBuffer.value, 'new visit');
    f.owner.dispose();
});


test('metadata typed during save does not restore an obsolete stem from the pre-save field snapshot', async () => {
    const f = ownerFixture(), waiting = gate();
    await f.open('batch');
    const persist = f.persistence.persistReviewDraftCommand;
    f.persistence.persistReviewDraftCommand = async command => { await waiting.promise; return persist(command); };
    f.owner.refs.activeDraftEditorBuffer.value = 'new persisted stem';
    const action = f.save(); f.owner.current().year = '2044'; waiting.resolve();
    assert.equal(await action, false);
    assert.equal(f.owner.current().stem, 'new persisted stem');
    assert.equal(f.owner.current().year, '2044');
    assert.equal(f.owner.dirty(), true);
});
