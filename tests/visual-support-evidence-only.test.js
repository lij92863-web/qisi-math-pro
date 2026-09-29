const test = require('node:test');
const assert = require('node:assert/strict');

globalThis.Qisi = globalThis.Qisi || {};
globalThis.Qisi.Utils = {
    cleanRecognizedText: value => String(value || '').trim(),
    isFatalQwenServiceError: () => false
};

const sourceApi = require('../qisi-visual-support-source.js');

function sourceWith(calls, recognizePageAsDocumentText) {
    return sourceApi.createVisualSupportSource({
        normalizeQuestionKey: value => String(value || ''),
        normalizeAnswerForLatex: value => String(value || ''),
        normalizeRecognizedSupportLatex: value => String(value || ''),
        extractGraphicRefs: () => [],
        extractAnswerArray: () => [],
        extractSolutionArray: () => [],
        cleanRecognizedText: value => String(value || '').trim(),
        buildSupportLeadingMissingBlockEvidence: () => ({}),
        parseAnswerAndSolutionItemsFromText: () => {
            calls.push('legacy-parser');
            throw new Error('duplicate parser must not run');
        },
        recognizePageAsDocumentText,
        attachPdfPageTrace: rows => rows,
        getBatchFileRoles: () => ['answer'],
        logBatchPdfDiag: () => {},
        qwenTaskClient: {
            chatJson: async () => {
                calls.push('structured-ai');
                throw new Error('redundant structure must not run');
            }
        }
    });
}

test('PDF evidence-only mode retains raw page traces without a redundant structure pass', async () => {
    const calls = [];
    const source = sourceWith(calls, async () => '12.【答案】$-1$');
    const result = await source.recognizeVisualSupportFromPreparedPages({
        file: { id: 'answer', filename: 'answer.pdf' },
        pages: [{ pageNo: 9, imageUrl: 'page-nine' }],
        strict: true,
        evidenceOnly: true,
        expectedQuestionNumbers: ['12'],
        requiredKinds: { answers: true, solutions: true }
    });
    assert.deepEqual(calls, []);
    assert.deepEqual(result.rawEvidencePages, [
        { pageNo: 9, rawText: '12.【答案】$-1$' }
    ]);
    assert.deepEqual(result.answers, []);
    assert.deepEqual(result.solutions, []);
});

test('PDF evidence-only mode still fails closed when a support page has no OCR evidence', async () => {
    const calls = [];
    const source = sourceWith(calls, async () => '');
    await assert.rejects(
        source.recognizeVisualSupportFromPreparedPages({
            file: { id: 'answer', filename: 'answer.pdf' },
            pages: [{ pageNo: 9, imageUrl: 'page-nine' }],
            strict: true,
            evidenceOnly: true
        }),
        error => error.code === 'SUPPORT_PAGE_EVIDENCE_INCOMPLETE'
    );
    assert.deepEqual(calls, []);
});
