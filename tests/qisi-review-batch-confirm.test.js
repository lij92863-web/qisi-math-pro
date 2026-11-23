const test = require('node:test');
const assert = require('node:assert/strict');
const batch = require('../qisi-review-batch-confirm.js');

test('toggleSelection adds, removes and ignores empty ids', () => {
    assert.deepEqual(batch.toggleSelection([], 'a'), ['a']);
    assert.deepEqual(batch.toggleSelection(['a'], 'a'), []);
    assert.deepEqual(batch.toggleSelection(['a', 'b'], 'c'), ['a', 'b', 'c']);
    const current = ['a'];
    assert.equal(batch.toggleSelection(current, ''), current);
    assert.equal(batch.toggleSelection(undefined, 'a').length, 1);
});

test('selectAllVisible selects all, then clears when everything is already selected', () => {
    assert.deepEqual(batch.selectAllVisible(['x'], ['a', 'b']), ['x', 'a', 'b']);
    assert.deepEqual(batch.selectAllVisible(['x', 'a', 'b'], ['a', 'b']), ['x']);
    assert.deepEqual(batch.selectAllVisible(['a'], []), ['a']);
    assert.deepEqual(batch.selectAllVisible(['a', 'a'], ['a']), []);
});

test('eligibleDrafts keeps order and skips missing, reviewed and submitted rows', () => {
    const drafts = [
        { id: 'a', status: 'pending' },
        { id: 'b', status: 'reviewed' },
        { id: 'c', status: 'submitted' },
        { id: 'd', status: 'pending' }
    ];
    assert.deepEqual(batch.eligibleDrafts(drafts, ['d', 'b', 'missing', 'a']).map(draft => draft.id), ['d', 'a']);
    assert.deepEqual(batch.eligibleDrafts(null, ['a']), []);
    assert.deepEqual(batch.eligibleDrafts(drafts, null), []);
});

test('batchConfirmNotice reports failures only when some rows failed', () => {
    assert.equal(batch.batchConfirmNotice(3, 0), '已确认 3 题。');
    assert.equal(batch.batchConfirmNotice(2, 1), '已确认 2 题，1 题未通过。');
    assert.equal(batch.batchConfirmNotice(0, 0), '已确认 0 题。');
});

const { createReviewSession } = require('../qisi-review-session-commands');
const state = require('../qisi-review-draft-state');
const gate = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
async function actionFixture() {
    const events = [], notices = [], failures = [], rows = new Map();
    const getRows = batchId => {
        if (!rows.has(batchId)) rows.set(batchId, [1, 2, 3].map(n => ({ id: batchId + '_q' + n, batchId,
            version: 1, status: 'pending', stem: 'source ' + n, images: [], options: [], warnings: [] })));
        return rows.get(batchId);
    };
    const persistence = {
        async reloadDraftBatch(batchId) { events.push('read:' + batchId); return { batch: { id: batchId },
            questions: structuredClone(getRows(batchId)), images: [], files: [] }; },
        async persistReviewDraftCommand(command) {
            events.push('save:' + command.draft.id);
            const saved = { ...structuredClone(command.draft), version: command.expectedDraftVersion + 1 };
            getRows(command.batchId).splice(getRows(command.batchId).findIndex(q => q.id === saved.id), 1, saved);
            return { draft: structuredClone(saved) };
        }, async persistReviewImageCommand() { throw new Error('unexpected image'); }
    };
    const session = createReviewSession({ ref: value => ({ value }), fields: state,
        storage: { async listRecentTasks() { return []; } }, persistence });
    const sourceFor = q => q.stem;
    await session.openBatch('b', { sourceFor }); events.length = 0;
    const workflow = {
        async confirmDraft(command) {
            events.push('confirm:' + command.draftId + ':v' + command.expectedDraftVersion);
            const q = getRows(command.batchId).find(row => row.id === command.draftId);
            assert.equal(q.version, command.expectedDraftVersion);
            Object.assign(q, { status: 'reviewed', version: q.version + 1 });
            return { accepted: true, draft: structuredClone(q) };
        },
        async submitDraft(command) {
            events.push('submit:' + command.draftId + ':v' + command.expectedDraftVersion);
            const q = getRows(command.batchId).find(row => row.id === command.draftId);
            assert.equal(q.status, 'reviewed'); assert.equal(q.version, command.expectedDraftVersion);
            Object.assign(q, { status: 'submitted', version: q.version + 1, submittedQuestionId: 'formal:' + q.id });
            return { accepted: true, draft: structuredClone(q) };
        }
    };
    const owner = batch.createReviewActions({ session, workflow, sourceFor,
        editor: { imagesFor: () => [], refreshStats: async () => {},
            prepareDraft: ({ question, source }) => ({ draft: { ...structuredClone(question), stem: source }, source }) },
        refreshLibrary: async () => { events.push('library'); }, notify: value => notices.push(value),
        reportFailure: value => failures.push(value), errorText: error => error.code || error.message });
    return { owner, session, workflow, persistence, getRows, events, notices, failures, sourceFor };
}

