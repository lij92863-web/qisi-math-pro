const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./browser-harness');

const snapshot = page => page.evaluate(async () => {
    await db.open();
    const counts = {};
    for (const name of Qisi.Backup.TABLE_NAMES) counts[name] = await db.table(name).count();
    return { counts, questions: await db.questions.toArray(),
        images: await Promise.all((await db.images.toArray()).map(async row => ({ id: row.id,
            type: row.blob.type, bytes: Array.from(new Uint8Array(await row.blob.arrayBuffer())) }))) };
});

for (const [index, failureName] of ['QuotaExceededError', 'NotAllowedError'].entries()) {
    test(failureName + ': failed safety write preserves the native database until a new explicit restore succeeds', { timeout: 60000 }, async () => {
        const h = await H.startBrowserApp(33360 + index);
        const events = [], writes = [];
        try {
            await h.page.exposeFunction('captureSafetyFaultEvent', async value => events.push(value));
            await h.page.exposeFunction('captureSafetyFaultArchive', async (name, bytes) => writes.push({ name, bytes }));
            await h.page.addInitScript(failure => {
                const files = new Map();
                let failNextSafetyWrite = true;
                window.showDirectoryPicker = async () => ({ name: 'synthetic-fault-folder', getFileHandle: async (name, options) => {
                    if (!files.has(name) && !options?.create) throw new DOMException('missing', 'NotFoundError');
                    if (!files.has(name)) files.set(name, null);
                    return { createWritable: async () => {
                        if (files.get(name)) throw Error('Synthetic archive overwrite attempted');
                        let blob;
                        return { write: async data => {
                            if (name.includes('before-restore') && failNextSafetyWrite) {
                                failNextSafetyWrite = false;
                                await window.captureSafetyFaultEvent({ event: 'write-failed', name, code: failure });
                                throw new DOMException('Synthetic safety-write failure', failure);
                            }
                            blob = data;
                        }, close: async () => {
                            files.set(name, blob);
                            await window.captureSafetyFaultArchive(name, Array.from(new Uint8Array(await blob.arrayBuffer())));
                        }, abort: async () => { await window.captureSafetyFaultEvent({ event: 'write-aborted', name }); } };
                    } };
                } });
            }, failureName);
            await h.page.reload();
            await h.page.waitForFunction(() => Boolean(window.Qisi?.Runtime?.getRuntimeDependency('AppProxy')));
            const prepared = await h.page.evaluate(async () => {
                await db.open();
                // Use complete current index fields so restore hooks need not upgrade
                // a deliberately incomplete legacy fixture during this safety test.
                const row = (id, stem, image) => {
                    const q = { id, stem, type: '填空题', imageIds: [image],
                        admission: { requestId: id + '-request', idempotencyKey: id + '-key' } };
                    return { ...q, duplicateCoreV2: Qisi.QuestionDuplicatePolicy.canonicalCoreFingerprint(q),
                        duplicateStemV2: Qisi.QuestionDuplicatePolicy.canonicalStemFingerprint(q),
                        formalRequestId: q.admission.requestId, formalIdempotencyKey: q.admission.idempotencyKey };
                };
                const incoming = row('incoming-q', '$x^2$', 'incoming-image');
                await db.questions.put(incoming);
                await db.images.put({ id: 'incoming-image', blob: new Blob(['incoming-pixels'], { type: 'image/png' }) });
                const backup = await Qisi.Backup.createFullDatabaseBackup(db);
                // These are only rows in this new test origin, never the user's database.
                await db.questions.clear();
                await db.images.clear();
                await db.questions.put(row('original-q', '$y^2$', 'original-image'));
                await db.images.put({ id: 'original-image', blob: new Blob(['original-pixels'], { type: 'image/png' }) });
                return { incoming, bytes: Array.from(new Uint8Array(await backup.blob.arrayBuffer())) };
            });
            const original = await snapshot(h.page);
            assert.equal(Object.keys(original.counts).length, 12);
        await h.page.getByRole('button',{name:'个人知识点与备份',exact:true}).click();
            await h.page.getByTestId('restore-file').setInputFiles({ name: 'synthetic-incoming.zip', mimeType: 'application/zip', buffer: Buffer.from(prepared.bytes) });
            await h.page.getByTestId('restore-preview').waitFor();
            await h.page.getByRole('button', { name: '选择备份文件夹', exact: true }).click();
            await h.page.waitForFunction(() => Qisi.Runtime.getRuntimeDependency('AppProxy').backupStatus.lastBackupAt > 0);
            await h.page.getByTestId('restore-consent').check();
            await h.page.getByTestId('restore-word').fill('恢复备份');
            let navigations = 0;
            const navigation = frame => { if (frame === h.page.mainFrame()) navigations += 1; };
            h.page.on('framenavigated', navigation);
            await h.page.getByTestId('restore-confirm').click();
            await h.page.waitForFunction(() => {
                const status = Qisi.Runtime.getRuntimeDependency('AppProxy').backupStatus;
                return status.error && !status.restoring && !status.busy;
            });
            assert.deepEqual(await snapshot(h.page), original);
            assert.equal(navigations, 0);
            assert.equal(writes.filter(row => row.name.includes('before-restore')).length, 0);
            assert.equal(events.filter(row => row.event === 'write-failed' && row.code === failureName).length, 1);
            assert.equal(events.filter(row => row.event === 'write-aborted').length, 1);
            assert.equal(await h.page.getByTestId('restore-preview').count(), 1);
            assert.equal(await h.page.getByTestId('restore-confirm').isDisabled(), false);
            assert.equal(await h.page.locator('.app-container').getAttribute('inert'), null);
            assert.ok(await h.page.getByRole('alert').innerText());

            // This second explicit user action is a separate restore, not a retry loop.
            await Promise.all([
                h.page.waitForEvent('framenavigated', frame => frame === h.page.mainFrame()),
                h.page.getByTestId('restore-confirm').click()
            ]);
            await h.page.waitForFunction(() => Boolean(window.Qisi?.Runtime?.getRuntimeDependency('AppProxy')));
            assert.equal(navigations, 1);
            h.page.off('framenavigated', navigation);
            const restored = await snapshot(h.page);
            assert.deepEqual(restored.counts, original.counts);
            assert.deepEqual(restored.questions, [prepared.incoming]);
            assert.deepEqual(restored.images, [{ id: 'incoming-image', type: 'image/png', bytes: [...Buffer.from('incoming-pixels')] }]);
            const safety = writes.filter(row => row.name.includes('before-restore'));
            assert.equal(safety.length, 1);
            const decodedSafety = await h.page.evaluate(async bytes => {
                const decoded = await Qisi.Backup.readFullDatabaseBackupBlob(new Blob([new Uint8Array(bytes)], { type: 'application/zip' }));
                return { questions: decoded.backup.tables.questions,
                    pixels: await decoded.backup.tables.images[0].blob.text() };
            }, safety[0].bytes);
            assert.deepEqual(decodedSafety.questions, original.questions);
            assert.equal(decodedSafety.pixels, 'original-pixels');
            H.assertNoRuntimeErrors(h);
        } finally { await h.close(); }
    });
}
