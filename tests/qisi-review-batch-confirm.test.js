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
