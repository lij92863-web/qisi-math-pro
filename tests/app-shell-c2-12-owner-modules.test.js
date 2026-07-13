const test = require('node:test');
const assert = require('node:assert/strict');

globalThis.Qisi = globalThis.Qisi || {};
globalThis.Qisi.Utils = {
    cleanRecognizedText: value => String(value || '').trim(),
    cleanDisplayOptionsForBatchSave: options =>
        (Array.isArray(options) ? options : []).map(value =>
            String(value || '').trim()
        ),
    hasUnconvertedImagePlaceholder: value => /待转换/.test(String(value || '')),
    itemHasUnconvertedImagePlaceholder: item =>
        [item?.stem, ...(item?.options || []), item?.answer, item?.solution]
            .some(value => /待转换/.test(String(value || ''))),
    expandPageRange: (_range, total) =>
        Array.from({ length: total }, (_value, index) => index + 1),
    normalizeFigureBbox: bbox =>
        Array.isArray(bbox) && bbox.length === 4
            ? bbox.map(Number)
            : [],
    bboxIntersectionArea: (left, right) => {
        const width = Math.max(
            0,
            Math.min(left[2], right[2]) - Math.max(left[0], right[0])
        );
        const height = Math.max(
            0,
            Math.min(left[3], right[3]) - Math.max(left[1], right[1])
        );
        return width * height;
    },
    isFatalQwenServiceError: () => false
};

const documentSourceApi = require('../qisi-browser-document-source.js');
const pdfRendererApi = require('../qisi-browser-pdf-renderer.js');
const visualSupportApi = require('../qisi-visual-support-source.js');
const strictPolicyApi = require('../qisi-strict-question-policy.js');
const visualQuestionApi = require('../qisi-visual-question-source.js');
const supportTextApi = require('../qisi-support-text-parser.js');
const supportLatexApi = require('../qisi-support-latex-policy.js');
const recognitionStructureApi = require('../qisi-recognition-structure-policy.js');
const questionContentApi = require('../qisi-question-content-policy.js');
const pageQuestionApi = require('../qisi-page-question-parser.js');
const reviewNormalizationApi = require('../qisi-review-draft-normalization-policy.js');

test('C2-12 owner factories fail closed when required ports are absent', () => {
    assert.throws(
        () => documentSourceApi.createBrowserDocumentSource({}),
        error => error.code === 'BROWSER_DOCUMENT_SOURCE_PORT_REQUIRED'
    );
    assert.throws(
        () => pdfRendererApi.createBrowserPdfRenderer({}),
        error => error.code === 'BROWSER_PDF_RENDERER_PORT_REQUIRED'
    );
    assert.throws(
        () => visualSupportApi.createVisualSupportSource({}),
        error => error.code === 'VISUAL_SUPPORT_SOURCE_PORT_REQUIRED'
    );
    assert.throws(
        () => strictPolicyApi.createStrictQuestionPolicy({}),
        error => error.code === 'STRICT_QUESTION_POLICY_PORT_REQUIRED'
    );
    for (const [factory, code] of [
        [visualQuestionApi.createVisualQuestionSource, 'VISUAL_QUESTION_SOURCE_PORT_REQUIRED'],
        [supportTextApi.createSupportTextParser, 'SUPPORT_TEXT_PARSER_PORT_REQUIRED'],
        [supportLatexApi.createSupportLatexPolicy, 'SUPPORT_LATEX_POLICY_PORT_REQUIRED'],
        [recognitionStructureApi.createRecognitionStructurePolicy, 'RECOGNITION_STRUCTURE_POLICY_PORT_REQUIRED'],
        [questionContentApi.createQuestionContentPolicy, 'QUESTION_CONTENT_POLICY_PORT_REQUIRED'],
        [pageQuestionApi.createPageQuestionParser, 'PAGE_QUESTION_PARSER_PORT_REQUIRED'],
        [reviewNormalizationApi.createReviewDraftNormalizationPolicy, 'REVIEW_DRAFT_NORMALIZATION_POLICY_PORT_REQUIRED']
    ]) {
        assert.throws(
            () => factory({}),
            error => error.code === code
        );
    }
});

