const test = require('node:test');
const assert = require('node:assert/strict');
const JSZip = require('../vendor/jszip/jszip.min.js');
const { assertDocxUploadType, validateDocxPackage } = require('../qisi-docx-upload-policy');
const file = { originalname: 'math.docx', mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
async function packageWith(extra = {}) {
    const zip = new JSZip(); zip.file('[Content_Types].xml', '<Types/>');
    zip.file('word/document.xml', '<document/>');
    for (const [name, value] of Object.entries(extra)) zip.file(name, value);
    return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
test('normal DOCX with embedded fonts, math and Office images remains accepted', async () => {
    const buffer = await packageWith({ 'word/fonts/math.odttf': 'font',
        'word/media/figure.tiff': 'image', 'customXml/item1.xml': '<math/>' });
    assert.deepEqual(await validateDocxPackage(buffer, file), { ok: true });
    assertDocxUploadType({ ...file, mimetype: 'application/octet-stream' });
});
test('wrong MIME, extension, text renamed DOCX and non-Office ZIP are rejected', async () => {
    assert.throws(() => assertDocxUploadType({ ...file, mimetype: 'image/png' }), { code: 'DOCX_UPLOAD_TYPE_INVALID' });
    assert.throws(() => assertDocxUploadType({ ...file, originalname: 'math.exe' }), { code: 'DOCX_UPLOAD_TYPE_INVALID' });
    await assert.rejects(validateDocxPackage(Buffer.from('not an Office file'), file), { code: 'DOCX_UPLOAD_PACKAGE_INVALID' });
    const zip = new JSZip(); zip.file('word/styles.xml', '<styles/>');
    await assert.rejects(validateDocxPackage(await zip.generateAsync({ type: 'nodebuffer' }), file), { code: 'DOCX_UPLOAD_PACKAGE_INVALID' });
});
test('traversal, renamed macro package and compression bomb never reach conversion', async () => {
    await assert.rejects(validateDocxPackage(await packageWith({ '../word/escape.xml': 'x' }), file), { code: 'ARCHIVE_PATH_TRAVERSAL' });
    await assert.rejects(validateDocxPackage(await packageWith({ 'word/vbaProject.bin': 'macro' }), file), { code: 'DOCX_UPLOAD_PACKAGE_INVALID' });
    await assert.rejects(validateDocxPackage(await packageWith({ 'word/bomb.xml': 'a'.repeat(1000000) }), file), { code: 'ARCHIVE_COMPRESSION_RATIO_LIMIT' });
});

test('HTTP conversion rejects hostile uploads before starting Office and returns safe JSON', { timeout: 20000 }, async () => {
    const net = require('node:net'), path = require('node:path');
    const { spawn } = require('node:child_process');
    const port = await new Promise(resolve => {
        const server = net.createServer(); server.listen(0, '127.0.0.1', () => {
            const value = server.address().port; server.close(() => resolve(value));
        });
    });
    const child = spawn(process.execPath, ['qisi-local-server.js'], {
        cwd: path.resolve(__dirname, '..'), env: { ...process.env, PORT: String(port) },
        stdio: 'ignore', windowsHide: true
    });
    const base = `http://127.0.0.1:${port}`;
    try {
        let ready = false;
        for (let i = 0; i < 60; i++) {
            try { if ((await fetch(base + '/api/health')).ok) { ready = true; break; } } catch {}
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        assert.equal(ready, true);
        for (const [type, code] of [['image/png', 'DOCX_UPLOAD_TYPE_INVALID'],
            [file.mimetype, 'DOCX_UPLOAD_PACKAGE_INVALID']]) {
            const body = new FormData(); body.append('file', new Blob(['bad file'], { type }), 'math.docx');
            const response = await fetch(base + '/api/convert/docx-to-pdf', { method: 'POST', body });
            assert.equal(response.status, 400);
            const json = await response.json(); assert.equal(json.code, code);
            assert.equal(JSON.stringify(json).includes('stack'), false);
        }
    } finally { child.kill(); }
});
