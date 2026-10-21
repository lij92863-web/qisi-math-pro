const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const JSZip = require('../../vendor/jszip/jszip.min.js');
const H = require('./browser-harness');
const root = path.resolve(__dirname, '../..');
const validGif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
const text = value => `<w:r><w:t xml:space="preserve">${value}</w:t></w:r>`;

async function docx(paragraphs, figure) {
    const zip = new JSZip();
    zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="gif" ContentType="image/gif"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
    zip.file('_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="document" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    zip.file('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>' + paragraphs.map(p => `<w:p>${p}</w:p>`).join('') + '<w:sectPr/></w:body></w:document>');
    if (figure) {
        zip.file('word/_rels/document.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="figure" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/figure.gif"/></Relationships>');
        zip.file('word/media/figure.gif', figure);
    }
    return zip.generateAsync({ type: 'nodebuffer' });
}

async function imageBytes(page) {
    return page.evaluate(async () => {
        const db = new Dexie('QisiMathVueDB');
        await db.open();
        try { return await Promise.all((await db.table('images').toArray()).map(async row => ({ id: row.id, type: row.blob.type, bytes: [...new Uint8Array(await row.blob.arrayBuffer())] }))); }
        finally { db.close(); }
    });
}

for (const [index, damaged] of [false, true].entries()) {
    test((damaged ? 'damaged' : 'valid') + ' native DOCX image: print readiness reflects actual decoding without changing stored records', { timeout: 60000 }, async () => {
        const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'qisi-print-image-'));
        const questionFile = path.join(directory, 'question.docx'), supportFile = path.join(directory, 'support.docx');
        const figure = damaged ? Buffer.from('deliberately damaged GIF fixture') : validGif;
        let h, preview;
        try {
            await fs.writeFile(questionFile, await docx([
                text('一、单项选择题'),
                text('1. SYNTHETIC IMAGE READINESS $x+1$') + '<w:r><w:drawing><a:blip r:embed="figure"/></w:drawing></w:r>',
                text('A. alpha B. beta C. gamma D. delta')
            ], figure), { flag: 'wx' });
            await fs.writeFile(supportFile, await docx([text('1【答案】A'), text('【详解】EXPLICIT SYNTHETIC SOLUTION')]), { flag: 'wx' });
            h = await H.startBrowserApp(33610 + index);
            await h.context.addInitScript(() => { window.__printCalls = 0; window.print = () => { window.__printCalls++; }; });
            const imported = await H.createImportThroughUi(h.page, { files: [
                { file: questionFile, roles: ['question'] }, { file: supportFile, roles: ['answer', 'solution'] }
            ] });
            assert.equal(imported.snapshot.questions.length, 0);
            assert.equal(imported.snapshot.drafts.length, 1);
            const draft = imported.snapshot.drafts[0];
            assert.equal(draft.images.length, 1);
            await H.callProxy(h.page, 'openBatchReview', imported.batchId);
            await H.callProxy(h.page, 'selectDraftQuestion', draft.id);
            await H.callProxy(h.page, 'confirmDraftImages');
            await H.callProxy(h.page, 'markDraftReviewed');
            assert.equal(await H.callProxy(h.page, 'submitDraftQuestion', draft.id, true), true);
            const formal = (await H.getDbSnapshot(h.page)).questions;
            const storedImages = await imageBytes(h.page);
            assert.deepEqual(storedImages[0].bytes, [...figure]);
            await H.callProxy(h.page, 'toggleCart', formal[0].id);
            await H.callProxy(h.page, 'openExamBuilder');
            await h.page.getByRole('button', { name: '只打印题目', exact: true }).click();
            const opened = h.context.waitForEvent('page');
            await h.page.getByRole('button', { name: '打印 PDF', exact: true }).click();
            preview = await opened;
            await preview.waitForFunction(() => {
                const button = document.getElementById('printBtn');
                return button && button.textContent !== '正在准备图片...';
            });
            const observed = await preview.evaluate(async () => {
                const img = document.querySelector('.exam-question img');
                let decoded = false;
                try { await img.decode(); decoded = true; } catch { /* Expected for the damaged synthetic bytes. */ }
                return { disabled: document.getElementById('printBtn').disabled, label: document.getElementById('printBtn').textContent,
                    complete: img.complete, naturalWidth: img.naturalWidth, decoded, printCalls: window.__printCalls,
                    stem: document.querySelector('.question-flow-body').textContent };
            });
            if (process.env.QISI_PRINT_IMAGE_EVIDENCE_DIR) {
                const evidence = path.resolve(process.env.QISI_PRINT_IMAGE_EVIDENCE_DIR);
                assert.ok(evidence.startsWith(path.join(root, 'local-run-artifacts') + path.sep));
                await fs.mkdir(evidence, { recursive: true });
                const name = damaged ? 'damaged' : 'valid';
                await fs.writeFile(path.join(evidence, name + '.json'), JSON.stringify(observed, null, 2), { flag: 'wx' });
                await preview.screenshot({ path: path.join(evidence, name + '.png'), fullPage: true });
            }
            assert.equal(observed.complete, true);
            assert.equal(observed.decoded, !damaged);
            assert.equal(observed.naturalWidth > 0, !damaged);
            assert.equal(observed.disabled, damaged, 'A broken image must not be advertised as ready to print');
            assert.match(observed.stem, /SYNTHETIC IMAGE READINESS/);
            assert.equal(observed.printCalls, 0);
            if (damaged) {
                assert.match(observed.label, /图片未能完整加载/);
                assert.doesNotMatch(observed.label, /渲染已就绪/);
            } else {
                assert.match(observed.label, /渲染已就绪/);
                await preview.locator('#printBtn').click();
                assert.equal(await preview.evaluate(() => window.__printCalls), 1);
            }
            assert.deepEqual((await H.getDbSnapshot(h.page)).questions, formal);
            assert.deepEqual(await imageBytes(h.page), storedImages);
            H.assertNoRuntimeErrors(h);
        } finally {
            try { if (preview) await preview.close(); } finally { if (h) await h.close(); }
            for (const file of [questionFile, supportFile]) await fs.unlink(file).catch(error => { if (error.code !== 'ENOENT') throw error; });
            await fs.rmdir(directory);
        }
    });
}
