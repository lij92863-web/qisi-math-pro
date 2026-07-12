const test = require('node:test');
const assert = require('node:assert/strict');

const { createReviewController } = require('../qisi-review-controller.js');

const draft = () => ({ id: 'draft-1', stem: 'question', status: 'pending' });
const firstCode = result => result.validation.errors[0]?.code;

test('missing review validator blocks confirmation', () => {
    const controller = createReviewController();
    const original = draft();
    const result = controller.confirm(original);
    assert.equal(result.accepted, false);
    assert.equal(firstCode(result), 'validator-required');
    assert.equal(result.draft.status, 'pending');
    assert.equal(original.status, 'pending');
});

test('malformed review validator results block confirmation', () => {
    for (const validation of [null, {}, { valid: 'true' }, { valid: true, errors: 'bad' }]) {
        const controller = createReviewController({
            validateDraft: () => validation
        });
        const result = controller.confirm(draft());
        assert.equal(result.accepted, false);
        assert.equal(firstCode(result), 'validator-malformed');
        assert.equal(result.draft.status, 'pending');
    }
});

test('throwing review validator blocks confirmation without escaping', () => {
    const controller = createReviewController({
        validateDraft: () => { throw new Error('validator internals'); }
    });
    const result = controller.confirm(draft());
    assert.equal(result.accepted, false);
    assert.equal(firstCode(result), 'validator-failed');
    assert.equal(result.draft.status, 'pending');
});

test('explicit invalid review result never marks a draft reviewed', () => {
    const controller = createReviewController({
        validateDraft: () => ({
            valid: false,
            errors: [{ code: 'admission-invalid', message: 'blocked' }],
            warnings: []
        })
    });
    const result = controller.confirm(draft());
    assert.equal(result.accepted, false);
    assert.equal(firstCode(result), 'admission-invalid');
    assert.equal(result.draft.status, 'pending');
});
