const test = require('node:test');
const assert = require('node:assert/strict');

const { createReviewController } = require('../qisi-review-controller.js');

test('review lifecycle edits immutably, tracks dirty state, and cancels', () => {
    const controller = createReviewController({ clock: () => 10 });
    const original = { id: 'd1', stem: 'old', warnings: [], status: 'pending' };
    const session = controller.open(original);
    const edited = controller.editField(session.draft, 'stem', 'new');

    assert.equal(original.stem, 'old');
    assert.equal(edited.stem, 'new');
    assert.equal(edited.manualEdited, true);
    assert.equal(controller.isDirty(edited, session.baseline), true);
    const cancelled = controller.cancel({ ...session, draft: edited, dirty: true });
    assert.equal(cancelled.draft.stem, 'old');
    assert.equal(cancelled.cancelled, true);
});

test('warnings deduplicate and provenance display remains evidence-only', () => {
    const controller = createReviewController();
    const draft = controller.addWarning({
        warnings: ['check'],
        provenance: {
            stem: { file: 'source.pdf', page: 2, engine: 'mock' }
        }
    }, 'check');
    assert.deepEqual(draft.warnings, ['check']);
    assert.deepEqual(controller.provenanceDisplay(draft), [{
        field: 'stem',
        sourceFile: 'source.pdf',
        page: 2,
        block: '',
        engine: 'mock',
        repair: false,
        manualEdit: false,
        decision: ''
    }]);
    assert.deepEqual(
        controller.removeWarning(draft, 'check').warnings,
        []
    );
});

test('Vue-style proxy drafts clone as plain data', () => {
    const controller = createReviewController({ clock: () => 20 });
    const proxy = new Proxy(
        { id: 'd1', stem: 'old', status: 'pending' },
        {}
    );

    assert.doesNotThrow(() =>
        controller.editField(proxy, 'stem', 'new')
    );
    assert.equal(controller.editField(proxy, 'stem', 'new').stem, 'new');
});
