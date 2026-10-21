const test = require('node:test');
const assert = require('node:assert/strict');
globalThis.JSZip = require('../vendor/jszip/jszip.min');
require('../qisi-archive-security');
const Backup = require('../qisi-backup');

function database(ids) {
    const tables = Object.fromEntries(Backup.TABLE_NAMES.map(name => [name, []]));
    tables.questions = [{ id: 'q1', stem: 'Synthetic figures', imageIds: ids }];
    tables.images = ids.map((id, index) => ({ id, sourceId: 'source/' + index,
        blob: new Blob(['pixels-' + index], { type: 'image/png' }) }));
    return { tables: Backup.TABLE_NAMES.map(name => ({ name })),
        table: name => ({ toArray: async () => tables[name] }),
        transaction: async (_mode, _tables, work) => work() };
}

async function roundtrip(ids) {
    const created = await Backup.createFullDatabaseBackup(database(ids));
    assert.equal(created.manifest.verification.ok, true);
    const zip = await JSZip.loadAsync(await created.blob.arrayBuffer());
    const rows = JSON.parse(await zip.file('tables/images.json').async('text'));
    assert.equal(new Set(rows.map(row => row.blobFile)).size, ids.length);
    assert.ok(rows.every(row => /^image-blobs\/[A-Za-z0-9._-]+\.png$/.test(row.blobFile)));
    const decoded = await Backup.readFullDatabaseBackupBlob(created.blob);
    assert.deepEqual(decoded.backup.tables.questions[0].imageIds, ids);
    assert.deepEqual(decoded.backup.tables.images.map(row => row.id), ids);
    for (const [index, row] of decoded.backup.tables.images.entries()) {
        assert.equal(await row.blob.text(), 'pixels-' + index);
        assert.equal(row.blob.type, 'image/png');
        assert.equal(row.sourceId, 'source/' + index);
    }
    return { zip, rows };
}

test('native PDF image IDs with encoded source paths survive a full backup unchanged', async () => {
    await roundtrip(['batch_123:mineru:1:stem:file_456%2Fp1b2']);
});

test('Unicode and punctuation in image IDs remain metadata while archive names stay safe', async () => {
    await roundtrip(['题图一😀', '../图像:%2F?*"<>|', 'spaces tabs\tand\nlines', 'image+equals=percent%']);
});

test('sanitized identifier collisions retain distinct files and exact image associations', async () => {
    await roundtrip(['a:b', 'a/b', 'a?b', 'a_b']);
});

test('long identifiers that truncate to the same stem retain separate images', async () => {
    const common = 'x'.repeat(130);
    await roundtrip([common + 'first', common + 'second']);
});

test('an existing ASCII backup still reads its recorded blob path without recomputing IDs', async () => {
    const { zip } = await roundtrip(['legacy-image_1']);
    const rows = JSON.parse(await zip.file('tables/images.json').async('text'));
    const oldPath = rows[0].blobFile;
    const bytes = await zip.file(oldPath).async('uint8array');
    zip.remove(oldPath);
    rows[0].blobFile = 'image-blobs/legacy-recorded-file.png';
    zip.file(rows[0].blobFile, bytes);
    zip.file('tables/images.json', JSON.stringify(rows));
    const blob = new Blob([await zip.generateAsync({ type: 'uint8array' })], { type: 'application/zip' });
    const decoded = await Backup.readFullDatabaseBackupBlob(blob);
    assert.equal(decoded.backup.tables.images[0].id, 'legacy-image_1');
    assert.equal(await decoded.backup.tables.images[0].blob.text(), 'pixels-0');
});

test('unsafe raw archive names remain forbidden under the unchanged full-backup policy', async () => {
    const created = await Backup.createFullDatabaseBackup(database(['safe-image']));
    for (const name of ['image-blobs/bad%2Fname.png', 'image-blobs/题图.png', 'image-blobs/../outside.png']) {
        const zip = await JSZip.loadAsync(await created.blob.arrayBuffer());
        zip.file(name, 'unsafe-entry');
        const blob = new Blob([await zip.generateAsync({ type: 'uint8array' })], { type: 'application/zip' });
        await assert.rejects(() => Backup.readFullDatabaseBackupBlob(blob),
            error => ['ARCHIVE_ENTRY_NOT_ALLOWED', 'ARCHIVE_PATH_TRAVERSAL'].includes(error.code));
    }
});
