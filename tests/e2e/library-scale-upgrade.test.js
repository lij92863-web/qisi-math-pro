const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./browser-harness');

test('production database repairs v10 identity keys and keeps them current on manual writes', { timeout: 30000 }, async () => {
    const h = await H.startBrowserApp(33008);
    const context = await h.context.browser().newContext();
    try {
        const page = await context.newPage();
        await page.goto(h.origin + '/api/health');
        await page.evaluate(() => new Promise((resolve, reject) => {
            const request = indexedDB.open('QisiMathVueDB', 100);
            request.onupgradeneeded = () => {
                const questions = request.result.createObjectStore('questions', { keyPath: 'id' });
                questions.createIndex('createdAt', 'createdAt');
                questions.put({ id: 'stale', stem: '已被改题的旧题', options: [], createdAt: 1,
                    duplicateCoreV2: 'old-fingerprint', admission: { requestId: 'r10', idempotencyKey: 'k10' } });
                questions.put({ id: 'removed', stem: '已删除', createdAt: 2, deletedAt: 3, duplicateCoreV2: 'ghost' });
            };
            request.onsuccess = () => { request.result.close(); resolve(); };
            request.onerror = () => reject(request.error);
        }));
        await page.goto(h.origin + '/main.html');
        await page.waitForFunction(() => Qisi.Runtime.getRuntimeDependency('AppProxy')?.questions.some(q => q.id === 'stale'));
        const observed = await page.evaluate(async () => {
            const app = Qisi.Runtime.getRuntimeDependency('AppProxy'), policy = Qisi.QuestionDuplicatePolicy;
            const repaired = await db.questions.where('formalIdempotencyKey').equals('k10').first();
            const request = await db.questions.where('formalRequestId').equals('r10').first();
            const removed = await db.questions.get('removed');
            app.entryForm.stem = '手工录入身份检查';
            const result = await app.submitQuestion();
            const original = await db.questions.where('duplicateStemV2').equals(policy.canonicalStemFingerprint({ stem: '手工录入身份检查' })).first();
            if (!original) return { result };
            await app.saveEditedQuestion(original.id, '手工编辑身份检查', [], '高一', '解答题', '中等', '', '', '', [], '', '', '', original.updatedAt);
            const edited = await db.questions.get(original.id);
            return { result, repaired: repaired?.duplicateCoreV2 === policy.canonicalCoreFingerprint(repaired),
                request: request?.id, removed: removed.duplicateCoreV2, original: original.duplicateCoreV2 === policy.canonicalCoreFingerprint(original),
                edited: edited.duplicateCoreV2 === policy.canonicalCoreFingerprint(edited),
                staleCount: await db.questions.where('duplicateCoreV2').anyOf(['old-fingerprint', original.duplicateCoreV2]).count() };
        });
        assert.deepEqual(observed, { result: { committed: true, refreshed: true }, repaired: true,
            request: 'stale', removed: undefined, original: true, edited: true, staleCount: 0 });
    } finally { await context.close(); await h.close(); }
});

