const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Converter = require('../qisi-docx-converter.js');
const ROOT = path.resolve(__dirname, '..');

const source = overrides => ({
    id: 'docx-1',
    filename: 'paper.docx',
    fileType: 'docx',
    uploadPath: 'data:application/docx;base64,AA==',
    roles: ['question'],
    pageRange: '2-4',
    ...overrides
});

const response = (data, overrides = {}) => ({
    ok: true,
    status: 200,
    json: async () => data,
    ...overrides
});

const ports = overrides => ({
    request: async url => url.endsWith('/api/health')
        ? response({ ok: true })
        : response({
            ok: true,
            pdfDataUrl: 'data:application/pdf;base64,AA==',
            pdfFilename: 'server-paper.pdf',
            pdfBytes: 123
        }),
    createFormData: () => ({ append() {} }),
    dataUrlToBlob: async () => ({ size: 1 }),
    getBaseUrl: () => 'http://127.0.0.1:3000',
    getRoles: file => file.roles || [],
    now: () => 123,
    logger: { log() {}, warn() {}, error() {} },
    ...overrides
});

test('DOCX converter preserves conversion request, source identity, roles, and page range', async () => {
    const calls = [];
    const appended = [];
    const converter = Converter.createDocxToPdfConverter(ports({
        request: async (url, options) => {
            calls.push({ url, options });
            return url.endsWith('/api/health')
                ? response({ ok: true })
                : response({
                    ok: true,
                    pdfDataUrl: 'data:application/pdf;base64,PDF',
                    pdfFilename: 'server-paper.pdf',
                    pdfBytes: 321
                });
        },
        createFormData: () => ({
            append: (...args) => appended.push(args)
        })
    }));
    const controller = new AbortController();
    const result = await converter(source(), { signal: controller.signal });

    assert.equal(calls.length, 2);
    assert.equal(calls[0].url, 'http://127.0.0.1:3000/api/health');
    assert.equal(calls[1].url, 'http://127.0.0.1:3000/api/convert/docx-to-pdf');
    assert.equal(calls[0].options.signal, controller.signal);
    assert.equal(calls[1].options.signal, controller.signal);
    assert.equal(appended[0][0], 'file');
    assert.equal(appended[0][2], 'paper.docx');
    assert.equal(result.id, 'docx-1_converted_pdf_123');
    assert.equal(result.filename, 'paper.pdf');
    assert.equal(result.serverPdfFilename, 'server-paper.pdf');
    assert.equal(result.fileType, 'pdf');
    assert.equal(result.pageRange, '2-4');
    assert.deepEqual(result.roles, ['question']);
    assert.equal(result.convertedFromDocx, true);
    assert.equal(result.sourceDocxFileId, 'docx-1');
    assert.equal(result.sourceDocxFileName, 'paper.docx');
});

test('DOCX converter rejects missing dependencies and malformed conversion output', async () => {
    assert.throws(
        () => Converter.createDocxToPdfConverter({}),
        error => error.code === 'DOCX_CONVERTER_PORT_REQUIRED'
    );
    const converter = Converter.createDocxToPdfConverter(ports({
        request: async url => url.endsWith('/api/health')
            ? response({ ok: true })
            : response({ ok: true, pdfFilename: 'missing-data.pdf' })
    }));
    await assert.rejects(
        converter(source()),
        error => error.code === 'DOCX_CONVERT_RESULT_MALFORMED'
    );
});

test('DOCX converter stops before conversion when cancellation follows health', async () => {
    const controller = new AbortController();
    let conversionCalls = 0;
    const converter = Converter.createDocxToPdfConverter(ports({
        request: async url => {
            if (url.endsWith('/api/health')) {
                controller.abort();
                return response({ ok: true });
            }
            conversionCalls += 1;
            return response({ ok: true });
        }
    }));
    await assert.rejects(
        converter(source(), { signal: controller.signal }),
        error =>
            error.name === 'AbortError' &&
            error.code === 'DOCX_CONVERT_CANCELLED'
    );
    assert.equal(conversionCalls, 0);
});

test('app assembles the DOCX converter owner without retaining conversion transport', () => {
    const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    assert.match(app, /DocxConverter\s*\.createDocxToPdfConverter\s*\(/);
    assert.doesNotMatch(app, /const\s+convertDocxRecordToPdfRecord\s*=/);
    assert.doesNotMatch(app, /const\s+checkLocalDocxConvertService\s*=/);
    assert.doesNotMatch(app, /\/api\/convert\/docx-to-pdf/);
});
