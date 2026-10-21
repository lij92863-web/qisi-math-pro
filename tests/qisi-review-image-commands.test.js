const test = require('node:test');
const assert = require('node:assert/strict');
const commands = require('../qisi-review-image-commands.js');

const question = (overrides = {}) => ({
    id: 'q1',
    stem: 'stem [[IMAGE:i1]]',
    editorSource: 'stem [[IMAGE:i1]]',
    images: [{ id: 'i1' }, { id: 'i2' }],
    warnings: ['图片需要确认：i1', '图片尚未确认', '其他警告'],
    ...overrides
});

test('planConfirmImages clears only the image-confirmation warnings', () => {
    const plan = commands.planConfirmImages({ question: question(), images: [{ id: 'i1', confidence: 0.4 }, { id: 'i2' }] });
    assert.deepEqual(plan.warnings, ['其他警告']);
    assert.deepEqual(plan.imageUpdates, [
        { id: 'i1', status: 'bound', confidence: 0.9 },
        { id: 'i2', status: 'bound', confidence: 0.9 }
    ]);
});

test('planConfirmImages keeps a higher existing confidence', () => {
    const plan = commands.planConfirmImages({ question: question(), images: [{ id: 'i1', confidence: 0.99 }] });
    assert.equal(plan.imageUpdates[0].confidence, 0.99);
});

test('planConfirmImages returns null without a question', () => {
    assert.equal(commands.planConfirmImages({ question: null, images: [] }), null);
});

test('planImageDeletion removes the image row and its tokens', () => {
    const plan = commands.planImageDeletion({
        question: question({ images: [{ id: 'i1' }, { id: 'i2' }] }),
        imageId: 'i1',
        currentSource: 'stem [[IMAGE:i1]] tail',
        removeToken: (text, id) => text.replace(' [[IMAGE:' + id + ']]', '')
    });
    assert.deepEqual(plan.images.map(image => image.id), ['i2']);
    assert.equal(plan.stem, 'stem');
    assert.equal(plan.editorSource, 'stem tail');
});

test('planImageDeletion returns null without a question or image id', () => {
    assert.equal(commands.planImageDeletion({ question: null, imageId: 'i1', removeToken: (t) => t }), null);
    assert.equal(commands.planImageDeletion({ question: question(), imageId: '', removeToken: (t) => t }), null);
});

test('planImageDeletion fails closed without the token helper', () => {
    assert.throws(() => commands.planImageDeletion({ question: question(), imageId: 'i1' }),
        error => error.code === 'REVIEW_IMAGE_COMMAND_TOKEN_HELPER_REQUIRED');
});
