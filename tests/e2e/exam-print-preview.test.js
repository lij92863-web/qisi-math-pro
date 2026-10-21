const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const JSZip = require('../../vendor/jszip/jszip.min.js');
const H = require('./browser-harness');

const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const text = value => `<w:r><w:t xml:space="preserve">${value}</w:t></w:r>`;
const picture = '<w:r><w:drawing><a:blip r:embed="rIdFigure"/></w:drawing></w:r>';

async function makeDocx(paragraphs) {
    const zip = new JSZip();
    zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="gif" ContentType="image/gif"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
    zip.file('_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="document" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    zip.file('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>' + paragraphs.map(p => `<w:p>${p}</w:p>`).join('') + '<w:sectPr/></w:body></w:document>');
    zip.file('word/_rels/document.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdFigure" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/figure.gif"/></Relationships>');
    zip.file('word/media/figure.gif', gif);
    return zip.generateAsync({ type: 'nodebuffer' });
}

// Wait for actual newly opened documents; do not call or replace the renderer.
async function previews(h, count) {
    const opened = [];
    let listener, timer;
    const ready = new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`Expected ${count} preview pages, opened ${opened.length}`)), 15000);
        listener = page => { opened.push(page); if (opened.length === count) resolve(); };
        h.context.on('page', listener);
    });
    try {
        await h.page.getByRole('button', { name: '打印 PDF', exact: true }).click();
        await ready;
        for (const page of opened) await page.locator('#printBtn:not([disabled])').waitFor();
        return opened;
    } finally {
        clearTimeout(timer);
        h.context.off('page', listener);
    }
}

