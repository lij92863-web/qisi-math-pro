const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const JSZip = require('../../vendor/jszip/jszip.min.js');
const H = require('./browser-harness');
const marker = '[DOCX不可显示图片:公式:synthetic-equation]';

async function documentBytes() {
    const zip = new JSZip(), lines = [
        '一、选择题', '1. 已知实数 x = 2，选择 x 的值。', 'A. 2 B. 3 C. 4 D. 5',
        '2. 已知实数 y = 3，选择 y 的值。', 'A. 3 B. 4 C. 5 D. 6',
        '参考答案', '1.【答案】A', '【详解】由已知 x = 2，' + marker + '，原始公式待人工核对。',
        '2.【答案】A', '【详解】由已知 y = 3，代入四个选项，第一项为3，所以选择A。'
    ];
    zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
    zip.file('_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="document" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    zip.file('word/_rels/document.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>');
    zip.file('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
        lines.map(line => `<w:p><w:r><w:t>${line}</w:t></w:r></w:p>`).join('') + '<w:sectPr/></w:body></w:document>');
    return zip.generateAsync({ type: 'nodebuffer' });
}

test('a DOCX support formula can be reviewed while only the clean neighbouring question can be submitted', { timeout: 60000 }, async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'qisi-unconverted-support-'));
    const file = path.join(directory, 'synthetic.docx');
    let h;
    try {
        await fs.writeFile(file, await documentBytes(), { flag: 'wx' });
        h = await H.startBrowserApp(32940);
        const imported = await H.createImportThroughUi(h.page, { files: [{ file, roles: ['full'] }] });
        const snapshot = imported.snapshot;
        assert.equal(snapshot.batches.find(b => b.id === imported.batchId).status, 'review');
        assert.equal(snapshot.drafts.length, 2);
        assert.equal(snapshot.questions.length, 0);
        const problem = snapshot.drafts.find(q => q.questionNumber === '1');
        const clean = snapshot.drafts.find(q => q.questionNumber === '2');
        assert.ok(problem.solution.includes(marker));
        assert.equal(problem.supportEvidence.solution.value, problem.solution);
        assert.equal(problem.supportEvidence.solution.state, 'unique');
        assert.ok(problem.warnings.some(warning => String(warning).includes('DOCX_SUPPORT_UNCONVERTED_FORMULA')));
        assert.equal(problem.status, 'pending');
        assert.equal(clean.status, 'pending');
        await H.callProxy(h.page, 'openBatchReview', imported.batchId);
        await H.callProxy(h.page, 'selectDraftQuestion', problem.id);
        await H.callProxy(h.page, 'markDraftReviewed');
        assert.equal((await H.getDbSnapshot(h.page)).drafts.find(q => q.id === problem.id).status, 'pending');
        assert.equal(await H.callProxy(h.page, 'submitDraftQuestion', problem.id, true), false);
        assert.equal((await H.getDbSnapshot(h.page)).questions.length, 0);
        await H.callProxy(h.page, 'selectDraftQuestion', clean.id);
        await H.callProxy(h.page, 'markDraftReviewed');
        assert.equal((await H.getDbSnapshot(h.page)).drafts.find(q => q.id === clean.id).status, 'reviewed');
        assert.equal((await H.getDbSnapshot(h.page)).questions.length, 0);
        assert.equal(await H.callProxy(h.page, 'submitDraftQuestion', clean.id, true), true);
        await h.page.reload();
        await h.page.waitForFunction(() => Boolean(window.Qisi?.Runtime?.getRuntimeDependency('AppProxy')));
        const readback = await H.getDbSnapshot(h.page);
        const unresolved = readback.drafts.find(q => q.id === problem.id);
        assert.equal(unresolved.status, 'pending');
        assert.equal(unresolved.solution, problem.solution);
        assert.deepEqual(unresolved.supportEvidence, problem.supportEvidence);
        assert.equal(readback.questions.length, 1);
        assert.equal(readback.questions[0].stem, clean.stem);
        assert.equal(JSON.stringify(readback.questions).includes(marker), false);
        H.assertNoRuntimeErrors(h);
    } finally {
        try { if (h) await h.close(); }
        finally {
            await fs.unlink(file).catch(error => { if (error.code !== 'ENOENT') throw error; });
            await fs.rmdir(directory);
        }
    }
});