test('native startup with 30,000 questions reads only visible images and saving uses a single keyed read', { timeout: 55000 }, async t => {
    const h = await H.startBrowserApp(32996);
    try {
        await h.page.evaluate(async () => {
            const rows = Array.from({ length: 30000 }, (_, i) => ({
                id: 'perf-' + i, createdAt: i + 1, type: '解答题', stem: i % 20 ? '椭圆方程 ' + i : '双曲线方程 ' + i + ' [[IMAGE:perf-img-' + i + ']]',
                images: i % 20 ? [] : [{ id: 'perf-img-' + i }], options: []
            }));
            const pixels = Uint8Array.from(atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'), c => c.charCodeAt(0));
            await db.transaction('rw', db.questions, db.images, () => db.questions.bulkPut(rows).then(() =>
                db.images.bulkPut(rows.filter(row => row.images.length).map(row =>
                    ({ id: row.images[0].id, blob: new Blob([pixels], { type: 'image/gif' }) })))));
        });
        await h.page.addInitScript(() => {
            window.scaleReads = { full: 0, delta: [], images: 0 };
            window.Qisi ||= {};
            Object.defineProperty(Qisi, 'StorageRepository', { configurable: true, set(owner) {
                Object.defineProperty(Qisi, 'StorageRepository', { configurable: true, value: { ...owner, createRepository(...args) {
                    const port = owner.createRepository(...args);
                    return { ...port,
                        loadLibrary() { scaleReads.full++; return port.loadLibrary(); },
                        loadQuestionsById(ids) { scaleReads.delta.push(ids); return port.loadQuestionsById(ids); },
                        loadImageRecords(ids) { scaleReads.images += ids.length; return port.loadImageRecords(ids); }
                    };
                } } });
            } });
        });
        await h.page.reload();
        await h.page.waitForFunction(() => Qisi.Runtime.getRuntimeDependency('AppProxy')?.libraryPage.total === 30000);
        assert.deepEqual(await h.page.evaluate(() => scaleReads), { full: 1, delta: [], images: 0 });
        const metrics = await h.page.evaluate(async () => {
            const app = Qisi.Runtime.getRuntimeDependency('AppProxy');
            app.view = 'library';
            const start = performance.now();
            app.librarySearchInput = '双曲线';
            while (app.libraryPage.total === 30000) await new Promise(requestAnimationFrame);
            return { searchMs: performance.now() - start, total: app.libraryPage.total };
        });
        assert.equal(metrics.total, 1500);
        await h.page.locator('.library-layout .question-card img').first().evaluate(img => img.decode());
        const reads = await h.page.evaluate(() => scaleReads.images);
        assert.ok(reads >= 10 && reads <= 11, 'load the ten matching cards and at most one from the initial page');
        const save = await h.page.evaluate(async () => {
            const app = Qisi.Runtime.getRuntimeDependency('AppProxy');
            app.entryForm.stem = '双曲线刚保存的题';
            const start = performance.now();
            const result = await app.submitQuestion();
            return { saveMs: performance.now() - start, result, reads: scaleReads, total: app.libraryPage.total };
        });
        assert.equal(save.result.committed, true);
        assert.equal(save.total, 1501);
        assert.equal(save.reads.full, 1);
        assert.equal(save.reads.delta.length, 1);
        assert.equal(save.reads.delta[0].length, 1);
        t.diagnostic(JSON.stringify({ ...metrics, saveMs: save.saveMs, loadedImages: reads }));
        H.assertNoRuntimeErrors(h);
    } finally { await h.close(); }
});

test('a blocked upgrade explains how to continue and an older tab releases its connection', { timeout: 30000 }, async () => {
    const h = await H.startBrowserApp(32997);
    const context = await h.context.browser().newContext();
    try {
        const blocker = await context.newPage();
        await blocker.goto(h.origin + '/api/health');
        await blocker.evaluate(() => new Promise((resolve, reject) => {
            const request = indexedDB.open('QisiMathVueDB', 90);
            request.onupgradeneeded = () => {
                const questions = request.result.createObjectStore('questions', { keyPath: 'id' });
                questions.createIndex('createdAt', 'createdAt');
                questions.put({ id: 'old-schema', createdAt: 1, stem: '旧版题目', options: [], images: [] });
            };
            request.onsuccess = () => { window.blockedConnection = request.result; resolve(); };
            request.onerror = () => reject(request.error);
        }));
        const upgrading = await context.newPage();
        await upgrading.goto(h.origin + '/main.html');
        await upgrading.getByRole('alert').filter({ hasText: '数据库升级正在等其他标签页' }).waitFor();
        await blocker.evaluate(() => window.blockedConnection.close());
        await upgrading.getByRole('alert').filter({ hasText: '数据库升级正在等其他标签页' }).waitFor({ state: 'hidden' });
        await upgrading.waitForFunction(() => Qisi.Runtime.getRuntimeDependency('AppProxy')?.questions.some(q => q.id === 'old-schema'));
        const nextVersion = await upgrading.evaluate(() => (db.verno + 1) * 10);
        await blocker.evaluate(version => new Promise((resolve, reject) => {
            const request = indexedDB.open('QisiMathVueDB', version);
            request.onsuccess = () => { request.result.close(); resolve(); };
            request.onerror = () => reject(request.error);
        }), nextVersion);
        await upgrading.getByRole('alert').filter({ hasText: '本页已释放数据库连接' }).waitFor();
        await upgrading.getByRole('button', { name: '刷新页面' }).waitFor();
    } finally { await context.close(); await h.close(); }
});

test('an open question editor keeps its draft and refuses to overwrite another tab', { timeout: 30000 }, async () => {
    const h = await H.startBrowserApp(32999);
    try {
        const { page, context } = h;
        await page.evaluate(async () => {
            await db.questions.put({ id: 'concurrent-edit', createdAt: 1, updatedAt: 1, stem: '并发编辑原题', type: '解答题', images: [], options: [] });
            Qisi.Runtime.getRuntimeDependency('AppProxy').view = 'library';
        });
        const card = page.locator('.library-layout .question-card').filter({ hasText: '并发编辑原题' });
        await card.getByRole('button', { name: '编辑', exact: true }).click();
        const field = page.getByRole('textbox', { name: '题干源码' });
        await field.fill('此页尚未保存的版本');
        const peer = await context.newPage();
        await peer.goto(h.origin + '/main.html');
        await peer.waitForFunction(() => Qisi.Runtime.getRuntimeDependency('AppProxy')?.questions.length === 1);
        await H.callProxy(peer, 'saveEditedQuestion', 'concurrent-edit', '另一个标签页的新版本', [], '高一', '解答题', '中等', '', '', '', [], '', '', '', 1);
        await page.bringToFront();
        await page.waitForFunction(() => Qisi.Runtime.getRuntimeDependency('AppProxy')?.questions[0]?.stem === '另一个标签页的新版本');
        await page.getByRole('button', { name: '确认更新', exact: true }).click();
        await page.getByRole('alert').filter({ hasText: '这道题已在其他操作中修改' }).waitFor();
        assert.equal(await field.inputValue(), '此页尚未保存的版本');
        assert.equal(await page.evaluate(async () => (await db.questions.get('concurrent-edit')).stem), '另一个标签页的新版本');
        H.assertNoRuntimeErrors(h);
    } finally { await h.close(); }
});
