const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Archive = require('../qisi-archive-security.js');

const entry = (name, compressedSize, uncompressedSize) => ({
    name, dir: false, _data: { compressedSize, uncompressedSize }
});
const zip = entries => ({ files: Object.fromEntries(entries.map(item => [item.name, item])) });

test('Phase 3 ZIP bomb indicators fail before entry reads', () => {
    const policy = Archive.createArchivePolicy('question-bank', {
        maxEntries: 4, maxTotalUncompressedBytes: 1000,
        maxEntryUncompressedBytes: 600, maxCompressionRatio: 20
    });
    assert.equal(Archive.validateArchive(zip([entry('questions.json', 1, 500)]), policy).code, 'ARCHIVE_COMPRESSION_RATIO_LIMIT');
    assert.equal(Archive.validateArchive(zip([entry('questions.json', 100, 601)]), policy).code, 'ARCHIVE_ENTRY_SIZE_LIMIT');
    assert.equal(Archive.validateArchive(zip([entry('manifest.json', 100, 500), entry('questions.json', 100, 501)]), policy).code, 'ARCHIVE_TOTAL_SIZE_LIMIT');
});

test('Phase 3 matrix records ZIP bomb', () => {
    const matrix = fs.readFileSync(path.resolve(__dirname, '..', 'docs/testing/POST_R2_COUNTERFACTUAL_MATRIX_R1.md'), 'utf8');
    assert.match(matrix, /\| ZIP bomb \|[^\n]+\| PASS \|/);
});
