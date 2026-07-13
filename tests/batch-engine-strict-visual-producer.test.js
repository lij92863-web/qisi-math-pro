const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const enginePath = require.resolve('../qisi-batch-engine-v2.js');

function loadEngine() {
    delete require.cache[enginePath];
    global.window = {};
    require(enginePath);
    return global.window.QisiBatchEngineV2;
}

test.afterEach(() => {
    delete require.cache[enginePath];
    delete global.window;
});

test('strict visual producer preserves PDF/image preparation and rejects unsupported sources', async () => {
    const engine = loadEngine();
    const renderCalls = [];
    const producer = engine.createStrictVisualQuestionProducer({
        renderPdfFilePages: async (file, options) => {
            renderCalls.push({ file, options });
            return [{ pageNo: 1, url: 'data:image/jpeg;base64,page' }];
        },
        recognizePreparedPages: async () => ({ questions: [] }),
        getRoles: source => source.roles || [],
        logDiagnostic: () => {},
        now: () => 10
    });

    const pdf = { id: 'pdf-1', filename: 'paper.pdf', fileType: 'pdf' };
    assert.deepEqual(await producer.preparePages(pdf), [
        { pageNo: 1, url: 'data:image/jpeg;base64,page' }
    ]);
    assert.deepEqual(renderCalls, [{
        file: pdf,
        options: { scale: 2.2, jpegQuality: 0.9, sequential: true }
    }]);
    assert.deepEqual(
        await producer.preparePages({ fileType: 'image', uploadPath: 'data:image/png;base64,x' }),
        [{ pageNo: 1, url: 'data:image/png;base64,x', width: 0, height: 0 }]
    );
    await assert.rejects(
        producer.preparePages({ fileType: 'docx' }),
        /整页视觉识别不支持文件类型：docx/
    );
});

test('strict visual producer preserves file-level payload, timing, and diagnostics', async () => {
    const engine = loadEngine();
    const diagnostics = [];
    const recognitionCalls = [];
    const clock = [100, 145];
    const source = {
        id: 'pdf-1', filename: 'paper.pdf', fileType: 'pdf', roles: ['question']
    };
    const expectedResult = {
        questions: [{ questionNumber: '1' }],
        pageImages: [{ pageNo: 1 }],
        check: { fatal: false, reasons: ['manual-review'] }
    };
    const producer = engine.createStrictVisualQuestionProducer({
        renderPdfFilePages: async () => [{ pageNo: 1, url: 'page-1' }],
        recognizePreparedPages: async payload => {
            recognitionCalls.push(payload);
            return expectedResult;
        },
        getRoles: file => file.roles || [],
        logDiagnostic: (...args) => diagnostics.push(args),
        now: () => clock.shift()
    });

    const progress = () => {};
    const result = await producer.processQuestionFile({
        file: source,
        batch: { id: 'batch-1' },
        expectedQuestionCount: 1,
        onPageProgress: progress
    });

    assert.equal(result, expectedResult);
    assert.deepEqual(recognitionCalls, [{
        file: source,
        batch: { id: 'batch-1' },
        pages: [{ pageNo: 1, url: 'page-1' }],
        expectedQuestionCount: 1,
        onPageProgress: progress,
        renderDurationMs: 45
    }]);
    assert.equal(diagnostics.length, 2);
    assert.equal(diagnostics[0][0], 'strict-visual-file-start');
    assert.equal(diagnostics[1][0], 'strict-visual-file-result');
    assert.deepEqual(diagnostics[0][1].roles, ['question']);
    assert.equal(diagnostics[1][1].questionCount, 1);
    assert.equal(diagnostics[1][1].pageImageCount, 1);
});

test('strict visual producer keeps failures fail-closed and diagnostics retain identity', async () => {
    const engine = loadEngine();
    const diagnostics = [];
    const stable = Object.assign(new Error('render failed'), {
        code: 'PDF_RENDER_FAILED', stage: 'render'
    });
    const producer = engine.createStrictVisualQuestionProducer({
        renderPdfFilePages: async () => { throw stable; },
        recognizePreparedPages: async () => assert.fail('recognition must not run'),
        getRoles: () => [],
        logDiagnostic: (...args) => diagnostics.push(args),
        now: () => 1
    });

    await assert.rejects(
        producer.processQuestionFile({
            file: { filename: 'bad.pdf', fileType: 'pdf' },
            batch: { id: 'batch-1' }
        }),
        error => error === stable
    );
    assert.equal(diagnostics.at(-1)[0], 'strict-visual-file-result');
    assert.equal(diagnostics.at(-1)[1].code, 'PDF_RENDER_FAILED');
    assert.equal(diagnostics.at(-1)[1].stage, 'render');
    assert.equal(diagnostics.at(-1)[2], 'error');
});

test('strict visual producer propagates cancellation and never recognizes after an aborted render', async () => {
    const engine = loadEngine();
    const controller = new AbortController();
    const renderCalls = [];
    let recognitionCalls = 0;
    const producer = engine.createStrictVisualQuestionProducer({
        renderPdfFilePages: async (_file, options) => {
            renderCalls.push(options);
            controller.abort();
            return [{ pageNo: 1, url: 'page-1' }];
        },
        recognizePreparedPages: async () => {
            recognitionCalls += 1;
            return { questions: [] };
        },
        getRoles: () => ['question'],
        logDiagnostic: () => {},
        now: () => 1
    });

    await assert.rejects(
        producer.processQuestionFile({
            file: { filename: 'cancelled.pdf', fileType: 'pdf' },
            batch: { id: 'batch-1' },
            signal: controller.signal
        }),
        error => (
            error.name === 'AbortError' &&
            error.code === 'OCR_REQUEST_CANCELLED'
        )
    );
    assert.equal(renderCalls[0].signal, controller.signal);
    assert.equal(recognitionCalls, 0);
});

test('strict visual producer forwards the active signal to prepared-page recognition', async () => {
    const engine = loadEngine();
    const controller = new AbortController();
    let receivedSignal = null;
    const producer = engine.createStrictVisualQuestionProducer({
        renderPdfFilePages: async () => [{ pageNo: 1, url: 'page-1' }],
        recognizePreparedPages: async payload => {
            receivedSignal = payload.signal;
            return { questions: [], pageImages: [], check: { fatal: false } };
        },
        getRoles: () => ['question'],
        logDiagnostic: () => {},
        now: () => 1
    });

    await producer.processQuestionFile({
        file: { filename: 'active.pdf', fileType: 'pdf' },
        batch: { id: 'batch-1' },
        signal: controller.signal
    });
    assert.equal(receivedSignal, controller.signal);
});

test('strict visual producer requires its production ports', () => {
    const engine = loadEngine();
    assert.throws(
        () => engine.createStrictVisualQuestionProducer({}),
        error => error.code === 'STRICT_VISUAL_PRODUCER_PORT_REQUIRED'
    );
});

test('app shell assembles the engine owner without an inline strict visual file owner', () => {
    const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    assert.match(app, /QisiBatchEngineV2\s*\.createStrictVisualQuestionProducer\s*\(/);
    assert.doesNotMatch(app, /const\s+prepareStrictVisualPages\s*=/);
    assert.doesNotMatch(app, /const\s+processStrictVisualQuestionFile\s*=/);
});
