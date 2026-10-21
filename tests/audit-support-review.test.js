const test = require('node:test');
const assert = require('node:assert/strict');
const JSZip = require('jszip');
const { startBrowserApp, createImportThroughUi, assertNoRuntimeErrors } = require('./e2e/browser-harness.js');

async function docx(name, paragraphs, roles) {
    const zip = new JSZip();
    zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
    zip.file('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + paragraphs.map(value => '<w:p><w:r><w:t>' + value + '</w:t></w:r></w:p>').join('') + '</w:body></w:document>');
    return { roles, file: { name, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: await zip.generateAsync({ type: 'nodebuffer' }) } };
}

test('normal DOCX upload persists conflicting support evidence without aborting the batch or accepting an answer', { timeout: 60000 }, async () => {
    const h = await startBrowserApp(32178);
    try {
        const files = [
            await docx('questions.docx', ['1. 求函数的最小值', 'A. 甲 B. 乙 C. 丙 D. 丁'], ['question']),
            await docx('conflicts.docx', ['1. 【答案】A', '1. 【答案】B'], ['answer']),
            await docx('third.docx', ['1. 【答案】C', '9. 【答案】D'], ['answer'])
        ];
        const { batchId, snapshot } = await createImportThroughUi(h.page, { files });
        const batch = snapshot.batches.find(row => row.id === batchId);
        const drafts = snapshot.drafts.filter(row => row.batchId === batchId);
        assert.equal(batch.status, 'review', JSON.stringify(batch));
        assert.equal(drafts.length, 1);
        assert.equal(drafts[0].answer, '');
        assert.equal(drafts[0].fieldProvenance.answer.status, 'rejected');
        assert.deepEqual(drafts[0].supportEvidence.answer.values, ['A', 'B', 'C']);
        assert.ok(drafts[0].supportEvidence.answer.declarations.every(row => row.sourceId));
        assert.equal(snapshot.questions.length, 0);
        assert.ok(batch.unmatchedAnswers.some(row => row.question === '9' && row.answer === 'D'));
        assertNoRuntimeErrors(h);
    } finally {
        await h.close();
    }
});
