const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Port = require('../qisi-production-docx-vision-source-port.js');
const ROOT = path.resolve(__dirname, '..');

const source = () => ({
    id: 'support-docx-1', filename: 'support.docx', fileType: 'docx'
});
const ports = overrides => ({
    convertDocxToPdf: async file => ({
        id: `${file.id}-pdf`, filename: 'support.pdf', fileType: 'pdf'
    }),
    renderPdfPages: async () => [{ pageNo: 1, url: 'page-1' }],
    renderOptions: { scale: 2.2, jpegQuality: 0.9, sequential: true },
    recognizePreparedSupport: async () => ({
        answers: [{ question: '1', answer: 'A', sourcePage: 1 }],
        solutions: [{ question: '1', solution: 'because', sourcePage: 1 }],
        failedPages: []
    }),
    mathSignalCount: value => String(value || '').length,
    now: () => 100,
    ...overrides
});

test('DOCX support producer preserves conversion, strict recognition, and source trace', async () => {
    const renderCalls = [];
    const recognitionCalls = [];
    const producer = Port.createSupportSourceProducer(ports({
        renderPdfPages: async (...args) => {
            renderCalls.push(args);
            return [{ pageNo: 1, url: 'page-1' }];
        },
        recognizePreparedSupport: async input => {
            recognitionCalls.push(input);
            return {
                answers: [{ question: '1', answer: 'A', sourcePage: 1 }],
                solutions: [{ question: '1', solution: 'because', sourcePage: 1 }],
                failedPages: []
            };
        }
    }));
    const file = source();
    const progress = () => {};
    const result = await producer({
        file,
        expectedQuestionNumbers: ['1'],
        requiredKinds: { answers: true, solutions: true },
        onPageProgress: progress
    });

    assert.equal(renderCalls.length, 1);
    assert.equal(renderCalls[0][0].fileType, 'pdf');
    assert.deepEqual(renderCalls[0][1], {
        scale: 2.2, jpegQuality: 0.9, sequential: true
    });
    assert.equal(recognitionCalls.length, 1);
    assert.equal(recognitionCalls[0].file, file);
    assert.equal(recognitionCalls[0].strict, true);
    assert.deepEqual(recognitionCalls[0].expectedQuestionNumbers, ['1']);
    assert.deepEqual(recognitionCalls[0].requiredKinds, {
        answers: true, solutions: true
    });
    assert.equal(recognitionCalls[0].onPageProgress, progress);
    assert.equal(result.renderedPageCount, 1);
    assert.equal(result.pdfRecord.filename, 'support.pdf');
    assert.equal(result.answers[0].sourceFileId, 'support-docx-1');
    assert.equal(
        result.answers[0].sourceTrace.source,
        'docx-converted-pdf-visual-support'
    );
    assert.equal(result.answers[0].sourceTrace.convertedPdfFileName, 'support.pdf');
    assert.equal(result.solutions[0].sourceFileName, 'support.docx');
});

test('DOCX support producer preserves answer-only and solution-only evidence', async t => {
    for (const fixture of [
        {
            name: 'answer-only',
            requiredKinds: { answers: true, solutions: false },
            answers: [{ question: '1', answer: 'A', sourcePage: 1 }],
            solutions: []
        },
        {
            name: 'solution-only',
            requiredKinds: { answers: false, solutions: true },
            answers: [],
            solutions: [{ question: '1', solution: 'because', sourcePage: 1 }]
        }
    ]) {
        await t.test(fixture.name, async () => {
            const calls = [];
            const producer = Port.createSupportSourceProducer(ports({
                recognizePreparedSupport: async input => {
                    calls.push(input);
                    return {
                        answers: fixture.answers,
                        solutions: fixture.solutions,
                        failedPages: []
                    };
                }
            }));
            const result = await producer({
                file: source(),
                expectedQuestionNumbers: ['1'],
                requiredKinds: fixture.requiredKinds
            });
            assert.deepEqual(calls[0].requiredKinds, fixture.requiredKinds);
            assert.equal(result.answers.length, fixture.answers.length);
            assert.equal(result.solutions.length, fixture.solutions.length);
        });
    }
});

test('DOCX support producer rejects invalid input and empty visual evidence', async () => {
    const producer = Port.createSupportSourceProducer(ports());
    await assert.rejects(
        producer({ file: { fileType: 'pdf' } }),
        error => error.code === 'INVALID_DOCX_SUPPORT_INPUT'
    );

    const empty = Port.createSupportSourceProducer(ports({
        recognizePreparedSupport: async () => ({
            answers: [], solutions: [], failedPages: []
        })
    }));
    await assert.rejects(
        empty({ file: source() }),
        error =>
            error.code === 'DOCX_SUPPORT_VISUAL_EMPTY' &&
            error.stage === 'docx-support-vision'
    );
});

test('DOCX support producer rejects failed coverage without text-layer fallback', async () => {
    const producer = Port.createSupportSourceProducer(ports({
        recognizePreparedSupport: async () => ({
            answers: [{ question: '1', answer: 'A' }],
            solutions: [],
            coverage: { ok: false, missing: ['2'] }
        })
    }));
    await assert.rejects(
        producer({ file: source() }),
        error =>
            error.code === 'DOCX_SUPPORT_COVERAGE_FAILED' &&
            error.coverage.missing[0] === '2'
    );
});

test('DOCX support producer fails closed on malformed or conflicting evidence', async t => {
    await t.test('malformed result', async () => {
        const producer = Port.createSupportSourceProducer(ports({
            recognizePreparedSupport: async () => ({ answers: {}, solutions: [] })
        }));
        await assert.rejects(
            producer({ file: source() }),
            error =>
                error.code === 'DOCX_SUPPORT_RESULT_MALFORMED' &&
                error.stage === 'docx-support-vision'
        );
    });

    await t.test('recognizer conflict', async () => {
        const producer = Port.createSupportSourceProducer(ports({
            recognizePreparedSupport: async () => {
                const error = new Error('conflicting answer evidence');
                error.code = 'DOCX_SUPPORT_CONFLICT';
                error.stage = 'docx-support-vision';
                throw error;
            }
        }));
        await assert.rejects(
            producer({ file: source() }),
            error =>
                error.code === 'DOCX_SUPPORT_CONFLICT' &&
                error.stage === 'docx-support-vision' &&
                error.pdfRecord?.filename === 'support.pdf'
        );
    });
});

test('DOCX support producer discards a late result after cancellation', async () => {
    const controller = new AbortController();
    const producer = Port.createSupportSourceProducer(ports({
        recognizePreparedSupport: async input => {
            assert.equal(input.signal, controller.signal);
            controller.abort();
            return {
                answers: [{ question: '1', answer: 'late' }],
                solutions: []
            };
        }
    }));
    await assert.rejects(
        producer({ file: source(), signal: controller.signal }),
        error =>
            error.name === 'AbortError' &&
            error.code === 'DOCX_VISION_SHADOW_CANCELLED'
    );
});

test('DOCX support producer requires every production port', () => {
    assert.throws(
        () => Port.createSupportSourceProducer({}),
        error => error.code === 'DOCX_SUPPORT_PRODUCER_PORT_REQUIRED'
    );
});

test('app shell assembles the DOCX support producer without retaining its algorithm', () => {
    const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    assert.match(
        app,
        /ProductionDocxVisionSourcePort\s*\.createSupportSourceProducer\s*\(/
    );
    assert.doesNotMatch(
        app,
        /const\s+processStandaloneDocxSupportByVision\s*=/
    );
    assert.match(
        app,
        /requiredKinds:\s*input\.requiredKinds,\s*signal:\s*input\.signal/
    );
});
