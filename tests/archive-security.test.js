const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
    validateArchive,
    createArchivePolicy
} = require('../qisi-archive-security.js');

const entry = (name, compressedSize, uncompressedSize, extra = {}) => ({
    name,
    dir: false,
    _data: { compressedSize, uncompressedSize },
    ...extra
});

const zip = entries => ({ files: Object.fromEntries(entries.map(item => [item.name, item])) });

const bankPolicy = () => createArchivePolicy('question-bank', {
    maxEntries: 4,
    maxTotalUncompressedBytes: 1000,
    maxEntryUncompressedBytes: 600,
    maxCompressionRatio: 20
});

test('archive policy accepts the bounded question-bank shape', () => {
    const result = validateArchive(zip([
        entry('manifest.json', 20, 100),
        entry('questions.json', 40, 500),
        entry('images/a.png', 100, 300)
    ]), bankPolicy());
    assert.equal(result.ok, true);
    assert.equal(result.entryCount, 3);
    assert.equal(result.totalUncompressedBytes, 900);
});

test('archive policy rejects entry-count, total-size, and per-entry-size overflow', () => {
    assert.equal(validateArchive(zip([
        entry('manifest.json', 1, 1), entry('questions.json', 1, 1),
        entry('images/a.png', 1, 1), entry('images/b.png', 1, 1),
        entry('images/c.png', 1, 1)
    ]), bankPolicy()).code, 'ARCHIVE_ENTRY_COUNT_LIMIT');

    assert.equal(validateArchive(zip([
        entry('manifest.json', 100, 500), entry('questions.json', 100, 501)
    ]), bankPolicy()).code, 'ARCHIVE_TOTAL_SIZE_LIMIT');

    assert.equal(validateArchive(zip([
        entry('questions.json', 100, 601)
    ]), bankPolicy()).code, 'ARCHIVE_ENTRY_SIZE_LIMIT');
});

test('archive policy rejects extreme compression ratio and absent size metadata', () => {
    assert.equal(validateArchive(zip([
        entry('questions.json', 1, 100)
    ]), bankPolicy()).code, 'ARCHIVE_COMPRESSION_RATIO_LIMIT');

    assert.equal(validateArchive(zip([{
        name: 'questions.json', dir: false, _data: {}
    }]), bankPolicy()).code, 'ARCHIVE_SIZE_METADATA_REQUIRED');
});

test('archive policy rejects traversal including JSZip sanitized names', () => {
    assert.equal(validateArchive(zip([
        entry('../questions.json', 10, 10)
    ]), bankPolicy()).code, 'ARCHIVE_PATH_TRAVERSAL');

    assert.equal(validateArchive(zip([
        entry('questions.json', 10, 10, { unsafeOriginalName: '../questions.json' })
    ]), bankPolicy()).code, 'ARCHIVE_PATH_TRAVERSAL');
});

test('archive policy rejects nested archives and paths outside its extension allowlist', () => {
    assert.equal(validateArchive(zip([
        entry('images/payload.zip', 10, 10)
    ]), bankPolicy()).code, 'ARCHIVE_NESTED_ARCHIVE');

    assert.equal(validateArchive(zip([
        entry('scripts/payload.js', 10, 10)
    ]), bankPolicy()).code, 'ARCHIVE_ENTRY_NOT_ALLOWED');
});

test('archive policy validates input extension and MIME allowlists', () => {
    const policy = bankPolicy();
    assert.equal(validateArchive(zip([
        entry('questions.json', 10, 10)
    ]), policy, { name: 'bank.exe', type: 'application/octet-stream' }).code,
    'ARCHIVE_INPUT_EXTENSION_NOT_ALLOWED');
    assert.equal(validateArchive(zip([
        entry('questions.json', 10, 10)
    ]), policy, { name: 'bank.zip', type: 'text/plain' }).code,
    'ARCHIVE_INPUT_MIME_NOT_ALLOWED');
});

test('all production archive readers are wired through the security owner', () => {
    const root = path.resolve(__dirname, '..');
    for (const file of ['app.js', 'qisi-backup.js', 'qisi-batch-importer.js']) {
        const source = fs.readFileSync(path.join(root, file), 'utf8');
        assert.doesNotMatch(source, /JSZip\.loadAsync\s*\(/, file);
        assert.match(source, /ArchiveSecurity\.load\s*\(/, file);
    }
    const main = fs.readFileSync(path.join(root, 'main.html'), 'utf8');
    assert.ok(
        main.indexOf('qisi-archive-security.js') < main.indexOf('qisi-backup.js'),
        'archive security loads before archive consumers'
    );
});
