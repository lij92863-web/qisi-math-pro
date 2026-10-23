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
        const oldUrl = await h.page.evaluate(() => {
            const p = window.Qisi.Runtime.getRuntimeDependency('AppProxy'); p.view = 'library';
            window.auditDomainReads = []; window.auditOtherDomainFailure = true;
            window.auditExternalReference = p.externalQuestions; window.auditTemplateReference = p.customTemplates;
            return p.externalQuestions[0].images[0].url;
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
        assert.deepEqual(edited.reads, ['library']);
        assert.equal(edited.externalSame, true); assert.equal(edited.templatesSame, true); assert.equal(edited.url, oldUrl);
        await h.page.evaluate(() => { window.Qisi.Runtime.getRuntimeDependency('AppProxy').librarySearchInput = 'Changed domain source'; });
        await h.page.waitForFunction(() => document.querySelectorAll('.library-layout .question-card').length === 1);
        await h.page.evaluate(() => { window.auditDomainReads = []; });
        await H.callProxy(h.page, 'deleteQuestion', formal.id);
        await h.page.waitForFunction(() => document.querySelectorAll('.library-layout .question-card').length === 0);
        const deleted = await h.page.evaluate(async oldUrl => {
            const p = window.Qisi.Runtime.getRuntimeDependency('AppProxy');
            const image = new Image(); image.src = oldUrl; await image.decode();
            return { count: p.questions.length, reads: window.auditDomainReads, externalCount: p.externalQuestions.length,
                url: p.externalQuestions[0].images[0].url, decodable: image.naturalWidth > 0 };
        }, oldUrl);
        assert.equal(deleted.count, 0); assert.deepEqual(deleted.reads, ['library']);
        assert.equal(deleted.externalCount, 1); assert.equal(deleted.url, oldUrl); assert.equal(deleted.decodable, true);
        assert.deepEqual(dialogs, []);
        H.assertNoRuntimeErrors(h);
    } finally { await h.close(); }
});
