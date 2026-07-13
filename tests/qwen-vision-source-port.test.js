const test = require('node:test');
const assert = require('node:assert/strict');

const SourcePort = require('../qisi-qwen-vision-source-port.js');

const makePorts = overrides => ({
    requestText: async options => {
        const text = '{"questions":[{"questionNumber":"1","stem":"S"}]}';
        assert.equal(options.validateText(text, { model: 'fixture-vl' }), true);
        return { text, model: 'fixture-vl', task: options.task };
    },
    parseStrictQuestionPayload: text => ({
        ok: true,
        method: 'strict-json-contract',
        questions: JSON.parse(text).questions
    }),
    postprocessRecognizedItems: rows => rows.map(row => ({
        ...row, options: [], answer: '', solution: '', sourceTrace: {}
    })),
    getDefaultType: () => '解答题',
    getRoles: () => ['question'],
    logDiagnostic: () => {},
    projectDocxVisionCandidate: input => ({
        ...input.candidate,
        source: input.source,
        producerProjected: true
    }),
    ...overrides
});

test('strict source port projects PDF identity through the production task client', async () => {
    const recognize = SourcePort.createStrictQuestionPageRecognizer(makePorts());
    const result = await recognize({
        file: { id: 'pdf-1', filename: 'paper.pdf', fileType: 'pdf' },
        imageUrl: 'data:image/png;base64,fixture',
        pageNo: 2
    });
    assert.equal(result.length, 1);
    assert.equal(result[0].sourceTrace.strictProtocol.accepted, true);
    assert.equal(result[0].sourceTrace.strictProtocol.engine, 'fixture-vl');
    assert.equal(result[0].sourcePage, 2);
    assert.equal(result.__strictPageDiagnostics.protocolRejectedCount, 0);
});

test('strict source port delegates canonical DOCX vision projection', async () => {
    const recognize = SourcePort.createStrictQuestionPageRecognizer(makePorts());
    const result = await recognize({
        file: {
            id: 'virtual-pdf', filename: 'paper.pdf', fileType: 'pdf',
            convertedFromDocx: true, sourceDocxFileId: 'docx-1',
            sourceDocxFileName: 'paper.docx', sourceOrder: 3
        },
        imageUrl: 'data:image/png;base64,fixture'
    });
    assert.equal(result[0].producerProjected, true);
    assert.equal(result[0].source.sourceId, 'docx-1');
    assert.equal(result[0].source.format, 'docx');
});

test('missing ports, malformed source, and cancellation fail closed', async () => {
    assert.throws(
        () => SourcePort.createStrictQuestionPageRecognizer({}),
        error => error.code === 'QWEN_VISION_SOURCE_PORT_REQUIRED'
    );
    const recognize = SourcePort.createStrictQuestionPageRecognizer(makePorts());
    await assert.rejects(
        recognize({ file: { id: 'pdf-1' }, imageUrl: '' }),
        error => error.code === 'QWEN_VISION_SOURCE_INVALID'
    );
    const cancelled = SourcePort.createStrictQuestionPageRecognizer(makePorts({
        requestText: async () => {
            const error = new Error('cancelled');
            error.name = 'AbortError';
            error.code = 'OCR_REQUEST_CANCELLED';
            throw error;
        }
    }));
    await assert.rejects(
        cancelled({ file: { id: 'pdf-1' }, imageUrl: 'data:image/png;base64,x' }),
        error => error.name === 'AbortError' &&
            error.code === 'OCR_REQUEST_CANCELLED'
    );
});

test('document OCR source owns task selection and markdown fallback', async () => {
    const ocrCalls = [];
    const warnings = [];
    const source = SourcePort.createDocumentOcrSource({
        ocrText: async options => {
            ocrCalls.push(options.ocrTask);
            if (options.ocrTask === 'document_parsing') {
                throw Object.assign(new Error('unavailable'), {
                    code: 'FIXTURE_UNAVAILABLE'
                });
            }
            return { text: 'advanced recognition text' };
        },
        chatText: async () => {
            throw Object.assign(new Error('unavailable'), {
                code: 'FIXTURE_UNAVAILABLE'
            });
        },
        cleanText: value => String(value || '').trim(),
        isFatalError: () => false,
        warn: code => warnings.push(code)
    });

    assert.equal(
        await source.recognizeDocumentText('data:image/png;base64,x'),
        'advanced recognition text'
    );
    assert.deepEqual(ocrCalls, [
        'document_parsing',
        'advanced_recognition'
    ]);
    ocrCalls.length = 0;
    assert.equal(
        await source.recognizePageMarkdown('data:image/png;base64,x'),
        ''
    );
    assert.deepEqual(ocrCalls, ['document_parsing']);
    assert.deepEqual(warnings, [
        'QWEN_DOCUMENT_OCR_TASK_FAILED',
        'QWEN_MARKDOWN_OCR_PRIMARY_FAILED',
        'QWEN_MARKDOWN_OCR_FALLBACK_FAILED'
    ]);
});

test('document OCR source preserves cancellation and owns manual OCR prompt', async () => {
    let manualRequest = null;
    const cancelled = Object.assign(new Error('cancelled'), {
        name: 'AbortError',
        code: 'OCR_REQUEST_CANCELLED'
    });
    let ocrCalls = 0;
    const source = SourcePort.createDocumentOcrSource({
        ocrText: async () => {
            ocrCalls += 1;
            throw cancelled;
        },
        chatText: async options => {
            manualRequest = options;
            return { text: 'recognized question' };
        },
        cleanText: value => String(value || ''),
        isFatalError: () => false
    });

    await assert.rejects(
        source.recognizeDocumentText('data:image/png;base64,x'),
        error => error === cancelled
    );
    assert.equal(ocrCalls, 1);
    assert.equal(
        await source.recognizeManualQuestion('data:image/png;base64,x'),
        'recognized question'
    );
    assert.equal(manualRequest.task, 'structured-ocr');
    assert.match(manualRequest.prompt, /数学题/);
});
