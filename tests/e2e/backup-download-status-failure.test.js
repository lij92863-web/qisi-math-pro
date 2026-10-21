const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs/promises'), path = require('node:path');
const H = require('./browser-harness');
const { installMineruReplay } = require('../harness/mineru-replay');
const { readSuite } = require('../../scripts/golden/run.cjs');
const root = path.resolve(__dirname, '../..');

const snapshot = (page, bytes) => page.evaluate(async input => {
    async function canonical(value) {
        if (value instanceof Blob) return { binaryType: value.type, bytes: [...new Uint8Array(await value.arrayBuffer())] };
        if (value instanceof ArrayBuffer) return { arrayBuffer: [...new Uint8Array(value)] };
        if (ArrayBuffer.isView(value)) return { view: value.constructor.name, bytes: [...new Uint8Array(value.buffer, value.byteOffset, value.byteLength)] };
        if (value instanceof Date) return { date: value.toISOString() };
        if (Array.isArray(value)) return Promise.all(value.map(canonical));
        if (value && typeof value === 'object') return Object.fromEntries(await Promise.all(Object.entries(value).filter(([, v]) => v !== undefined).map(async ([key, v]) => [key, await canonical(v)])));
        return value;
    }
    if (input) {
        const parsed = await Qisi.Backup.readFullDatabaseBackupBlob(new Blob([new Uint8Array(input)], { type: 'application/zip' }));
        return { tables: await canonical(parsed.backup.tables), verified: parsed.verification.ok };
    }
    const db = new Dexie('QisiMathVueDB');
    await db.open();
    try {
        const tables = {};
        for (const name of Qisi.Backup.TABLE_NAMES) tables[name] = await canonical(await db.table(name).toArray());
        return tables;
    } finally { db.close(); }
}, bytes ? [...bytes] : null);

for (const [index, key] of ['qisi_last_full_backup_at', 'qisi_last_full_backup_report'].entries()) {
    test(key + ': a bookkeeping quota error cannot turn a verified native download into backup failure', { timeout: 90000 }, async () => {
        const h = await H.startBrowserApp(33650 + index);
        try {
            const suite = readSuite(path.join(root, 'golden/synthetic-suite.json'));
            assert.equal(suite.sha256, '720da3f4ab5db00216b6fb2d7b1c17f057b34fd6e3fd21be0a45e163e2a9ec66');
            const item = suite.suite.cases.find(row => row.id === 'pdf-dual-with-image');
            await installMineruReplay(h.page, item.sources.map(source => ({ file: path.join(root, source.file), items: source.items,
                images: Object.fromEntries(Object.entries(source.assets || {}).map(([name, asset]) => [name, { type: asset.type, bytes: Buffer.from(asset.base64, 'base64') }])) })));
            const imported = await H.createImportThroughUi(h.page, { files: item.sources.map(source => ({ file: path.join(root, source.file), roles: source.roles })) });
            const draft = imported.snapshot.drafts.find(row => row.questionNumber === '1');
            await H.callProxy(h.page, 'openBatchReview', imported.batchId);
            await H.callProxy(h.page, 'selectDraftQuestion', draft.id);
            for (const field of ['question', 'answer', 'solution']) await H.callProxy(h.page, 'choosePdfCandidate', field, 0);
            await H.callProxy(h.page, 'confirmDraftImages');
            await H.callProxy(h.page, 'markDraftReviewed');
            assert.equal(await H.callProxy(h.page, 'submitDraftQuestion', draft.id, true), true);
            const original = await snapshot(h.page);
            assert.equal(Object.keys(original).length, 11);
            assert.equal(original.questions.length, 1);
            assert.equal(original.images.length, 1);
            assert.equal(original.draftQuestions.find(row => row.questionNumber === '2').status, 'pending');
            await h.page.evaluate(faultKey => {
                const setItem = Storage.prototype.setItem;
                window.__backupStatusFault = { key: faultKey, fired: 0 };
                Storage.prototype.setItem = function (name, value) {
                    const fault = window.__backupStatusFault;
                    if (this === localStorage && name === fault.key && fault.fired === 0) {
                        fault.fired++;
                        throw new DOMException('synthetic bookkeeping quota error', 'QuotaExceededError');
                    }
                    return setItem.call(this, name, value);
                };
            }, key);
            await h.page.getByRole('button', { name: '题库与检索', exact: true }).click();
            for (const attempt of [1, 2]) {
                const downloading = h.page.waitForEvent('download');
                await h.page.getByRole('button', { name: '下载完整备份', exact: true }).click();
                const download = await downloading;
                assert.equal(await download.failure(), null);
                const bytes = await fs.readFile(await download.path());
                const decoded = await snapshot(h.page, bytes);
                assert.equal(decoded.verified, true);
                assert.deepEqual(decoded.tables, original);
                assert.deepEqual(await snapshot(h.page), original);
                await h.page.waitForFunction(() => Qisi.Runtime.getRuntimeDependency('AppProxy').backupStatus.busy === false);
                const status = await h.page.evaluate(() => {
                    const state = Qisi.Runtime.getRuntimeDependency('AppProxy').backupStatus;
                    return { error: state.error, notice: state.notice, busy: state.busy, fired: window.__backupStatusFault.fired };
                });
                if (process.env.QISI_BACKUP_STATUS_EVIDENCE_DIR) {
                    const directory = path.resolve(process.env.QISI_BACKUP_STATUS_EVIDENCE_DIR);
                    assert.ok(directory.startsWith(path.join(root, 'local-run-artifacts') + path.sep));
                    await fs.mkdir(directory, { recursive: true });
                    const name = index + '-attempt-' + attempt;
                    await fs.writeFile(path.join(directory, name + '.zip'), bytes, { flag: 'wx' });
                    await fs.writeFile(path.join(directory, name + '.json'), JSON.stringify({ ...status, key, attempt, tablesMatched: true, binaryBytesMatched: true, archiveVerified: true }, null, 2), { flag: 'wx' });
                }
                assert.equal(status.fired, 1);
                assert.equal(status.error, '', 'Bookkeeping failure must not misreport a valid download as failed');
                assert.match(status.notice, /已发起完整备份下载.*确认下载文件已保存/);
            }
            H.assertNoRuntimeErrors(h);
        } finally { await h.close(); }
    });
}
