const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Projection = require('../qisi-pdf-candidate-projection.js');
const makeContext = (text, selectedSourceKind = 'ocrMarkdown') =>
    Projection.createProductionProjectionContextBuilder()({
        batchId: 'ocr-projection-fixture',
        sources: [{ id: 'full-pdf', fileType: 'pdf', roles: ['full'], sourceOrder: 1 }],
        engineResult: {
            drafts: [1, 2].map(q => ({
                id: 'draft-' + q, questionNumber: String(q), type: 'choice',
                sourceFileId: 'full-pdf', sourcePage: 1, stem: '选择一个值。',
                options: ['A', 'B', 'C', 'D'].map((label, i) => ({ label, text: '$' + (i + 1) + '$' })),
                images: []
            })),
            evidences: [{
                id: 'support-page-2', sourceFileId: 'full-pdf', pageNo: 2,
                selectedSourceKind, [selectedSourceKind]: text
            }]
        }
    });

test('production OCR projection attaches numbered answers through unchanged sequence and write owners', () => {
    const context = makeContext('1. A\n【解析】第一题推导。\n2. C\n【解析】第二题推导。');
    const drafts = Projection.projectPdfCandidates(context);
    assert.deepEqual(drafts.map(draft => draft.answer), ['A', 'C']);
    assert.deepEqual(drafts.map(draft => draft.solution), ['第一题推导。', '第二题推导。']);
    assert.equal(context.alignmentResults[0].mode, 'full');
    assert.equal(drafts.every(draft => draft.fieldProvenance.answer.kind === 'controlled-write'), true);
});

test('production OCR table conflict cannot enter drafts as accepted answers or solutions', () => {
    const context = makeContext('| 题号 | 1 | 2 |\n| --- | --- | --- |\n| 答案 | A | C |\n' +
        '1. D\n【解析】冲突内容。\n2. C\n【解析】后续内容。');
    const drafts = Projection.projectPdfCandidates(context);
    assert.equal(context.alignmentResults[0].mode, 'fail-closed');
    assert.equal(drafts.some(draft => draft.answer || draft.solution), false);
});

test('text-layer support keeps its existing parser ownership and behavior', () => {
    const drafts = Projection.projectPdfCandidates(makeContext(
        '第1题\n答案：A\n解析：第一题推导。\n第2题\n答案：C\n解析：第二题推导。',
        'textLayer'
    ));
    assert.deepEqual(drafts.map(draft => draft.answer), ['A', 'C']);
});

test('browser export and script dependency precede production projection', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'qisi-pdf-ocr-support-parser.js'), 'utf8');
    const context = vm.createContext({});
    vm.runInContext(source, context);
    assert.equal(typeof context.Qisi.PdfOcrSupportParser.parsePdfSupportBlocks, 'function');
    const main = fs.readFileSync(path.join(__dirname, '..', 'main.html'), 'utf8');
    assert.ok(main.indexOf('qisi-pdf-ocr-support-parser.js') < main.indexOf('qisi-pdf-candidate-projection.js'));
});
