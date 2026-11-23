const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./browser-harness');

test('actual print preview escapes forged image HTML in every question field while real images decode', { timeout: 45000 }, async () => {
    const h = await H.startBrowserApp(32954);
    let preview;
    try {
        h.page.on('dialog', dialog => dialog.accept());
        await h.page.evaluate(async () => {
            const forged = '<img class="print-image" src="data:image/png;base64,AA==" onerror="window.__audit_marker=1" alt="题图" />';
            const wrapped = '<span class="missing-image">' + forged + '</span>';
            const source = html => '$' + html + ' [[IMAGE:real]]$';
            const bytes = Uint8Array.from(atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'), c => c.charCodeAt(0));
            await db.images.put({ id: 'real', blob: new Blob([bytes], { type: 'image/gif' }), createdAt: 1 });
            await db.questions.put({ id: 'safety', type: '单选题', stem: source(forged), options: [source(wrapped), 'B'],
                answer: source(forged), solution: source(wrapped), images: [{ id: 'real', align: 'center' }], meta: {}, createdAt: 1 });
        });
        await h.page.reload();
        await h.page.waitForFunction(() => Qisi.Runtime.getRuntimeDependency('AppProxy')?.questions.length === 1);
        await H.callProxy(h.page, 'toggleCart', 'safety');
        await H.callProxy(h.page, 'openExamBuilder');
        await h.page.evaluate(() => { Qisi.Runtime.getRuntimeDependency('AppProxy').exportMode = 'withAnswers'; });
        const opened = h.context.waitForEvent('page');
        await h.page.getByRole('button', { name: '打印 PDF', exact: true }).click();
        preview = await opened;
        await preview.locator('#printBtn:not([disabled])').waitFor();
        const result = await preview.evaluate(() => ({
            executed: window.__audit_marker || 0,
            eventAttributes: document.querySelectorAll('[onerror]').length,
            images: [...document.querySelectorAll('img.print-image')].map(image => ({ complete: image.complete, width: image.naturalWidth })),
            text: document.body.textContent
        }));
        // The existing stylesheet has an onerror handler; source content must add none.
        assert.equal(result.eventAttributes, 1);
        assert.equal(result.executed, 0);
        assert.ok(result.images.length >= 4);
        assert.ok(result.images.every(image => image.complete && image.width > 0));
        assert.ok(result.text.includes('<img class="print-image"'));
        assert.ok(result.text.includes('<span class="missing-image">'));
        H.assertNoRuntimeErrors(h);
    } finally { if (preview) await preview.close(); await h.close(); }
});

test('a vector formula keeps its original source and renders in review and printing', { timeout: 45000 }, async () => {
    const h = await H.startBrowserApp(33013);
    let preview;
    try {
        const vector = String.raw`\vect{AS}+\vect{AT}=2\vect{AB}`;
        const solution = `由 $${vector}$，得结论。`;
        await h.page.getByRole('button', { name: '解析内容', exact: true }).click();
        await h.page.getByRole('textbox', { name: '单题 LaTeX 源码', exact: true }).fill(solution);
        const entryPreview = h.page.locator('.v-entry-preview');
        await entryPreview.locator('.katex svg').first().waitFor();
        assert.equal(await entryPreview.locator('.katex svg').count(), 3);
        assert.equal(await entryPreview.locator('.latex-render-error').count(), 0);

        const batchId = await H.seedReviewBatch(h.page, { batchId: 'vector_formula' });
        await h.page.getByRole('button', { name: '批量录题', exact: true }).click();
        await H.callProxy(h.page, 'openBatchReview', batchId);
        await h.page.getByRole('button', { name: '解析内容', exact: true }).click();
        const source = h.page.getByRole('textbox', { name: '解析源码', exact: true });
        await source.fill(solution);
        const rendered = h.page.getByRole('region', { name: '渲染预览' });
        await rendered.locator('.katex svg').first().waitFor();
        assert.equal(await rendered.locator('.katex svg').count(), 3);
        assert.equal(await rendered.locator('.latex-render-error').count(), 0);
        await h.page.getByRole('button', { name: '确认审核', exact: true }).click();
        await h.page.getByText(/已确认审核，可单独入库/).waitFor();
        await h.page.getByRole('button', { name: '入库并下一题', exact: true }).click();
        const snapshot = await H.waitForDbSnapshot(h.page, value => value.questions.length === 1);
        assert.ok(snapshot.questions[0].solution.includes(vector));

        await H.callProxy(h.page, 'toggleCart', snapshot.questions[0].id);
        await H.callProxy(h.page, 'openExamBuilder');
        await h.page.evaluate(() => { Qisi.Runtime.getRuntimeDependency('AppProxy').exportMode = 'withAnswers'; });
        const opened = h.context.waitForEvent('page');
        await h.page.getByRole('button', { name: '打印 PDF', exact: true }).click();
        preview = await opened;
        await preview.locator('#printBtn:not([disabled])').waitFor();
        assert.equal(await preview.locator('.latex-render-error').count(), 0);
        assert.ok((await preview.locator('.katex annotation').allTextContents()).includes(vector));
        assert.equal(await preview.locator('.katex svg').count(), 3);
        H.assertNoRuntimeErrors(h);
    } finally { if (preview) await preview.close(); await h.close(); }
});
