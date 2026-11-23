const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./browser-harness');

test('real library edit and soft-delete refresh only that domain while external image resources remain usable', { timeout: 35000 }, async () => {
    const h = await H.startBrowserApp(32864);
    try {
        const dialogs = []; h.page.on('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.accept(); });
        await h.page.addInitScript(() => {
            window.auditDomainReads = []; window.auditOtherDomainFailure = false;
            window.Qisi = window.Qisi || {};
            Object.defineProperty(window.Qisi, 'StorageRepository', { configurable: true,
                set(owner) { Object.defineProperty(window.Qisi, 'StorageRepository', { configurable: true,
                    value: Object.freeze({ ...owner, createRepository(...args) {
                        const repository = owner.createRepository(...args);
                        return Object.freeze({ ...repository,
                            async loadLibrary(...args) { window.auditDomainReads.push('library'); return repository.loadLibrary(...args); },
                            async loadQuestionsById(ids) { window.auditDomainReads.push(['ids', ...ids]); return repository.loadQuestionsById(ids); },
                            async listTable(name, ...args) {
                                window.auditDomainReads.push(name);
                                if (window.auditOtherDomainFailure && name === 'customTemplates') throw new Error('UNRELATED_TEMPLATE_READ');
                                return repository.listTable(name, ...args);
                            },
                            async listRecentTasks(...args) { window.auditDomainReads.push('recentTasks'); return repository.listRecentTasks(...args); }
                        });
                    } }) }); }
            });
        });
        await h.page.reload(); await h.page.waitForFunction(() => window.Qisi?.Runtime?.getRuntimeDependency('AppProxy'));
        const batchId = await H.seedReviewBatch(h.page, { batchId: 'library_domain' });
        await H.callProxy(h.page, 'openBatchReview', batchId); await H.callProxy(h.page, 'markDraftReviewed');
        assert.equal(await H.callProxy(h.page, 'submitDraftQuestion', batchId + '_q1', true), true);
        const formal = (await H.getDbSnapshot(h.page)).questions[0];
        await h.page.evaluate(async formal => {
            const db = new Dexie('QisiMathVueDB'); await db.open();
            try {
                const bytes = Uint8Array.from(atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'), c => c.charCodeAt(0));
                await db.table('images').put({ id: 'external-domain-image', blob: new Blob([bytes], { type: 'image/gif' }), createdAt: 1 });
                await db.table('externalQuestions').put({ ...formal, id: 'external-domain', importBatchId: 'external-batch',
                    importedAt: 1, images: [{ id: 'external-domain-image', align: 'center' }] });
                await db.table('importBatches').put({ id: 'external-batch', importedAt: 1, totalCount: 1 });
            } finally { db.close(); }
        }, formal);
        await h.page.reload(); await h.page.waitForFunction(() => window.Qisi?.Runtime?.getRuntimeDependency('AppProxy')?.externalQuestions?.length === 1);
        await h.page.evaluate(async () => {
            const p = window.Qisi.Runtime.getRuntimeDependency('AppProxy'); p.view = 'library';
            window.auditDomainReads = []; window.auditOtherDomainFailure = true;
            window.auditExternalReference = p.externalQuestions; window.auditTemplateReference = p.customTemplates;
            window.auditExternalImages = Qisi.LibraryImageResources.openStoredImages(p.externalQuestions[0].images);
            await window.auditExternalImages.ready;
        });
        await H.callProxy(h.page, 'saveEditedQuestion', formal.id, 'Changed domain source', [],
            formal.meta.grade, formal.type, formal.meta.diff, formal.answer, formal.solution, 'domain-tag', formal.options, '', '', '');
        const edited = await h.page.evaluate(() => {
            const p = window.Qisi.Runtime.getRuntimeDependency('AppProxy');
            return { stem: p.questions[0].stem, reads: [...window.auditDomainReads],
                externalSame: p.externalQuestions === window.auditExternalReference,
                templatesSame: p.customTemplates === window.auditTemplateReference, url: p.externalQuestions[0].images[0].url };
        });
        assert.equal(edited.stem, 'Changed domain source');
        assert.deepEqual(edited.reads, [['ids', formal.id]]);
        assert.equal(edited.externalSame, true); assert.equal(edited.templatesSame, true); assert.equal(edited.url, '');
        await h.page.evaluate(() => { window.Qisi.Runtime.getRuntimeDependency('AppProxy').librarySearchInput = 'Changed domain source'; });
        await h.page.waitForFunction(() => document.querySelectorAll('.library-layout .question-card').length === 1);
        await h.page.evaluate(() => { window.auditDomainReads = []; });
        await H.callProxy(h.page, 'deleteQuestion', formal.id);
        await h.page.waitForFunction(() => document.querySelectorAll('.library-layout .question-card').length === 0);
        const deleted = await h.page.evaluate(async () => {
            const p = window.Qisi.Runtime.getRuntimeDependency('AppProxy');
            const image = new Image(); image.src = (await window.auditExternalImages.ready)[0].url; await image.decode();
            window.auditExternalImages.release();
            return { count: p.questions.length, reads: window.auditDomainReads, externalCount: p.externalQuestions.length,
                url: p.externalQuestions[0].images[0].url, decodable: image.naturalWidth > 0 };
        });
        assert.equal(deleted.count, 0); assert.deepEqual(deleted.reads, [['ids', formal.id]]);
        assert.equal(deleted.externalCount, 1); assert.equal(deleted.url, ''); assert.equal(deleted.decodable, true);
        assert.deepEqual(dialogs, []);
        H.assertNoRuntimeErrors(h);
    } finally { await h.close(); }
});

test('visible sync recovery rereads committed rows without saving again or loading the whole library', { timeout: 35000 }, async () => {
    const h = await H.startBrowserApp(32864);
    try {
        await h.page.addInitScript(() => {
            window.syncReads = [];
            window.syncReadFailures = 1;
            window.Qisi ||= {};
            Object.defineProperty(window.Qisi, 'StorageRepository', { configurable: true,
                set(owner) { Object.defineProperty(window.Qisi, 'StorageRepository', { configurable: true,
                    value: Object.freeze({ ...owner, createRepository(...args) {
                        const repository = owner.createRepository(...args);
                        return Object.freeze({ ...repository,
                            async loadLibrary(...args) { syncReads.push('all'); return repository.loadLibrary(...args); },
                            async loadQuestionsById(ids) {
                                syncReads.push([...ids]);
                                if (window.syncReadFailures > 0) {
                                    window.syncReadFailures--;
                                    throw new Error('FIXTURE_TRANSIENT_QUESTION_READ_FAILURE');
                                }
                                return repository.loadQuestionsById(ids);
                            }
                        });
                    } }) }); }
            });
        });
        await h.page.reload();
        await h.page.waitForFunction(() => window.syncReads?.includes('all') && Qisi.Runtime.getRuntimeDependency('AppProxy'));
        const commit = (id, failures) => h.page.evaluate(async ({ id, failures }) => {
            window.syncReadFailures = failures;
            await db.questions.add({ id, stem: '同步回归 ' + id, type: '解答题', options: [], images: [],
                answer: '', solution: '', meta: {}, createdAt: Date.now() });
        }, { id, failures });
        const sees = id => h.page.waitForFunction(id => Qisi.Runtime.getRuntimeDependency('AppProxy').questions.some(row => row.id === id), id);
        await commit('automatic', 1);
        await sees('automatic');
        assert.equal(await h.page.getByText(/题库列表暂未同步/).count(), 0);
        assert.deepEqual(await h.page.evaluate(() => window.syncReads), ['all', ['automatic'], ['automatic']]);

        await commit('manual', 20);
        const alert = h.page.getByText(/题库列表暂未同步/);
        await alert.waitFor();
        assert.equal(await h.page.evaluate(async () => Boolean(await db.questions.get('manual')) &&
            !Qisi.Runtime.getRuntimeDependency('AppProxy').questions.some(row => row.id === 'manual')), true);
        await h.page.evaluate(() => { window.syncReadFailures = 0; });
        await h.page.getByRole('button', { name: '重试同步', exact: true }).click();
        await sees('manual');
        await alert.waitFor({ state: 'hidden' });
        assert.equal(await h.page.evaluate(() => db.questions.count()), 2);
        assert.equal(await h.page.evaluate(() => window.syncReads.filter(read => read === 'all').length), 1);
    } finally { await h.close(); }
});
