const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

for (const failingTable of ['images', 'draftImages']) {
    test('native restore rolls back every table when ' + failingTable + ' fails after earlier writes', { timeout: 60000 }, async () => {
        const server = http.createServer((_req, res) => res.end('<!doctype html><title>Synthetic restore atomicity</title>'));
        await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
        let browser;
        try {
            browser = await chromium.launch({ headless: true });
            const page = await browser.newPage();
            await page.goto('http://127.0.0.1:' + server.address().port);
            for (const file of ['vendor/dexie/dexie.min.js', 'qisi-backup-snapshot-policy.js', 'qisi-storage-repository.js', 'qisi-backup.js']) {
                await page.addScriptTag({ path: path.resolve(__dirname, '..', file) });
            }
            const result = await page.evaluate(async failAt => {
                const name = 'isolated-restore-atomicity-' + crypto.randomUUID();
                const database = new Dexie(name);
                const names = Qisi.StorageRepository.BACKUP_TABLES;
                database.version(1).stores(Object.fromEntries(names.map(table => [table, 'id'])));
                await database.open();
                async function canonical(value) {
                    if (value instanceof Blob) return { type: value.type, bytes: Array.from(new Uint8Array(await value.arrayBuffer())) };
                    if (Array.isArray(value)) return Promise.all(value.map(canonical));
                    if (value && typeof value === 'object') return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([key, item]) => [key, await canonical(item)])));
                    return value;
                }
                const records = marker => Object.fromEntries(names.map(table => [table, [{ id: table + '-' + marker, marker }]]));
                const old = records('old'), incoming = records('incoming');
                for (const [rows, marker] of [[old, 'old'], [incoming, 'incoming']]) {
                    rows.questions[0].stem = marker + ' question';
                    rows.questions[0].imageIds = ['images-' + marker];
                    rows.images[0].blob = new Blob([marker + '-formal-pixels'], { type: 'image/png' });
                    rows.draftImages[0].blob = new Blob([marker + '-draft-pixels'], { type: 'image/jpeg' });
                    rows.draftQuestions[0].sourceFileId = 'draftImportFiles-' + marker;
                    rows.draftQuestions[0].imageIds = ['draftImages-' + marker];
                    rows.draftImportFiles[0].source = { bytes: new Blob([marker + '-source-bytes'], { type: 'application/pdf' }) };
                }
                try {
                    for (const table of names) await database.table(table).bulkPut(old[table]);
                    const before = await Qisi.Backup.snapshotDatabase(database);
                    const repository = Qisi.StorageRepository.createRepository(database);
                    const attempts = [];
                    let armed = true;
                    for (const table of names) database.table(table).hook('creating', (_key, row) => {
                        if (row.id !== table + '-incoming') return;
                        attempts.push(table);
                        if (table === failAt && armed) {
                            armed = false;
                            throw new DOMException('Synthetic atomic quota failure', 'QuotaExceededError');
                        }
                    });
                    let errorCode;
                    try {
                        await repository.restoreBackup({ schemaVersion: 'qisi.storage.v1', tables: incoming }, { expectedSnapshot: before });
                    } catch (error) { errorCode = error.code; }
                    const afterFailure = await Qisi.Backup.snapshotDatabase(database);
                    const firstAttempt = [...attempts];
                    attempts.length = 0;
                    // A separate explicit call after inspecting the failed result.
                    await repository.restoreBackup({ schemaVersion: 'qisi.storage.v1', tables: incoming }, { expectedSnapshot: afterFailure });
                    const afterSuccess = await Qisi.Backup.snapshotDatabase(database);
                    return { errorCode, names, firstAttempt, secondAttempt: attempts,
                        before: await canonical(before), afterFailure: await canonical(afterFailure),
                        incoming: await canonical(incoming), afterSuccess: await canonical(afterSuccess) };
                } finally {
                    database.close();
                    await Dexie.delete(name);
                }
            }, failingTable);
            assert.equal(result.errorCode, 'quota-exceeded');
            assert.equal(result.names.length, 12);
            assert.ok(result.firstAttempt.indexOf('questions') >= 0);
            assert.ok(result.firstAttempt.indexOf(failingTable) > result.firstAttempt.indexOf('questions'));
            assert.deepEqual(result.firstAttempt, result.names.slice(0, result.names.indexOf(failingTable) + 1));
            assert.deepEqual(result.afterFailure, result.before);
            assert.deepEqual(result.secondAttempt, result.names);
            assert.deepEqual(result.afterSuccess, result.incoming);
        } finally {
            try { if (browser) await browser.close(); }
            finally { await new Promise(resolve => server.close(resolve)); }
        }
    });
}
