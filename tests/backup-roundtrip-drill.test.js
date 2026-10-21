const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

test('isolated full backup survives clear, restore and reopen with every table and binary association', { timeout: 60000 }, async t => {
    const server = http.createServer((req, res) => res.end('<!doctype html><title>Isolated restore drill</title>'));
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    let browser;
    try {
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext();
        const page = await context.newPage();
        await page.goto('http://127.0.0.1:' + server.address().port);
        for (const file of ['vendor/jszip/jszip.min.js', 'qisi-archive-security.js', 'vendor/dexie/dexie.min.js',
            'qisi-backup-snapshot-policy.js', 'qisi-storage-repository.js', 'qisi-backup.js']) {
            await page.addScriptTag({ path: path.resolve(__dirname, '..', file) });
        }
        const result = await page.evaluate(async () => {
            const name = 'isolated-roundtrip-' + crypto.randomUUID(), started = performance.now();
            const names = Qisi.Backup.TABLE_NAMES;
            let db = new Dexie(name);
            db.version(1).stores(Object.fromEntries(names.map(table => [table, 'id'])));
            await db.open();
            try {
                for (const table of names) await db.table(table).put({ id: table + '-record', fixture: 'retained' });
                await db.questions.clear();
                await db.questions.put({ id: 'question-1', stem: 'Figure [[IMAGE:image-1]]', imageIds: ['image-1'] });
                await db.images.clear();
                await db.images.put({ id: 'image-1', blob: new Blob(['formal-pixels'], { type: 'image/png' }) });
                await db.draftImportFiles.clear();
                await db.draftImportFiles.put({ id: 'source-1', batchId: 'batch-1',
                    evidence: { source: new Blob(['source-bytes'], { type: 'application/pdf' }) } });
                await db.draftQuestions.clear();
                await db.draftQuestions.put({ id: 'draft-1', batchId: 'batch-1', sourceFileId: 'source-1', imageIds: ['draft-image-1'] });
                await db.draftImages.clear();
                await db.draftImages.put({ id: 'draft-image-1', questionId: 'draft-1',
                    blob: new Blob(['draft-pixels'], { type: 'image/jpeg' }) });
                localStorage.setItem('private-test-credential', 'fixture-secret-not-exported');
                const backupStarted = performance.now();
                const created = await Qisi.Backup.createFullDatabaseBackup(db);
                const backupMs = performance.now() - backupStarted;
                const decoded = await Qisi.Backup.readFullDatabaseBackupBlob(created.blob);
                await db.transaction('rw', db.tables, async () => {
                    for (const table of db.tables) await table.clear();
                });
                const cleared = await Qisi.Backup.snapshotDatabase(db);
                if (!Object.values(cleared).every(rows => rows.length === 0)) throw new Error('Clear did not complete');
                const restoreStarted = performance.now();
                await Qisi.StorageRepository.createRepository(db).restoreBackup(decoded.backup, { expectedSnapshot: cleared });
                const restoreMs = performance.now() - restoreStarted;
                db.close();
                db = new Dexie(name); await db.open();
                const restored = await Qisi.Backup.snapshotDatabase(db);
                await Qisi.BackupSnapshotPolicy.assertSameSnapshot(created.snapshot, restored);
                const question = restored.questions[0], draft = restored.draftQuestions[0];
                return {
                    tables: Object.keys(restored).length,
                    everyTableRetained: names.every(table => restored[table].length === created.snapshot[table].length),
                    formalImageReference: question.imageIds[0] === restored.images[0].id,
                    draftImageReference: draft.imageIds[0] === restored.draftImages[0].id,
                    sourceReference: draft.sourceFileId === restored.draftImportFiles[0].id,
                    formalBytes: await restored.images[0].blob.text(),
                    draftBytes: await restored.draftImages[0].blob.text(),
                    nestedBytes: await restored.draftImportFiles[0].evidence.source.text(),
                    secretsExcluded: !JSON.stringify(decoded.preferences).includes('fixture-secret-not-exported'),
                    archiveBytes: created.blob.size, backupMs, restoreMs, totalMs: performance.now() - started
                };
            } finally { db.close(); await Dexie.delete(name); }
        });
        assert.equal(result.tables, 11);
        assert.equal(result.everyTableRetained, true);
        assert.equal(result.formalImageReference, true);
        assert.equal(result.draftImageReference, true);
        assert.equal(result.sourceReference, true);
        assert.equal(result.formalBytes, 'formal-pixels');
        assert.equal(result.draftBytes, 'draft-pixels');
        assert.equal(result.nestedBytes, 'source-bytes');
        assert.equal(result.secretsExcluded, true);
        t.diagnostic(JSON.stringify(result));
    } finally {
        if (browser) await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
});
