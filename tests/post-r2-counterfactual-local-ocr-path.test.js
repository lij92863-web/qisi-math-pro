const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createLocalAdapter } = require('../qisi-ocr-local-adapter.js');

test('Phase 3 local OCR arbitrary path is rejected before transport', async () => {
    let transportCalls = 0;
    const adapter = createLocalAdapter({
        transport: async () => { transportCalls += 1; return { rawText: 'private' }; }
    });
    const privatePath = 'C:/Users/teacher/private-answer.png';
    await assert.rejects(
        adapter.recognizePage({ path: privatePath, mimeType: 'image/png', bytes: 1 }),
        error => error.code === 'local-path-forbidden' && !error.message.includes(privatePath)
    );
    assert.equal(transportCalls, 0);
});

test('Phase 3 matrix records local OCR arbitrary path', () => {
    const matrix = fs.readFileSync(path.resolve(__dirname, '..', 'docs/testing/POST_R2_COUNTERFACTUAL_MATRIX_R1.md'), 'utf8');
    assert.match(matrix, /\| local OCR arbitrary path \|[^\n]+\| PASS \|/);
});
