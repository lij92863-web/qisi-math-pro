const test = require('node:test');
const assert = require('node:assert/strict');

const { createReviewController } = require('../qisi-review-controller.js');

test('confirmation fails closed and never calls a repository', () => {
    let validationCalls = 0;
    const controller = createReviewController({
        validateDraft(draft) {
            validationCalls += 1;
            return {
                valid: Boolean(draft.stem && draft.controlledWriteAccepted),
                errors: [{ code: 'controlled-write-required' }],
                warnings: []
            };
        }
    });
    const rejected = controller.confirm({
        id: 'd1',
        stem: 'question',
        controlledWriteAccepted: false,
        status: 'pending'
    });
    assert.equal(validationCalls, 1);
    assert.equal(rejected.accepted, false);
    assert.equal(rejected.draft.status, 'pending');
});

test('confirmation marks manual evidence but does not invent content', () => {
    const controller = createReviewController({
        validateDraft: () => ({ valid: true, errors: [], warnings: [] }),
        clock: () => 1000
    });
    const original = {
        id: 'd1',
        stem: 'question',
        answer: '',
        solution: '',
        status: 'pending'
    };
    const result = controller.confirm(original);

    assert.equal(result.accepted, true);
    assert.equal(result.draft.status, 'reviewed');
    assert.equal(result.draft.manualConfirmed, true);
    assert.equal(result.draft.answer, '');
    assert.equal(result.draft.solution, '');
    assert.equal(original.status, 'pending');
});
