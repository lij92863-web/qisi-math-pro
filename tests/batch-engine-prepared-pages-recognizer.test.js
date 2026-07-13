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

function ports(overrides = {}) {
    return {
        mapWithConcurrency: async (items, _limit, worker) =>
            Promise.all(items.map(worker)),
        recognizePage: async ({ pageNo }) => [{
            questionNumber: String(pageNo),
            type: '解答题',
            stem: `stem-${pageNo}`,
            options: [],
            confidence: 0.9
        }],
        collectValidFigures: item => item.recognizedImages || [],
        hasFigureCue: () => false,
        locateQuestionFigures: async () => [],
        normalizeFigure: value => value,
        isLikelyRealFigure: () => true,
        mergeQuestionItems: items => items,
        validateQuestionItems: items => ({
            fatal: false,
            fatalReasons: [],
            warningReasons: [],
            reasons: [],
            rows: [],
            failedQuestions: [],
            itemCount: items.length
        }),
        isStrictChoiceType: () => false,
        repairChoiceAndSolutionDetails: async () => [],
        buildQuestionNumberGapWarning: () => '',
        normalizeFourOptions: value => Array.isArray(value) ? value : [],
        isBadChoiceOption: () => false,
        cleanRecognizedText: value => String(value || '').trim(),
        isFatalServiceError: () => false,
        now: () => 100,
        ...overrides
    };
}

test.afterEach(() => {
    delete require.cache[enginePath];
    delete global.window;
});

test('prepared-page recognizer preserves trace, progress, validation, and result shape', async () => {
    const engine = loadEngine();
    const progress = [];
    const recognizer = engine.createStrictVisualPreparedPagesRecognizer(ports());
    const file = { id: 'pdf-1', filename: 'paper.pdf', fileType: 'pdf' };
    const result = await recognizer({
        file,
        batch: { id: 'batch-1' },
        pages: [{ pageNo: 1, url: 'page-1' }],
        expectedQuestionCount: 1,
        renderDurationMs: 45,
        onPageProgress: (...args) => progress.push(args)
    });

    assert.equal(result.questions.length, 1);
    assert.equal(result.questions[0].sourcePage, 1);
    assert.equal(result.questions[0].pageIndex, 1);
    assert.equal(result.questions[0].sourcePageImage, 'page-1');
    assert.deepEqual(result.questions[0].sourcePages, [1]);
    assert.deepEqual(result.pageImages, [{
        sourceFileId: 'pdf-1', sourceFileName: 'paper.pdf',
        pageNo: 1, imageUrl: 'page-1'
    }]);
    assert.equal(result.check.fatal, false);
    assert.equal(result.pageRecognitionSummary.length, 1);
    assert.equal(result.pageRecognitionSummary[0].itemCount, 1);
    assert.deepEqual(progress, [
        [0, { stage: 'initial-page-recognition', pageNo: 1 }],
        [1, { stage: 'done', done: true }]
    ]);
});

test('prepared-page recognizer fails closed for missing pages and fatal validation', async () => {
    const engine = loadEngine();
    const empty = engine.createStrictVisualPreparedPagesRecognizer(ports());
    await assert.rejects(
        empty({ file: { filename: 'empty.pdf' }, pages: [] }),
        /empty\.pdf 没有生成任何页面图/
    );

    const fatal = engine.createStrictVisualPreparedPagesRecognizer(ports({
        validateQuestionItems: () => ({
            fatal: true,
            fatalReasons: ['sequence-invalid'],
            warningReasons: [],
            reasons: [],
            rows: [],
            failedQuestions: []
        })
    }));
    await assert.rejects(
        fatal({
            file: { id: 'pdf-1', filename: 'bad.pdf', fileType: 'pdf' },
            pages: [{ pageNo: 1, url: 'page-1' }]
        }),
        /整页视觉识别发生致命错误：sequence-invalid/
    );
});