test('browser document source preserves PDF text and layout extraction', async () => {
    const previousPdfjs = globalThis.pdfjsLib;
    globalThis.pdfjsLib = {
        GlobalWorkerOptions: {},
        Util: {
            transform: (_viewport, transform) => transform
        },
        getDocument: () => ({
            promise: Promise.resolve({
                numPages: 1,
                getPage: async () => ({
                    getViewport: () => ({
                        width: 100,
                        height: 200,
                        transform: [1, 0, 0, 1, 0, 0]
                    }),
                    getTextContent: async () => ({
                        items: [
                            { str: 'A', transform: [1, 0, 0, 1, 10, 100], width: 5, height: 10 },
                            { str: 'B', transform: [1, 0, 0, 1, 20, 100], width: 5, height: 10 }
                        ]
                    })
                })
            })
        })
    };

    try {
        const source = documentSourceApi.createBrowserDocumentSource({
            makeBatchId: prefix => `${prefix}-1`,
            dataUrlToBlob: async () => ({
                arrayBuffer: async () => new ArrayBuffer(8)
            }),
            resolveFormulaImageTokens: async value => value,
            blockImageToken: id => `[[IMAGE:${id}]]`,
            pdfProcessConfig: { renderScale: 2 }
        });
        const file = {
            id: 'pdf-1',
            filename: 'paper.pdf',
            fileType: 'pdf',
            uploadPath: 'data:application/pdf;base64,AA=='
        };
        assert.equal(await source.extractPdfTextWithPdfJs(file), 'A B');
        const layout = await source.extractPdfLayoutWithPdfJs(file);
        assert.equal(layout.length, 1);
        assert.equal(layout[0].lines[0].text, 'A B');
    } finally {
        globalThis.pdfjsLib = previousPdfjs;
    }
});

test('browser PDF renderer fails closed when PDF.js is unavailable', async () => {
    const previousPdfjs = globalThis.pdfjsLib;
    delete globalThis.pdfjsLib;
    try {
        const renderer = pdfRendererApi.createBrowserPdfRenderer({
            dataUrlToBlob: async () => ({ arrayBuffer: async () => new ArrayBuffer(0) }),
            getBatchFileRoles: () => ['question'],
            logBatchPdfDiag: () => {},
            batchHasQuestionRole: () => true,
            estimateVisionCalls: () => 0,
            recordRenderedPages: () => {},
            showBatchToast: () => {},
            getRecognitionMode: () => 'standard',
            pdfProcessConfig: {
                renderScale: 2,
                jpegQuality: 0.9,
                pageRenderTimeoutMs: 1000
            }
        });
        await assert.rejects(
            renderer.renderPdfFilePages({ filename: 'missing.pdf' }),
            /PDF\.js/
        );
    } finally {
        globalThis.pdfjsLib = previousPdfjs;
    }
});

test('visual support source propagates cancellation before OCR', async () => {
    const noop = () => {};
    const source = visualSupportApi.createVisualSupportSource({
        normalizeQuestionKey: value => String(value || ''),
        normalizeAnswerForLatex: value => String(value || ''),
        normalizeRecognizedSupportLatex: value => String(value || ''),
        extractGraphicRefs: () => [],
        extractAnswerArray: () => [],
        extractSolutionArray: () => [],
        cleanRecognizedText: value => String(value || '').trim(),
        buildSupportLeadingMissingBlockEvidence: () => ({}),
        parseAnswerAndSolutionItemsFromText: () => ({ answers: [], solutions: [] }),
        recognizePageAsDocumentText: async () => '',
        attachPdfPageTrace: rows => rows,
        getBatchFileRoles: () => ['answer'],
        logBatchPdfDiag: noop,
        qwenTaskClient: { chatJson: async () => ({ value: {} }) }
    });
    await assert.rejects(
        source.collectVisualSupportPageEvidence({
            file: { id: 'answer-1', filename: 'answers.pdf' },
            pages: [{ pageNo: 1, imageUrl: 'data:image/png;base64,AA==' }],
            signal: { aborted: true }
        }),
        error => error.name === 'AbortError' && error.code === 'OCR_REQUEST_CANCELLED'
    );
});

test('strict question policy rejects incomplete choices and weak figures', () => {
    const policy = strictPolicyApi.createStrictQuestionPolicy({
        cleanDisplayOptionsForBatchSave:
            globalThis.Qisi.Utils.cleanDisplayOptionsForBatchSave,
        latexErrorCountForText: () => 0
    });
    const check = policy.validateDocxVisualItems([
        {
            question: '1',
            stem: '选择正确结论',
            options: ['甲', '乙', '', '丁'],
            answer: 'A',
            solution: ''
        }
    ], 1);
    assert.equal(check.ok, false);
    assert.equal(check.rows[0].optionCount, 3);
    assert.equal(policy.isLikelyRealQuestionFigure({
        image_bbox: [100, 100, 300, 300],
        image_confidence: 0.4
    }), false);
});
