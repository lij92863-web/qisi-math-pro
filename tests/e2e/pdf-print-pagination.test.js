const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const H = require('./browser-harness');
const { installMineruReplay } = require('../harness/mineru-replay');
const { readSuite } = require('../../scripts/golden/run.cjs');
const root = path.resolve(__dirname, '../..');

for (const [index, id] of ['pdf-full', 'pdf-dual-with-image'].entries()) {
    test(id + ': actual short PDF keeps questions and answers on two separate pages', { timeout: 90000 }, async () => {
        const loaded = readSuite(path.join(root, 'golden/synthetic-suite.json'));
        assert.equal(loaded.sha256, '720da3f4ab5db00216b6fb2d7b1c17f057b34fd6e3fd21be0a45e163e2a9ec66');
        const item = loaded.suite.cases.find(row => row.id === id);
        const h = await H.startBrowserApp(33430 + index);
        let preview;
        try {
            await installMineruReplay(h.page, item.sources.map(source => ({
                file: path.join(root, source.file), items: source.items,
                images: Object.fromEntries(Object.entries(source.assets || {}).map(([name, asset]) => [name, {
                    type: asset.type, bytes: Buffer.from(asset.base64, 'base64')
                }]))
            })));
            const imported = await H.createImportThroughUi(h.page, { files: item.sources.map(source => ({
                file: path.join(root, source.file), roles: source.roles
            })) });
            assert.equal(imported.snapshot.questions.length, 0);
            await H.callProxy(h.page, 'openBatchReview', imported.batchId);
            for (const draft of imported.snapshot.drafts) {
                await H.callProxy(h.page, 'selectDraftQuestion', draft.id);
                for (const field of ['question', 'answer', 'solution']) await H.callProxy(h.page, 'choosePdfCandidate', field, 0);
                if (draft.images.length) await H.callProxy(h.page, 'confirmDraftImages');
                await H.callProxy(h.page, 'markDraftReviewed');
                assert.equal(await H.callProxy(h.page, 'submitDraftQuestion', draft.id, true), true);
            }
            const formal = (await H.getDbSnapshot(h.page)).questions;
            for (const expected of item.expected) await H.callProxy(h.page, 'toggleCart', formal.find(q => q.stem.includes(expected.stemIncludes)).id);
            await H.callProxy(h.page, 'openExamBuilder');
            await h.page.getByLabel('每题下方显示答案').uncheck();
            await h.page.getByLabel('每题下方显示解析').uncheck();
            await h.page.getByRole('button', { name: '一份 PDF：题目后另起新页印答案', exact: true }).click();
            const opened = h.context.waitForEvent('page');
            await h.page.getByRole('button', { name: '打印 PDF', exact: true }).click();
            preview = await opened;
            await preview.locator('#printBtn:not([disabled])').waitFor();
            await preview.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode())); });
            const alignment = await preview.locator('.option-content:has(img)').evaluateAll(nodes => nodes.map(node => {
                const label = node.parentElement.querySelector('.option-label');
                return Math.abs(label.getBoundingClientRect().top - node.getBoundingClientRect().top);
            }));
            assert.ok(alignment.every(delta => delta < 2), 'Image option labels must align with their content top, not its caption baseline');
            const bytes = await preview.pdf({ format: 'A4', preferCSSPageSize: true, printBackground: true });
            const readback = await h.page.evaluate(async data => {
                pdfjsLib.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.min.js';
                const task = pdfjsLib.getDocument({ data: new Uint8Array(data) });
                try {
                    const doc = await task.promise, pages = [];
                    for (let i = 1; i <= doc.numPages; i++) {
                        const content = await (await doc.getPage(i)).getTextContent();
                        pages.push(content.items.map(item => item.str || '').join('').replace(/\s/g, ''));
                    }
                    return { pageCount: doc.numPages, pages };
                } finally { await task.destroy(); }
            }, Array.from(bytes));
            if (process.env.QISI_PAGINATION_EVIDENCE_DIR) {
                const directory = path.resolve(process.env.QISI_PAGINATION_EVIDENCE_DIR);
                assert.ok(directory.startsWith(path.join(root, 'local-run-artifacts') + path.sep));
                await fs.mkdir(directory, { recursive: true });
                await fs.writeFile(path.join(directory, id + '.pdf'), bytes, { flag: 'wx' });
                await fs.writeFile(path.join(directory, id + '-observed.json'), JSON.stringify(readback, null, 2), { flag: 'wx' });
            }
            assert.equal(readback.pageCount, 2);
            assert.ok(readback.pages[0].includes('第一题'));
            if (item.expected.length === 2) assert.ok(readback.pages[0].includes('第二题'));
            assert.ok(!readback.pages[0].includes('参考答案与解析'));
            assert.ok(readback.pages[1].includes('参考答案与解析'));
            assert.ok(!readback.pages[1].includes('第一题'));
            assert.equal(await preview.locator('.exam-question img').count(), item.expected.reduce((n, q) => n + q.imageCount, 0));
            assert.deepEqual((await H.getDbSnapshot(h.page)).questions, formal);
            H.assertNoRuntimeErrors(h);
        } finally {
            try { if (preview) await preview.close(); } finally { await h.close(); }
        }
    });
}