test('prepared-page recognizer keeps targeted repair inside the engine owner', async () => {
    const engine = loadEngine();
    let validationCall = 0;
    const repairCalls = [];
    const recognizer = engine.createStrictVisualPreparedPagesRecognizer(ports({
        recognizePage: async () => [{
            questionNumber: '1', type: '单选题', stem: 'stem',
            options: ['A'], sourcePage: 1
        }],
        mergeQuestionItems: items => {
            const byNumber = new Map();
            items.forEach(item => byNumber.set(item.questionNumber, item));
            return [...byNumber.values()];
        },
        validateQuestionItems: () => {
            validationCall += 1;
            return {
                fatal: false,
                fatalReasons: [], warningReasons: [], reasons: [], rows: [],
                failedQuestions: validationCall === 1 ? [{
                    questionNumber: '1', type: '单选题',
                    warnings: ['有效选项不足'], failures: []
                }] : []
            };
        },
        isStrictChoiceType: value => value === '单选题',
        repairChoiceAndSolutionDetails: async (...args) => {
            repairCalls.push(args);
            return [{
                questionNumber: '1', type: '单选题', stem: 'stem',
                options: ['A', 'B', 'C', 'D']
            }];
        }
    }));
    const result = await recognizer({
        file: { id: 'pdf-1', filename: 'repair.pdf', fileType: 'pdf' },
        pages: [{ pageNo: 1, url: 'page-1' }]
    });

    assert.equal(repairCalls.length, 1);
    assert.equal(validationCall, 2);
    assert.equal(result.questions[0].options.length, 4);
});

test('prepared-page recognizer rejects late results after cancellation', async () => {
    const engine = loadEngine();
    const controller = new AbortController();
    let recognitionCalls = 0;
    let validationCalls = 0;
    const recognizer = engine.createStrictVisualPreparedPagesRecognizer(ports({
        recognizePage: async payload => {
            recognitionCalls += 1;
            assert.equal(payload.signal, controller.signal);
            controller.abort();
            return [{ questionNumber: '1', stem: 'late-result' }];
        },
        validateQuestionItems: () => {
            validationCalls += 1;
            return { fatal: false, failedQuestions: [] };
        }
    }));

    await assert.rejects(
        recognizer({
            file: { id: 'pdf-1', filename: 'cancel.pdf', fileType: 'pdf' },
            pages: [{ pageNo: 1, url: 'page-1' }],
            signal: controller.signal
        }),
        error => (
            error.name === 'AbortError' &&
            error.code === 'OCR_REQUEST_CANCELLED'
        )
    );
    assert.equal(recognitionCalls, 1);
    assert.equal(validationCalls, 0);
});

test('prepared-page recognizer stops before transport for a pre-aborted signal', async () => {
    const engine = loadEngine();
    const controller = new AbortController();
    controller.abort();
    let recognitionCalls = 0;
    const recognizer = engine.createStrictVisualPreparedPagesRecognizer(ports({
        recognizePage: async () => {
            recognitionCalls += 1;
            return [];
        }
    }));

    await assert.rejects(
        recognizer({
            file: { id: 'pdf-1', filename: 'cancel.pdf', fileType: 'pdf' },
            pages: [{ pageNo: 1, url: 'page-1' }],
            signal: controller.signal
        }),
        error => error.code === 'OCR_REQUEST_CANCELLED'
    );
    assert.equal(recognitionCalls, 0);
});

test('prepared-page recognizer requires every policy and producer port', () => {
    const engine = loadEngine();
    assert.throws(
        () => engine.createStrictVisualPreparedPagesRecognizer({}),
        error => error.code === 'STRICT_VISUAL_RECOGNIZER_PORT_REQUIRED'
    );
});

test('app shell injects the prepared-page recognizer without retaining its algorithm', () => {
    const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    assert.match(app, /QisiBatchEngineV2\s*\.createStrictVisualPreparedPagesRecognizer\s*\(/);
    assert.doesNotMatch(app, /const\s+recognizeStrictQuestionsFromPreparedPages\s*=/);
});
