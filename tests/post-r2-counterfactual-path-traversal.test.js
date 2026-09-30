const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Archive = require('../qisi-archive-security.js');
const { createTempJobManager } = require('../qisi-temp-job-manager.js');

test('Phase 3 traversal cannot cross archive or temp roots', async () => {
    const policy = Archive.createArchivePolicy('question-bank');
    const malicious = { files: {
        'questions.json': {
            name: 'questions.json', unsafeOriginalName: '../private/questions.json', dir: false,
            _data: { compressedSize: 10, uncompressedSize: 10 }
        }
    } };
    assert.equal(Archive.validateArchive(malicious, policy).code, 'ARCHIVE_PATH_TRAVERSAL');

    let removeCalls = 0;
    const logs = [];
    const manager = createTempJobManager({
        roots: [path.resolve('tmp/uploads')],
        fsPromises: { rm: async () => { removeCalls += 1; } },
        logger: (event, payload) => logs.push({ event, payload })
    });
    await manager.cleanupRequest({ uploadPath: path.resolve('private/answer.docx') });
    assert.equal(removeCalls, 0);
    assert.deepEqual(logs[0]?.payload, { code: 'TEMP_CLEANUP_PATH_REJECTED' });
});
