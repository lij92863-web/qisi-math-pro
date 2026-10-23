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

const { createReviewSession } = require('../qisi-review-session-commands');
const fields = require('../qisi-review-draft-state');
const { createReviewController } = require('../qisi-review-controller');
const controller = createReviewController({ formalFields: ['stem', 'options', 'answer', 'solution', 'images'] });
const gate = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
async function imageFixture() {
    const notices = [], writes = [], renders = [];
    const image = { id: 'i1', batchId: 'b', questionId: 'b_q1', source: 'docx-inline-figure',
        url: 'data:image/png;base64,original', status: 'need_confirm', confidence: 0.4, updatedAt: 1 };
    const unassigned = { ...image, id: 'u', questionId: '', source: 'uploaded-question-image' };
    const original = { id: 'b_q1', batchId: 'b', version: 1, status: 'pending',
        stem: 'stem [[IMAGE:i1]]', options: ['one [[IMAGE:i1]]', 'two'], answer: 'answer', solution: 'solution',
        images: [{ ...image }], warnings: ['图片需要确认', 'raw warning'], imageReviewStatus: 'need_confirm',
        sourcePage: 2, sourceFileId: 'file', rawText: 'RAW_EVIDENCE' };
    const persistence = {
        async reloadDraftBatch(batchId) {
            return { batch: { id: batchId }, questions: [{ ...structuredClone(original), id: batchId + '_q1', batchId }],
                images: batchId === 'b' ? structuredClone([image, unassigned]) : [],
                files: [{ id: 'file', batchId, filename: 'fixture.docx', fileType: 'docx' }] };
        },
        async persistReviewDraftCommand(command) {
            writes.push(structuredClone(command));
            return { draft: { ...structuredClone(command.draft), version: command.expectedDraftVersion + 1 }, images: command.images };
        },
        async persistReviewImageCommand(command) {
            writes.push(structuredClone(command));
            return { image: { ...unassigned, ...command.patch, updatedAt: command.updatedAt } };
        }
    };
    const session = createReviewSession({ ref: value => ({ value }), fields,
        storage: { async listRecentTasks() { return []; } }, persistence });
    const sourceFor = q => q.editorSource || q.stem + '\nA. ' + q.options[0] + '\nB. ' + q.options[1];
    await session.openBatch('b', { sourceFor });
    const source = { id: 'page', batchId: 'b', questionId: 'b_q1', source: 'source-page', sourceFileId: 'file', sourcePage: 2, url: 'page-pixels' };
    const cropPort = { async render(input) { renders.push(input); return { url: 'cropped-pixels', bbox: [1, 2, 31, 42], width: 30, height: 40 }; } };
    const owner = commands.createImageCommands({ session, controller, persistence,
        utils: { preserveRawEvidence(q) { q.rawTextOriginal = q.rawText; }, cleanDisplayFieldsOnly() {} },
        pdfContract: () => null, sourceFor,
        realImagesFor: q => session.refs.batchDraftImages.value.filter(row => row.questionId === q.id && row.status !== 'deleted'),
        sourceImagesFor: () => [source], appendTokens: fields.appendImageTokensToStemForV2,
        removeToken: fields.removeImageTokenFromStemForV2, cropPort, makeId: () => 'crop1',
        refreshStats: async () => {}, notify: message => notices.push(message), clock: () => 20 });
    return { owner, session, persistence, source, cropPort, sourceFor, notices, writes, renders };
}

test('image confirmation keeps canonical image/draft/baseline untouched on rejection and only advances after explicit retry', async () => {
    const f = await imageFixture(), before = structuredClone(f.session.current());
    const images = structuredClone(f.session.refs.batchDraftImages.value);
    const persist = f.persistence.persistReviewDraftCommand;
    f.persistence.persistReviewDraftCommand = async () => { throw new Error('version-conflict'); };
    assert.equal(await f.owner.confirmImages(), false);
    assert.deepEqual(f.session.current(), before);
    assert.deepEqual(f.session.refs.batchDraftImages.value, images);
    assert.equal(f.session.dirty(), false);
    f.persistence.persistReviewDraftCommand = persist;
    assert.equal(await f.owner.confirmImages(), true);
    assert.equal(f.session.current().version, 2);
    assert.equal(f.session.current().imageReviewStatus, 'confirmed');
    assert.deepEqual(f.session.current().warnings, ['raw warning']);
    assert.equal(f.session.refs.batchDraftImages.value[0].confidence, 0.9);
    assert.equal(f.session.current().rawTextOriginal, 'RAW_EVIDENCE');
});

test('image deletion requires ownership and consent, then removes tokens from all fields in the same draft/image command', async () => {
    const f = await imageFixture();
    assert.equal(await f.owner.deleteImage('u', () => true), false);
    assert.equal(await f.owner.deleteImage('i1', () => false), false);
    assert.equal(f.writes.length, 0);
    assert.equal(await f.owner.deleteImage('i1', () => true), true);
    assert.equal(f.writes.length, 1);
    const write = f.writes[0];
    assert.equal(write.expectedDraftVersion, 1);
    assert.equal(write.images[0].status, 'deleted');
    assert.doesNotMatch(JSON.stringify([write.draft.stem, write.draft.options, write.draft.editorSource]), /IMAGE:i1/);
    assert.equal(f.session.refs.batchDraftImages.value.find(row => row.id === 'u').status, 'need_confirm');
    assert.equal(f.session.dirty(), false);
});

