const test = require('node:test');
const assert = require('node:assert/strict');

const JSZip = require('../vendor/jszip/3.10.1/jszip.min.js');
const {
    auditDocxBuffer,
    parsePdfInfo
} = require('../scripts/audit-real-material-sources.js');

test('real-material source audit reads DOCX structure through the production skeleton', async () => {
    const zip = new JSZip();
    zip.file('word/document.xml', [
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"',
        ' xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"><w:body>',
        '<w:p><w:r><w:t>一、选择题（本题共2小题）</w:t></w:r></w:p>',
        '<w:p><w:r><w:t>1. 第一题</w:t></w:r><m:oMath><m:r><m:t>x</m:t></m:r></m:oMath></w:p>',
        '<w:p><w:r><w:t>2. 第二题</w:t></w:r><w:drawing/></w:p>',
        '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>数据</w:t></w:r></w:p></w:tc></w:tr></w:tbl>',
        '</w:body></w:document>'
    ].join(''));
    zip.file('word/media/image1.png', Buffer.from([137, 80, 78, 71]));
    const result = await auditDocxBuffer(await zip.generateAsync({ type: 'nodebuffer' }));

    assert.equal(result.paragraphCount, 4);
    assert.equal(result.tableCount, 1);
    assert.equal(result.drawingCount, 1);
    assert.equal(result.ommlCount, 1);
    assert.equal(result.mediaCount, 1);
    assert.equal(result.skeleton.authoritative, true);
    assert.deepEqual(result.skeleton.questionNumbers, ['1', '2']);
});

test('real-material PDF metadata parser keeps pages, A4 geometry and encryption evidence', () => {
    const result = parsePdfInfo([
        'Pages:           12',
        'Encrypted:       no',
        'Tagged:          yes',
        'Page size:       595.276 x 841.89 pts (A4)',
        'File size:       123456 bytes',
        'PDF version:     1.7'
    ].join('\n'));

    assert.equal(result.pageCount, 12);
    assert.equal(result.encrypted, false);
    assert.equal(result.tagged, true);
    assert.equal(result.widthPoints, 595.276);
    assert.equal(result.heightPoints, 841.89);
    assert.equal(result.fileSizeBytes, 123456);
    assert.equal(result.pdfVersion, '1.7');
});

test('real-material audit source contains no network or AI endpoint', () => {
    const source = require('node:fs').readFileSync(
        require('node:path').resolve(__dirname, '../scripts/audit-real-material-sources.js'),
        'utf8'
    );
    assert.doesNotMatch(source, /https?:\/\//i);
    assert.doesNotMatch(source, /\/api\/(?:ai|ocr)\//i);
});