test('review saves and confirms the edited version, and submission requires a separate action', async () => {
    const f = await actionFixture();
    f.session.refs.activeDraftEditorBuffer.value = 'edited source';
    assert.equal(await f.owner.submitReviewed(), false);
    assert.deepEqual(f.events, []);
    assert.equal(await f.owner.reviewDraft(), true);
    assert.deepEqual(f.events, ['save:b_q1', 'confirm:b_q1:v2', 'read:b']);
    assert.equal(f.session.current().status, 'reviewed');
    assert.equal(await f.owner.submitReviewed(), true);
    assert.deepEqual(f.events, ['save:b_q1', 'confirm:b_q1:v2', 'read:b', 'submit:b_q1:v3', 'library', 'read:b']);
    assert.equal(f.session.current().status, 'submitted'); assert.equal(f.session.current().version, 4);
    assert.equal(f.session.dirty(), false);
});

test('explicit retry of failed formal admission never repeats a durable confirmation', async () => {
    const f = await actionFixture(), submit = f.workflow.submitDraft;
    assert.equal(await f.owner.reviewDraft(), true);
    f.workflow.submitDraft = async () => { throw new Error('storage failed'); };
    assert.equal(await f.owner.submitReviewed(), false);
    assert.equal(f.session.current().status, 'reviewed');
    assert.match(f.failures[0], /已确认/);
    f.workflow.submitDraft = submit;
    assert.equal(await f.owner.submitReviewed(), true);
    assert.equal(f.events.filter(event => event.startsWith('confirm')).length, 1);
    assert.equal(f.events.filter(event => event.startsWith('submit')).length, 1);
});

test('batch confirmation is serial, continues past a rejected middle draft and never submits', async () => {
    const f = await actionFixture(), confirm = f.workflow.confirmDraft;
    f.session.refs.selectedDraftIds.value = ['b_q1', 'b_q2', 'b_q3'];
    f.workflow.confirmDraft = async command => {
        if (command.draftId === 'b_q2') { f.events.push('throw:b_q2'); throw new Error('middle failure'); }
        return confirm(command);
    };
    assert.equal(await f.owner.confirmSelected(), false);
    assert.deepEqual(f.events, ['confirm:b_q1:v1', 'throw:b_q2', 'confirm:b_q3:v1', 'read:b']);
    assert.deepEqual(f.session.refs.selectedDraftIds.value, ['b_q2']);
    assert.deepEqual(f.session.refs.batchDraftQuestions.value.map(q => q.status), ['reviewed', 'pending', 'reviewed']);
    assert.match(f.notices.at(-1), /已确认 2 题，1 题未通过/);
});

test('a pending batch preserves new input and newly selected IDs and stops further automatic confirmations', async () => {
    const f = await actionFixture(), confirm = f.workflow.confirmDraft, waiting = gate();
    f.session.refs.selectedDraftIds.value = ['b_q1', 'b_q2'];
    f.workflow.confirmDraft = async command => { await waiting.promise; return confirm(command); };
    const action = f.owner.confirmSelected();
    f.session.refs.activeDraftEditorBuffer.value = 'new input';
    f.session.current().year = '2045';
    f.session.refs.selectedDraftIds.value.push('b_q3');
    waiting.resolve(); assert.equal(await action, false);
    assert.deepEqual(f.session.refs.selectedDraftIds.value, ['b_q3', 'b_q2']);
    assert.equal(f.session.current().year, '2045');
    assert.equal(f.session.refs.activeDraftEditorBuffer.value, 'new input');
    assert.equal(f.session.dirty(), true);
    assert.equal(f.events.filter(event => event.startsWith('confirm')).length, 1);
});

test('a pending batch cannot change another batch selection or submit on its behalf', async () => {
    const f = await actionFixture(), confirm = f.workflow.confirmDraft, waiting = gate();
    f.session.refs.selectedDraftIds.value = ['b_q1', 'b_q2'];
    f.workflow.confirmDraft = async command => { await waiting.promise; return confirm(command); };
    const action = f.owner.confirmSelected();
    await f.session.openBatch('new', { sourceFor: f.sourceFor });
    f.session.refs.selectedDraftIds.value = ['new_q3'];
    waiting.resolve(); assert.equal(await action, false);
    assert.deepEqual(f.session.refs.selectedDraftIds.value, ['new_q3']);
    assert.equal(f.session.current().id, 'new_q1');
    assert.equal(f.events.filter(event => event.startsWith('confirm')).length, 1);
});

test('a completed formal insert remains submitted when library refresh fails and a later click cannot insert twice', async () => {
    const f = await actionFixture();
    const broken = batch.createReviewActions({ session: f.session, workflow: f.workflow, sourceFor: f.sourceFor,
        editor: { imagesFor: () => [], refreshStats: async () => {}, prepareDraft: () => { throw new Error('unused'); } },
        refreshLibrary: async () => { throw new Error('library unavailable'); }, notify: value => f.notices.push(value),
        reportFailure: value => f.failures.push(value), errorText: error => error.message });
    assert.equal(await broken.reviewDraft(), true);
    assert.equal(await broken.submitReviewed(), false);
    assert.equal(f.session.current().status, 'submitted'); assert.match(f.failures.at(-1), /已入库/);
    assert.equal(await broken.submitReviewed(), true);
    assert.equal(f.events.filter(event => event.startsWith('submit')).length, 1);
});


test('review action factory rejects missing required ports', () => {
    assert.throws(() => batch.createReviewActions(), /REVIEW_ACTION_PORT_REQUIRED/);
});
