const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Port = require('../qisi-production-docx-vision-source-port.js');
const ROOT = path.resolve(__dirname, '..');

const file = () => ({
    id: 'docx-1', filename: 'paper.docx', fileType: 'docx', roles: ['question']
});
const skeleton = overrides => ({
    authoritative: true,
    questionNumbers: ['1'],
    entries: [{ questionNumber: '1' }],
    diagnostics: { reason: 'complete', entryCount: 1 },
    ...overrides
});
const question = () => ({
    questionNumber: '1', type: '解答题', stem: 'stem', options: [],
    sourcePage: 1, sourcePageImage: 'page-1'
});
const validation = () => ({
    fatal: false, fatalReasons: [], warningReasons: [], reasons: [],
    rows: [], failedQuestions: []
});
const ports = overrides => ({
    getImporter: () => ({
        extractDocxQuestionSkeleton: async () => skeleton()
    }),
    convertDocxToPdf: async source => ({
        id: `${source.id}-pdf`, filename: 'paper.pdf', fileType: 'pdf',
        convertedFromDocx: true
    }),
    processStrictQuestionFile: async () => ({
        questions: [question()],
        pageImages: [{ pageNo: 1, imageUrl: 'page-1' }],
        pageRecognitionSummary: [{ pageNo: 1, itemCount: 1 }],
        check: validation()
    }),
    reconcileQuestions: (items, sourceSkeleton) => ({
        applied: sourceSkeleton.authoritative,
        questions: items,
        questionNumbers: sourceSkeleton.questionNumbers,
        missingQuestionNumbers: [],
        rejectedCandidates: []
    }),
    validateQuestionItems: validation,
    now: () => 100,
    ...overrides
});

test('DOCX question producer preserves skeleton, visual call, and DOCX source trace', async () => {
    const calls = [];
    const convertCalls = [];
    const reconcileCalls = [];
    const producer = Port.createQuestionSourceProducer(ports({
        convertDocxToPdf: async (source, options) => {
            convertCalls.push({ source, options });
            return {
                id: `${source.id}-pdf`, filename: 'paper.pdf', fileType: 'pdf',
                convertedFromDocx: true
            };
        },
        processStrictQuestionFile: async input => {
            calls.push(input);
            return {
                questions: [question()],
                pageImages: [{ pageNo: 1, imageUrl: 'page-1' }],
                check: validation()
            };
        },
        reconcileQuestions: (items, sourceSkeleton, options) => {
            reconcileCalls.push({ items, sourceSkeleton, options });
            return {
                applied: sourceSkeleton.authoritative,
                questions: items,
                questionNumbers: sourceSkeleton.questionNumbers,
                missingQuestionNumbers: [],
                rejectedCandidates: []
            };
        }
    }));
    const source = file();
    const progress = () => {};
    const controller = new AbortController();
    const result = await producer({
        file: source,
        batch: { id: 'batch-1' },
        expectedQuestionCount: 3,
        onPageProgress: progress,
        signal: controller.signal
    });

    assert.equal(convertCalls[0].options.signal, controller.signal);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].file.fileType, 'pdf');
    assert.equal(calls[0].expectedQuestionCount, 1);
    assert.equal(calls[0].onPageProgress, progress);
    assert.equal(calls[0].signal, controller.signal);
    assert.equal(reconcileCalls[0].options.signal, controller.signal);
    assert.equal(result.questions.length, 1);
    assert.equal(result.questions[0].sourceFileId, 'docx-1');
    assert.equal(result.questions[0].sourceDocxFileId, 'docx-1');
    assert.equal(
        result.questions[0].sourceTrace.source,
        'docx-local-convert-pdf-strict-vision'
    );
    assert.equal(result.questions[0].sourceTrace.sourcePageImage, 'page-1');
    assert.equal(result.pageImages[0].sourceFileId, 'docx-1');
    assert.equal(result.pageImages[0].convertedPdfFileName, 'paper.pdf');
    assert.equal(result.questionSkeleton.authoritative, true);
});

test('DOCX question producer rejects conflicting skeleton evidence before conversion', async () => {
    let converted = false;
    const producer = Port.createQuestionSourceProducer(ports({
        getImporter: () => ({
            extractDocxQuestionSkeleton: async () => skeleton({
                authoritative: false,
                questionNumbers: [],
                diagnostics: { reason: 'duplicate-number', entryCount: 2 }
            })
        }),
        convertDocxToPdf: async () => { converted = true; }
    }));
    await assert.rejects(
        producer({ file: file(), batch: { id: 'batch-1' } }),
        error => error.code === 'DOCX_QUESTION_SKELETON_INCOMPLETE'
    );
    assert.equal(converted, false);
});

test('DOCX question producer failure snapshot remains diagnosable and fail-closed', async () => {
    const producer = Port.createQuestionSourceProducer(ports({
        reconcileQuestions: items => ({
            applied: true,
            questions: [],
            questionNumbers: ['1'],
            missingQuestionNumbers: ['1'],
            rejectedCandidates: [{ reason: 'outside-skeleton', candidate: items[0] }]
        })
    }));
    await assert.rejects(
        producer({ file: file(), batch: { id: 'batch-1' } }),
        error => {
            assert.equal(error.code, 'DOCX_QUESTION_SKELETON_MISMATCH');
            assert.deepEqual(error.failureSnapshot.skeletonQuestionNumbers, ['1']);
            assert.deepEqual(error.failureSnapshot.rawVisualQuestionNumbers, ['1']);
            assert.deepEqual(error.failureSnapshot.resultQuestionNumbers, []);
            assert.equal(error.failureSnapshot.rejectedCandidates.length, 1);
            return true;
        }
    );
});

test('DOCX question producer requires every production port', () => {
    assert.throws(
        () => Port.createQuestionSourceProducer({}),
        error => error.code === 'DOCX_QUESTION_PRODUCER_PORT_REQUIRED'
    );
});

test('app shell assembles the DOCX question producer without retaining its algorithm', () => {
    const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    assert.match(
        app,
        /ProductionDocxVisionSourcePort\s*\.createQuestionSourceProducer\s*\(/
    );
    assert.doesNotMatch(app, /const\s+buildDocxQuestionFailureSnapshot\s*=/);
    assert.doesNotMatch(
        app,
        /const\s+processDocxByLocalConvertAndStrictVision\s*=/
    );
});
