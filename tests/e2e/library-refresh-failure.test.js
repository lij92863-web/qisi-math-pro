const test = require('node:test');
const assert = require('node:assert/strict');
const { startBrowserApp, callProxy } = require('./browser-harness');

test('late refresh failure keeps real images usable and successful refresh respects captured editor resources', { timeout: 45000 }, async () => {
    const h = await startBrowserApp(32841);
    let printPage;
    try {
        await h.page.addInitScript(() => {
            window.auditCreatedUrls = [];
            window.auditRevokedUrls = [];
            window.auditTemplateFailure = false;
            const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
            URL.createObjectURL = blob => { const url = create(blob); window.auditCreatedUrls.push(url); return url; };
            URL.revokeObjectURL = url => { window.auditRevokedUrls.push(url); return revoke(url); };
            window.Qisi = window.Qisi || {};
            Object.defineProperty(window.Qisi, 'StorageRepository', {
                configurable: true,
                set(owner) {
                    Object.defineProperty(window.Qisi, 'StorageRepository', {
                        configurable: true,
                        value: Object.freeze({ ...owner,
                            createRepository(...args) {
                                const repository = owner.createRepository(...args);
                                return Object.freeze({ ...repository,
                                    async listTable(name, ...rest) {
                                        if (window.auditTemplateFailure && name === 'customTemplates') throw new Error('FIXTURE_LATE_TEMPLATE_READ');
                                        return repository.listTable(name, ...rest);
                                    }
                                });
                            }
                        })
                    });
                }
            });
        });
        await h.page.evaluate(async () => {
            const db = new Dexie('QisiMathVueDB');
            await db.open();
            try {
                const bytes = Uint8Array.from(atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'), c => c.charCodeAt(0));
                await db.table('images').put({ id: 'refresh-image', blob: new Blob([bytes], { type: 'image/gif' }), createdAt: 1 });
                await db.table('questions').put({ id: 'refresh-question', stem: 'Library fixture [[IMAGE:refresh-image]]',
                    grade: '高一', type: '解答题', diff: '中等', options: ['', '', '', ''],
                    answer: 'A', solution: 'Synthetic solution', images: [{ id: 'refresh-image', align: 'center' }],
                    meta: {}, createdAt: 1, updatedAt: 1 });
            } finally { db.close(); }
        });
        await h.page.reload();
        await h.page.waitForFunction(() => window.Qisi?.Runtime?.getRuntimeDependency('AppProxy')?.questions?.length === 1);
        await h.page.evaluate(() => { window.Qisi.Runtime.getRuntimeDependency('AppProxy').view = 'library'; });
        const image = h.page.locator('.library-layout .question-card img[alt="题图"]').first();
        await image.waitFor();
        await h.page.waitForFunction(() => Array.from(document.querySelectorAll('.library-layout .question-card img[alt="题图"]')).some(img => img.naturalWidth > 0));

        await callProxy(h.page, 'toggleCart', 'refresh-question');
        await callProxy(h.page, 'openExamBuilder');
        await h.page.getByRole('button', { name: '只打印题目', exact: true }).click();
        const popup = h.context.waitForEvent('page');
        await h.page.getByRole('button', { name: '打印 PDF', exact: true }).click();
        printPage = await popup;
        await printPage.waitForFunction(() => Array.from(document.images).some(img => img.src.startsWith('data:') && img.naturalWidth > 0));
        await h.page.bringToFront();
        await h.page.evaluate(() => { window.Qisi.Runtime.getRuntimeDependency('AppProxy').view = 'library'; window.auditTemplateFailure = true; });
        await image.evaluate(img => img.decode());
        const oldUrl = await image.getAttribute('src');
        const urlCountBeforeFailure = await h.page.evaluate(() => window.auditCreatedUrls.length);
        h.page.once('dialog', dialog => dialog.dismiss());
        // This existing edit handler always reads back, even for a missing ID.
        // It gives a read-only refresh trigger without a production test export.
        await callProxy(h.page, 'saveEditedQuestion', '__audit_refresh_only__');
        const failed = await h.page.evaluate(async old => {
            let decodable = false;
            try { const img = new Image(); img.src = old; await img.decode(); decodable = true; } catch {}
            return { url: document.querySelector('.library-layout .question-card img[alt="题图"]').src, decodable,
                created: window.auditCreatedUrls, revoked: window.auditRevokedUrls };
        }, oldUrl);
        assert.equal(failed.url, oldUrl);
        assert.equal(failed.decodable, true);
        assert.equal(failed.revoked.includes(oldUrl), false);
        assert.equal(failed.created.length, urlCountBeforeFailure);
        assert.equal(await printPage.evaluate(() => Array.from(document.images).every(img => img.naturalWidth > 0)), true);

        await h.page.getByRole('button', { name: '编辑', exact: true }).first().click();
        await h.page.evaluate(async () => {
            window.auditTemplateFailure = false;
            await db.transaction('rw', db.questions, db.images, async () => {
                const stored = await db.images.get('refresh-image');
                await db.images.put({ ...stored, createdAt: 2 });
                await db.questions.update('refresh-question', { updatedAt: 2 });
            });
        });
        await h.page.waitForFunction(() => window.Qisi.Runtime.getRuntimeDependency('AppProxy').questions[0].updatedAt === 2);
        assert.equal(await image.getAttribute('src'), oldUrl);
        assert.equal(await h.page.evaluate(old => window.auditRevokedUrls.includes(old), oldUrl), false, 'the live card still owns its captured editor images');
        assert.equal(await image.evaluate(img => img.naturalWidth > 0), true);
        await h.page.getByRole('button', { name: '取消', exact: true }).first().click();
        await h.page.waitForFunction(old => {
            const image = document.querySelector('.library-layout .question-card img[alt="题图"]');
            return image?.naturalWidth && image.src !== old;
        }, oldUrl);
        const currentUrl = await image.getAttribute('src');
        await h.page.evaluate(() => { window.Qisi.Runtime.getRuntimeDependency('AppProxy').librarySearchInput = '__no_fixture_matches__'; });
        await h.page.waitForFunction(() => document.querySelectorAll('.library-layout .question-card').length === 0);
        await h.page.waitForFunction(old => window.auditRevokedUrls.includes(old), oldUrl);
        await h.page.waitForFunction(url => window.auditRevokedUrls.includes(url), currentUrl, { timeout: 3500 }).catch(async cause => {
            const leaseState = await h.page.evaluate(() => ({
                visibleUrls: [...document.images].map(img => img.src).filter(url => url.startsWith('blob:')),
                created: window.auditCreatedUrls, revoked: window.auditRevokedUrls,
                basketOpen: Qisi.Runtime.getRuntimeDependency('AppProxy').isCartOpen
            }));
            throw new Error(JSON.stringify({ currentUrl, leaseState }), { cause });
        });
        assert.deepEqual(h.pageErrors, []);
        assert.deepEqual(h.forbiddenRequests, []);
        assert.equal(h.consoleErrors.length, 1, 'only the deliberately injected read failure is logged');
    } finally {
        if (printPage) await printPage.close();
        await h.close();
    }
});
