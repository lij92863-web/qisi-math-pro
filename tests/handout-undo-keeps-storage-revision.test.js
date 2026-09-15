const test = require('node:test');
const assert = require('node:assert/strict');

const model = require('../qisi-handout-model.js');
const editorState = require('../qisi-handout-editor-state.js');

const handoutAt = (revision, updatedAt) => model.assertValidHandout({
    id: 'handout-1',
    title: '讲义',
    blocks: [{ id: 'block-1', type: 'body', content: '正文' }],
    settings: {},
    createdAt: '2026-09-15T04:00:00.000Z',
    updatedAt,
    revision
});

const FIRST_SAVED_AT = '2026-09-15T04:00:01.000Z';
const SECOND_SAVED_AT = '2026-09-15T04:00:02.000Z';

// Reproduces the H3 failure: the first save acknowledges revision 2, then an undo restores a
// snapshot taken while revision 1 was current. If the restored snapshot also brings back the old
// updatedAt/revision, the next save is rejected with HANDOUT_CONFLICT even though only one page
// ever touched the document.
test('undo keeps the stored revision so the next save cannot conflict with itself', () => {
    let state = editorState.createEditorState(handoutAt(1, FIRST_SAVED_AT));

    state = editorState.commitHandout(
        state,
        {
            ...state.handout,
            blocks: [...state.handout.blocks, { id: 'block-2', type: 'heading', level: 1, text: '标题' }]
        },
        { mutationKey: 'add:heading' }
    );

    // The snapshot pushed by that edit still carries revision 1.
    assert.equal(state.undoStack.at(-1).revision, 1);

    state = editorState.acknowledgeSave(
        state,
        state.handout,
        { ...state.handout, updatedAt: SECOND_SAVED_AT, revision: 2 }
    );
    assert.equal(state.handout.revision, 2);

    state = editorState.undo(state);

    assert.equal(state.handout.revision, 2, 'undo must not restore an older stored revision');
    assert.equal(state.handout.updatedAt, SECOND_SAVED_AT, 'undo must keep the acknowledged timestamp');
    assert.equal(state.handout.blocks.length, 1, 'undo must still restore the older content');

    state = editorState.redo(state);

    assert.equal(state.handout.revision, 2, 'redo must keep the stored revision as well');
    assert.equal(state.handout.updatedAt, SECOND_SAVED_AT);
    assert.equal(state.handout.blocks.length, 2);
});
