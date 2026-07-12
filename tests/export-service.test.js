const test = require('node:test');
const assert = require('node:assert/strict');

const Export = require('../qisi-export-service.js');

test('maps manifest, questions, images, filename, and progress', async () => {
    const progress = [];
    const service = Export.createExportService({
        coreFingerprint: question => `core:${question.id}`,
        stemFingerprint: question => `stem:${question.id}`,
        resolveImages: async ids => ids.map(id => ({ id, blob: `blob:${id}` })),
        clock: () => new Date('2026-07-12T00:00:00.000Z')
    });
    const source = [{
        id: 'q1',
        stem: 'question',
        images: [{ id: 'i1', align: 'left', url: 'private-url' }]
    }];
    const plan = await service.build(source, {
        teacherName: 'Teacher / One',
        onProgress: event => progress.push(event)
    });

    assert.equal(plan.manifest.questionCount, 1);
    assert.equal(plan.manifest.schemaVersion, '1.0');
    assert.deepEqual(plan.questions[0].images, [{
        id: 'i1', align: 'left', file: 'images/i1.png'
    }]);
    assert.equal(plan.questions[0].exportFingerprint, 'core:q1');
    assert.equal(plan.images[0].blob, 'blob:i1');
    assert.equal(plan.filename, '高中数学题库数据_Teacher___One_20260712.zip');
    assert.equal(progress.at(-1).stage, 'complete');
    assert.equal(source[0].images[0].url, 'private-url');
});

test('legacy question arrays and missing images remain compatible', async () => {
    const service = Export.createExportService({
        resolveImages: async () => []
    });
    const plan = await service.build([{
        id: 'legacy', stem: 'legacy', images: [{ id: 'missing' }]
    }]);
    assert.deepEqual(plan.missingImageIds, ['missing']);
    assert.equal(plan.questions[0].stem, 'legacy');
});
