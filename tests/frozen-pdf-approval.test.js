const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { verifyFrozenPdfFiles } = require('../scripts/verify-frozen-pdf-files.js');

test('exact frozen approval rejects further content changes', () => {
    const file = 'qisi-pdf-support-controlled-write.js';
    const baseline = '9ab2f21282af4f5eb394658f31d5ba357cd46ca5';
    assert.deepEqual(verifyFrozenPdfFiles([file], baseline), []);
    const changed = fs.readFileSync(path.join(__dirname, '..', file), 'utf8') + '\n// unapproved change';
    assert.deepEqual(verifyFrozenPdfFiles([file], baseline, () => changed), [file]);
});