test('binding rejects source pages and already bound rows and a write failure cannot assign the free image', async () => {
    const f = await imageFixture();
    f.session.refs.batchDraftImages.value.push({ ...f.source, id: 'page-row', questionId: '' });
    assert.equal(await f.owner.bind('page-row', 'b_q1'), false);
    assert.equal(await f.owner.bind('i1', 'b_q1'), false);
    const persist = f.persistence.persistReviewDraftCommand;
    f.persistence.persistReviewDraftCommand = async () => { throw new Error('quota'); };
    assert.equal(await f.owner.bind('u', 'b_q1'), false);
    assert.equal(f.session.refs.batchDraftImages.value.find(row => row.id === 'u').questionId, '');
    assert.equal(f.session.current().images.length, 1);
    f.persistence.persistReviewDraftCommand = persist;
    assert.equal(await f.owner.bind('u', 'b_q1'), true);
    assert.match(f.session.current().stem, /IMAGE:u/);
    assert.match(f.session.refs.activeDraftEditorBuffer.value, /IMAGE:u/);
    assert.equal(f.session.refs.batchDraftImages.value.find(row => row.id === 'u').questionId, 'b_q1');
    assert.equal(f.session.dirty(), false);
});

test('dirty and submitted drafts reject image writes without consuming unsaved source', async () => {
    const f = await imageFixture();
    f.session.refs.activeDraftEditorBuffer.value = 'new input';
    assert.equal(await f.owner.confirmImages(), false);
    assert.equal(await f.owner.bind('u', 'b_q1'), false);
    assert.equal(await f.owner.deleteImage('i1', () => true), false);
    assert.equal(f.writes.length, 0);
    assert.equal(f.session.refs.activeDraftEditorBuffer.value, 'new input');
    f.session.discard(); f.session.current().status = 'submitted';
    assert.equal(await f.owner.confirmImages(), false);
    assert.equal(f.writes.length, 0);
});

test('crop identity fails closed on wrong batch, question, file, page or pixels before rendering or persistence', async () => {
    const f = await imageFixture();
    for (const patch of [{ batchId: 'other' }, { questionId: 'b_q2' }, { sourceFileId: 'missing' },
        { sourcePage: 0 }, { sourcePage: 3 }, { url: 'foreign-pixels' }]) {
        assert.equal(f.owner.captureCrop({ ...f.source, ...patch }), null);
    }
    assert.equal(f.renders.length, 0); assert.equal(f.writes.length, 0);
});

test('cancelled or switched-away crop pixels never create an orphan image or token', async () => {
    for (const mode of ['cancel', 'batch']) {
        const f = await imageFixture(), render = gate();
        let cancelled = false;
        f.cropPort.render = () => render.promise;
        const token = f.owner.captureCrop(f.source);
        const pending = f.owner.crop({ token, source: f.source, isCancelled: () => cancelled });
        if (mode === 'cancel') cancelled = true;
        else await f.session.openBatch('new', { sourceFor: f.sourceFor });
        render.resolve({ url: 'pixels', bbox: [0, 0, 30, 30] });
        assert.equal(await pending, false);
        assert.equal(f.writes.length, 0);
        assert.equal(f.session.current().images.length, 1);
    }
});

test('a late image persistence receipt preserves later source and metadata while advancing the saved baseline', async () => {
    const f = await imageFixture(), waiting = gate(), persist = f.persistence.persistReviewDraftCommand;
    f.persistence.persistReviewDraftCommand = async command => { await waiting.promise; return persist(command); };
    const pending = f.owner.deleteImage('i1', () => true);
    f.session.refs.activeDraftEditorBuffer.value = 'new unsaved input';
    f.session.current().year = '2040';
    waiting.resolve();
    await pending;
    assert.equal(f.session.refs.activeDraftEditorBuffer.value, 'new unsaved input');
    assert.equal(f.session.current().year, '2040');
    assert.equal(f.session.current().version, 2);
    assert.doesNotMatch(f.session.refs.activeDraftEditorOriginal.value, /IMAGE:i1/);
    assert.doesNotMatch(f.session.current().stem, /IMAGE:i1/);
    assert.equal(f.session.dirty(), true);
});

test('unassigned deletion rejects bound images and remains usable for a batch with zero drafts', async () => {
    const f = await imageFixture();
    assert.equal(await f.owner.deleteUnassigned('i1', () => true), false);
    f.session.refs.batchDraftQuestions.value = [];
    assert.equal(await f.owner.deleteUnassigned('u', () => true), true);
    assert.equal(f.session.refs.batchDraftImages.value.find(row => row.id === 'u').status, 'deleted');
});


test('image and pixel factories fail closed without their explicit ports', () => {
    assert.throws(() => commands.createImageCommands(), error => error.code === 'REVIEW_IMAGE_COMMAND_PORT_REQUIRED');
    assert.throws(() => commands.createCropPort(), error => error.code === 'REVIEW_CROP_PORT_REQUIRED');
});