async function inspect(page) {
    return page.evaluate(async () => {
        await Promise.all([...document.images].map(img => img.decode()));
        return {
            title: document.title,
            heading: document.querySelector('.title')?.textContent,
            stems: [...document.querySelectorAll('.question-flow-body')].map(node => node.textContent),
            indices: [...document.querySelectorAll('.q-index')].map(node => node.textContent),
            answers: [...document.querySelectorAll('.answer-item')].map(node => node.textContent),
            math: document.querySelectorAll('.katex').length,
            errors: document.querySelectorAll('.latex-render-error,.missing-image').length,
            unresolvedTokens: /\[\[(?:IMAGE|FORMULA_IMAGE):/.test(document.body.textContent),
            images: [...document.images].map(img => ({ url: img.src, width: img.naturalWidth, height: img.naturalHeight })),
            injected: document.querySelector('.title img') !== null,
            printCalls: window.__testPrintCalls || 0
        };
    });
}

test('synthetic DOCX review, submission, cart reload and three print modes preserve fields and image bytes', { timeout: 120000 }, async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'qisi-exam-preview-'));
    const questionFile = path.join(directory, 'questions.docx'), supportFile = path.join(directory, 'support.docx');
    let h;
    try {
        await fs.writeFile(questionFile, await makeDocx([
            text('一、单项选择题'), picture + text('1. FIRST PRINT STEM $x^2$'),
            text('A. one B. two C. three D. four'), text('2. SECOND PRINT STEM $y+1$'),
            text('A. alpha B. beta C. gamma D. delta')
        ]), { flag: 'wx' });
        await fs.writeFile(supportFile, await makeDocx([
            text('1【答案】A'), text('【详解】FIRST PRINT SOLUTION $x^2$'),
            text('2【答案】B'), text('【详解】SECOND PRINT SOLUTION $y+1$')
        ]), { flag: 'wx' });
        h = await H.startBrowserApp(33110);
        await h.context.addInitScript(() => {
            window.__testPrintCalls = 0;
            window.print = () => { window.__testPrintCalls += 1; };
        });
        const imported = await H.createImportThroughUi(h.page, { files: [
            { file: questionFile, roles: ['question'] }, { file: supportFile, roles: ['answer', 'solution'] }
        ] });
        assert.equal(imported.snapshot.questions.length, 0);
        assert.equal(imported.snapshot.drafts.length, 2);
        await H.callProxy(h.page, 'openBatchReview', imported.batchId);
        for (const draft of imported.snapshot.drafts) {
            await H.callProxy(h.page, 'selectDraftQuestion', draft.id);
            if (draft.images.length) await H.callProxy(h.page, 'confirmDraftImages');
            await H.callProxy(h.page, 'markDraftReviewed');
            assert.equal((await H.getDbSnapshot(h.page)).drafts.find(q => q.id === draft.id).status, 'reviewed');
            assert.equal(await H.callProxy(h.page, 'submitDraftQuestion', draft.id, true), true);
        }
        const formal = (await H.getDbSnapshot(h.page)).questions;
        assert.equal(formal.length, 2);
        const first = formal.find(q => q.stem.includes('FIRST PRINT STEM'));
        const second = formal.find(q => q.stem.includes('SECOND PRINT STEM'));
        assert.equal(first.answer, 'A');
        assert.equal(second.answer, 'B');
        await H.callProxy(h.page, 'toggleCart', first.id);
        await H.callProxy(h.page, 'toggleCart', second.id);
        await H.callProxy(h.page, 'moveCartQuestion', second.id, -1);
        assert.deepEqual(await h.page.evaluate(() => JSON.parse(localStorage.getItem('qisi_exam_cart'))), [second.id, first.id]);
        await h.page.reload();
        // AppProxy is exposed before async onMounted finishes loading the saved cart.
        await h.page.waitForFunction(() => window.Qisi?.Runtime?.getRuntimeDependency('AppProxy')?.cart?.length === 2);
        assert.deepEqual(await h.page.evaluate(() => window.Qisi.Runtime.getRuntimeDependency('AppProxy').cart), [second.id, first.id]);
        await H.callProxy(h.page, 'openExamBuilder');
        const title = '<img src=x onerror="window.injected=1"> synthetic title';
        await h.page.locator('.exam-config-panel input').first().fill(title);
        await h.page.getByLabel('每题下方显示答案').uncheck();
        await h.page.getByLabel('每题下方显示解析').uncheck();

        const checkQuestions = row => {
            assert.equal(row.heading, title);
            assert.equal(row.injected, false);
            assert.deepEqual(row.indices, ['1.', '2.']);
            assert.match(row.stems[0], /SECOND PRINT STEM/);
            assert.match(row.stems[1], /FIRST PRINT STEM/);
            assert.ok(row.math >= 2);
            assert.equal(row.errors, 0);
            assert.equal(row.unresolvedTokens, false);
            assert.equal(row.images.length, 1);
            assert.ok(row.images.every(img => img.width > 0 && img.height > 0));
            assert.equal(hash(Buffer.from(row.images[0].url.split(',')[1], 'base64')), hash(gif));
            assert.equal(row.printCalls, 0);
        };
        await h.page.getByRole('button', { name: '只打印题目', exact: true }).click();
        const [questionsPage] = await previews(h, 1);
        const questions = await inspect(questionsPage);
        checkQuestions(questions);
        assert.equal(questions.answers.length, 0);
        assert.doesNotMatch(await questionsPage.locator('body').innerText(), /PRINT SOLUTION/);
        await questionsPage.getByRole('button', { name: '渲染已就绪，打印 / 另存为 PDF', exact: true }).click();
        assert.equal((await inspect(questionsPage)).printCalls, 1);
        await questionsPage.close();

        await h.page.getByRole('button', { name: '一份 PDF：题目后另起新页印答案', exact: true }).click();
        const [combinedPage] = await previews(h, 1);
        const combined = await inspect(combinedPage);
        checkQuestions(combined);
        assert.equal(combined.answers.length, 2);
        assert.match(combined.answers[0], /^1\.\s*B.*SECOND PRINT SOLUTION/s);
        assert.match(combined.answers[1], /^2\.\s*A.*FIRST PRINT SOLUTION/s);
        assert.equal(await combinedPage.locator('.answer-section.new-page').count(), 1);
        await combinedPage.close();

        await h.page.getByRole('button', { name: '两份 PDF：题目和答案分开', exact: true }).click();
        const splitPages = await previews(h, 2);
        const split = await Promise.all(splitPages.map(inspect));
        const questionHalf = split.find(row => row.stems.length === 2), answerHalf = split.find(row => row.answers.length === 2);
        assert.ok(questionHalf && answerHalf);
        checkQuestions(questionHalf);
        assert.equal(questionHalf.answers.length, 0);
        assert.equal(answerHalf.stems.length, 0);
        assert.deepEqual(answerHalf.answers, combined.answers);
        assert.equal(answerHalf.errors, 0);
        assert.equal(answerHalf.printCalls, 0);
        for (const page of splitPages) await page.close();

        // A stale selection must stop before opening even the first split page.
        await H.callProxy(h.page, 'toggleCart', 'synthetic-missing-id');
        const pagesBefore = h.context.pages().length;
        const alert = h.page.waitForEvent('dialog');
        const print = H.callProxy(h.page, 'printExam');
        const dialog = await alert;
        assert.match(dialog.message(), /题目已不存在/);
        await dialog.dismiss();
        await print;
        assert.equal(h.context.pages().length, pagesBefore);
        assert.deepEqual((await H.getDbSnapshot(h.page)).questions, formal);
        H.assertNoRuntimeErrors(h);
    } finally {
        try { if (h) await h.close(); }
        finally {
            for (const file of [questionFile, supportFile]) await fs.unlink(file).catch(error => { if (error.code !== 'ENOENT') throw error; });
            await fs.rmdir(directory);
        }
    }
});
