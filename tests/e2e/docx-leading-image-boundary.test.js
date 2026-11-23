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
const paragraph = value => `<w:p>${value}</w:p>`;

async function docx(paragraphs, { autoNumber = false } = {}) {
    const zip = new JSZip();
    zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="gif" ContentType="image/gif"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
    zip.file('_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdDocument" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    zip.file('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>' + paragraphs.map(paragraph).join('') + '<w:sectPr/></w:body></w:document>');
    zip.file('word/_rels/document.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdFigure" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/figure.gif"/></Relationships>');
    zip.file('word/media/figure.gif', gif);
    if (autoNumber) zip.file('word/numbering.xml', '<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>');
    return zip.generateAsync({ type: 'nodebuffer' });
}

test('ordinary DOCX UI preserves all twelve separately numbered answers under 参考答案', { timeout: 45000 }, async () => {
    const h = await H.startBrowserApp(33009);
    try {
        const mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        const numbers = Array.from({ length: 12 }, (_, index) => index + 1);
        const questions = await docx(numbers.map(number => text(number + '. 合成题目 ' + number)));
        const answers = await docx([text('参考答案'), ...[...numbers].reverse().map(number => text(number + '. -' + (100 + number)))]);
        const imported = await H.createImportThroughUi(h.page, { files: [
            { file: { name: 'questions.docx', mimeType, buffer: questions }, roles: ['question'] },
            { file: { name: 'answers.docx', mimeType, buffer: answers }, roles: ['answer'] }
        ] });
        const rows = imported.snapshot.drafts.filter(draft => draft.batchId === imported.batchId);
        assert.equal(rows.length, 12);
        assert.deepEqual(rows.map(row => [Number(row.questionNumber), row.answer]).sort((a, b) => a[0] - b[0]),
            numbers.map(number => [number, '-' + (100 + number)]));
        assert.equal(imported.snapshot.questions.length, 0);
        H.assertNoRuntimeErrors(h);
    } finally { await h.close(); }
});

test('ordinary DOCX UI reads Word list numbers after the 参考答案 title', { timeout: 45000 }, async () => {
    const h = await H.startBrowserApp(33011);
    try {
        const mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        const numberProperties = '<w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>';
        const questions = await docx([text('1. 求第一个合成结果'), text('2. 求第二个合成结果')]);
        const answers = await docx([text('参考答案'), numberProperties + text('24'), numberProperties + text('35')], { autoNumber: true });
        const imported = await H.createImportThroughUi(h.page, { files: [
            { file: { name: 'questions.docx', mimeType, buffer: questions }, roles: ['question'] },
            { file: { name: 'answers.docx', mimeType, buffer: answers }, roles: ['answer', 'solution'] }
        ] });
        const rows = imported.snapshot.drafts.filter(draft => draft.batchId === imported.batchId);
        assert.equal(rows.length, 2);
        assert.deepEqual(Object.fromEntries(rows.map(row => [row.questionNumber, row.answer])), { 1: '24', 2: '35' });
        H.assertNoRuntimeErrors(h);
    } finally { await h.close(); }
});

test('an empty reference-answer section remains visible for review after reload', { timeout: 45000 }, async () => {
    const h = await H.startBrowserApp(33012);
    try {
        const mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        const questions = await docx([text('1. 求合成结果')]);
        const answers = await docx([text('参考答案')]);
        const imported = await H.createImportThroughUi(h.page, { files: [
            { file: { name: 'questions.docx', mimeType, buffer: questions }, roles: ['question'] },
            { file: { name: 'empty-answers.docx', mimeType, buffer: answers }, roles: ['answer'] }
        ] });
        assert.equal(imported.snapshot.drafts[0].answer, '');
        await h.page.reload();
        await H.callProxy(h.page, 'openBatchReview', imported.batchId);
        await h.page.getByText('1 条来源内容待核对', { exact: true }).waitFor();
        const dialog = new Promise(resolve => h.page.once('dialog', async message => {
            await message.dismiss();
            resolve(message.message());
        }));
        await h.page.getByRole('button', { name: '查看待核对内容', exact: true }).click();
        assert.match(await dialog, /题号未确定.*未找到能可靠配对.*empty-answers\.docx/);
        H.assertNoRuntimeErrors(h);
    } finally { await h.close(); }
});

test('ordinary DOCX UI keeps leading stem and support figures with their exact labelled questions', { timeout: 60000 }, async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'qisi-docx-image-regression-'));
    const questionPath = path.join(directory, 'questions.docx'), supportPath = path.join(directory, 'support.docx');
    let h;
    try {
        const questionBytes = await docx([
            text('一、选择题'), picture + text('1. FIRST STEM'), text('A. one B. two C. three D. four'),
            text('2. SECOND STEM'), text('A. alpha B. beta C. gamma D. delta')
        ]);
        const supportBytes = await docx([
            text('1【答案】A'), text('【详解】FIRST SOLUTION'),
            picture + text('2【答案】B'), text('【详解】SECOND SOLUTION')
        ]);
        await fs.writeFile(questionPath, questionBytes, { flag: 'wx' });
        await fs.writeFile(supportPath, supportBytes, { flag: 'wx' });
        h = await H.startBrowserApp(32840);
        const imported = await H.createImportThroughUi(h.page, { files: [
            { file: questionPath, roles: ['question'] }, { file: supportPath, roles: ['answer', 'solution'] }
        ] });
        const snapshot = imported.snapshot, drafts = snapshot.drafts.filter(q => q.batchId === imported.batchId);
        assert.equal(snapshot.batches.find(b => b.id === imported.batchId).status, 'review');
        assert.equal(snapshot.questions.length, 0);
        assert.deepEqual(drafts.map(q => q.questionNumber).sort(), ['1', '2']);
        const first = drafts.find(q => q.questionNumber === '1'), second = drafts.find(q => q.questionNumber === '2');
        const primary = snapshot.files.find(f => f.filename === 'questions.docx');
        const support = snapshot.files.find(f => f.filename === 'support.docx');
        for (const [file, bytes] of [[primary, questionBytes], [support, supportBytes]]) {
            assert.equal(hash(Buffer.from(file.uploadPath.split(',')[1], 'base64')), hash(bytes));
        }
        assert.equal(first.images.length, 1);
        assert.equal(first.stem, `[[IMAGE:${first.images[0].id}]] FIRST STEM`);
        assert.equal(first.solution, 'FIRST SOLUTION');
        assert.equal(first.answer, 'A');
        assert.equal(second.images.length, 1);
        assert.equal(second.solution, `[[IMAGE:${second.images[0].id}]]\nSECOND SOLUTION`);
        assert.equal(second.answer, 'B');
        assert.equal(second.images[0].position, 'solution');
        assert.equal(second.images[0].sourceFileId, support.id);
        for (const q of drafts) {
            assert.equal(q.fieldProvenance.stem.sourceId, primary.id);
            assert.equal(q.fieldProvenance.stem.producerMode, 'deterministic-docx');
            assert.equal(q.fieldProvenance.solution.sourceId, support.id);
            assert.equal(q.status, 'pending');
            assert.notEqual(q.manualConfirmed, true);
            assert.equal(hash(Buffer.from(q.images[0].url.split(',')[1], 'base64')), hash(gif));
        }
        await h.page.reload();
        await h.page.waitForFunction(() => Boolean(window.Qisi?.Runtime?.getRuntimeDependency('AppProxy')));
        assert.deepEqual(await H.getDbSnapshot(h.page), snapshot);
        await H.callProxy(h.page, 'openBatchReview', imported.batchId);
        for (const q of drafts) {
            await H.callProxy(h.page, 'selectDraftQuestion', q.id);
            await h.page.locator('.v-editor-toolbar').getByRole('button', {
                name: q.images[0].position === 'solution' ? '解析内容' : '题目内容', exact: true
            }).click();
            const visible = await h.page.evaluate(async url => {
                await Vue.nextTick();
                const nodes = [...document.images].filter(node => node.src === url && node.getBoundingClientRect().width > 0);
                await Promise.all(nodes.map(node => node.decode()));
                return nodes.length > 0 && nodes.every(node => node.naturalWidth > 0 && node.naturalHeight > 0);
            }, q.images[0].url);
            assert.equal(visible, true);
        }
        assert.equal((await H.getDbSnapshot(h.page)).questions.length, 0);
        H.assertNoRuntimeErrors(h);
    } finally {
        try { if (h) await h.close(); }
        finally {
            for (const file of [questionPath, supportPath]) await fs.unlink(file).catch(error => { if (error.code !== 'ENOENT') throw error; });
            await fs.rmdir(directory);
        }
    }
});
