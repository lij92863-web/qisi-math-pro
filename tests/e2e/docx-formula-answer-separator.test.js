const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const JSZip = require('../../vendor/jszip/jszip.min.js');
const H = require('./browser-harness');
const printed = '$2$ $3$ / $4$';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

async function docx(punctuation = '．') {
    const zip = new JSZip(), lines = [
        '三、填空题', '1. 第一题的两个结果依次填写：______；______。',
        '2. 第二题待补充：______。', '参考答案',
        '1' + punctuation + ' ' + printed, '【详解】第一题按原文保留所有公式及斜杠，未对表达式关系作解释。',
        '2' + punctuation + ' $5$ /', '【详解】第二题的答案行不完整，需要人工核对原始支持材料。'
    ];
    zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
    zip.file('_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="document" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    zip.file('word/_rels/document.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>');
    zip.file('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
        lines.map(line => `<w:p><w:r><w:t>${line}</w:t></w:r></w:p>`).join('') + '<w:sectPr/></w:body></w:document>');
    return zip.generateAsync({ type: 'nodebuffer' });
}

test('ordinary DOCX UI preserves verified formula separators while incomplete answers remain empty', { timeout: 60000 }, async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'qisi-formula-separator-'));
    const file = path.join(directory, 'synthetic.docx');
    let h;
    try {
        const bytes = await docx();
        await fs.writeFile(file, bytes, { flag: 'wx' });
        h = await H.startBrowserApp(33040);
        const imported = await H.createImportThroughUi(h.page, { files: [{ file, roles: ['full'] }] });
        const snapshot = imported.snapshot;
        assert.equal(snapshot.batches.find(b => b.id === imported.batchId).status, 'review');
        assert.equal(snapshot.drafts.length, 2);
        assert.equal(snapshot.questions.length, 0);
        const first = snapshot.drafts.find(q => q.questionNumber === '1');
        const incomplete = snapshot.drafts.find(q => q.questionNumber === '2');
        assert.equal(first.answer, printed);
        assert.equal(first.supportEvidence.answer.value, printed);
        assert.equal(first.supportEvidence.answer.state, 'unique');
        assert.equal(first.fieldProvenance.answer.sourceId, snapshot.files[0].id);
        assert.equal(first.fieldProvenance.answer.reasonCode, 'docx-support-exact-question-match');
        assert.equal(incomplete.answer, '');
        assert.equal(incomplete.fieldProvenance.answer.status, 'missing');
        assert.equal(hash(Buffer.from(snapshot.files[0].uploadPath.split(',')[1], 'base64')), hash(bytes));
        for (const draft of snapshot.drafts) {
            assert.equal(draft.status, 'pending');
            assert.notEqual(draft.manualConfirmed, true);
        }
        await h.page.reload();
        await h.page.waitForFunction(() => Boolean(window.Qisi?.Runtime?.getRuntimeDependency('AppProxy')));
        assert.deepEqual(await H.getDbSnapshot(h.page), snapshot);
        H.assertNoRuntimeErrors(h);
    } finally {
        try { if (h) await h.close(); }
        finally {
            await fs.unlink(file).catch(error => { if (error.code !== 'ENOENT') throw error; });
            await fs.rmdir(directory);
        }
    }
});

test('a formula row without a producer-verified native support marker stays unbound in ordinary UI', { timeout: 60000 }, async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'qisi-unverified-formula-'));
    const file = path.join(directory, 'unverified.docx');
    let h;
    try {
        await fs.writeFile(file, await docx('.'), { flag: 'wx' });
        h = await H.startBrowserApp(33041);
        const imported = await H.createImportThroughUi(h.page, { files: [{ file, roles: ['full'] }] });
        assert.equal(imported.snapshot.batches.find(b => b.id === imported.batchId).status, 'review');
        assert.equal(imported.snapshot.drafts.length, 2);
        assert.ok(imported.snapshot.drafts.every(q => q.answer === '' && q.status === 'pending'));
        assert.equal(imported.snapshot.questions.length, 0);
        H.assertNoRuntimeErrors(h);
    } finally {
        try { if (h) await h.close(); }
        finally {
            await fs.unlink(file).catch(error => { if (error.code !== 'ENOENT') throw error; });
            await fs.rmdir(directory);
        }
    }
});
