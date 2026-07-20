const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeDocxPipelineResult } = require('../qisi-docx-pipeline.js');
const { normalizePdfPipelineResult } = require('../qisi-pdf-safe-partial-pipeline.js');
const { summarizeDraftStatus } = require('../qisi-review-draft-state.js');
const { classifyFileType, buildDispatchPlan } = require('../qisi-file-dispatcher.js');
const BatchFinalGate = require('../qisi-batch-final-gate.js');

const finalGatePolicy = {
    cleanRecognizedText: value => String(value || '').trim(),
    cleanDisplayOptionsForBatchSave: values => Array.isArray(values) ? values.slice(0, 4) : [],
    normalizeQuestionKey: value => String(Number(String(value || '').match(/\d+/)?.[0] || 0) || ''),
    mergeImageListsById: (...lists) => {
        const rows = new Map();
        for (const image of lists.flat()) {
            if (image?.id && !rows.has(image.id)) rows.set(image.id, image);
        }
        return [...rows.values()];
    }
};

test('live production boundary modules load and expose callable contracts', () => {
    assert.ok(normalizeDocxPipelineResult([], [], []));
    assert.ok(normalizePdfPipelineResult({ answerQuestionNumbers: ['1'], warnings: [] }));
    assert.ok(summarizeDraftStatus([]));
    assert.equal(classifyFileType('a.docx'), 'docx');
    assert.ok(buildDispatchPlan([{ name: 'q.docx' }]));
    assert.equal(typeof BatchFinalGate.scoreCandidate, 'function');
});

test('DOCX and PDF boundary facades retain their safety contracts', () => {
    const docx = normalizeDocxPipelineResult(
        [{ q: '1' }],
        [{ q: '1', a: 'A' }],
        [{ q: '1', s: 'S' }]
    );
    const pdf = normalizePdfPipelineResult({
        answerQuestionNumbers: ['1', '3'],
        warnings: [{ questionNumber: '2' }]
    });

    assert.equal(docx.mode, 'full');
    assert.equal(pdf.isSafePartial, true);
    assert.equal(pdf.isComplete, false);
});

test('batch final-gate wiring ranks a complete candidate above an empty shell', () => {
    const complete = {
        questionNumber: '1',
        stem: '下列结论正确的是',
        options: ['A. 甲', 'B. 乙', 'C. 丙', 'D. 丁']
    };
    const shell = { questionNumber: '1', stem: '题目', options: [] };

    const ranked = BatchFinalGate.rankCandidates([shell, complete], finalGatePolicy);
    assert.equal(ranked[0], complete);
});
