const test = require('node:test');
const assert = require('node:assert/strict');

const Export = require('../qisi-export-service.js');

test('invalid questions and image failures have stable errors', async () => {
    const service = Export.createExportService({
        resolveImages: async () => { throw new Error('image db unavailable'); }
    });
    await assert.rejects(
        service.build('not-array'),
        error => error.code === 'invalid-question'
    );
    await assert.rejects(
        service.build([{ id: 'q1', images: [{ id: 'i1' }] }]),
        error => error.code === 'image-resolution-failed'
    );
});

test('cancellation stops before mapping or after image resolution', async () => {
    const before = new AbortController();
    before.abort();
    const service = Export.createExportService();
    await assert.rejects(
        service.build([{ id: 'q1' }], { signal: before.signal }),
        error => error.code === 'cancelled'
    );

    const during = new AbortController();
    const delayed = Export.createExportService({
        resolveImages: async () => {
            during.abort();
            return [];
        }
    });
    await assert.rejects(
        delayed.build([{ id: 'q1', images: [{ id: 'i1' }] }], {
            signal: during.signal
        }),
        error => error.code === 'cancelled'
    );
});
