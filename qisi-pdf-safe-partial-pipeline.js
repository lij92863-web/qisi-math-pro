(function (root, factory) { const api = factory(); root.Qisi = root.Qisi || {}; root.Qisi.PdfSafePartialPipeline = api; if (typeof module !== 'undefined' && module.exports) { module.exports = api; } })(typeof globalThis !== 'undefined' ? globalThis : this, function () { 'use strict';
const normalizePdfPipelineResult = (controlledWriteResult) => ({ acceptedAnswers: (controlledWriteResult?.answerQuestionNumbers || []), rejectedAnswers: (controlledWriteResult?.warnings || []).map(w => w.questionNumber).filter(Boolean), solutionCount: (controlledWriteResult?.solutionQuestionNumbers || []).length, mode: (controlledWriteResult?.warnings || []).length === 0 && (controlledWriteResult?.answerQuestionNumbers || []).length > 0 ? 'safe-partial' : 'safe-partial', isSafePartial: true, isComplete: false, requiresManualReview: (controlledWriteResult?.warnings || []).length > 0 });
const assertSafePartialInvariants = result => { if (result.isComplete) throw new Error('safe partial pipeline must not produce complete'); return true; };

/**
 * Attach PDF page trace metadata to each recognized item.
 * Sets sourceFileId, sourceFileName, sourcePage, pageIndex,
 * sourcePageImage, rawText and a nested sourceTrace object.
 * @param {Array} items - recognized question/answer/solution items
 * @param {Object} file - file record with .id and .filename
 * @param {number} pageNo - 1-based page number
 * @param {string} imageUrl - page image URL
 * @param {string} [rawText=''] - raw page text
 * @returns {Array} items with trace metadata
 */
const attachPdfPageTrace = (items, file, pageNo, imageUrl, rawText = '') => {
    return (items || []).map(item => ({
        ...item,
        sourceFileId: item.sourceFileId || file.id,
        sourceFileName: item.sourceFileName || file.filename,
        sourcePage: item.sourcePage || pageNo,
        pageIndex: item.pageIndex ?? pageNo,
        sourcePageImage: item.sourcePageImage || imageUrl,
        rawText: item.rawText || item.rawBlock || item.stem || '',
        sourceTrace: {
            ...(item.sourceTrace || {}),
            sourceFileId: file.id,
            sourceFileName: file.filename,
            sourcePage: pageNo,
            pageIndex: pageNo,
            sourcePageImage: imageUrl,
            rawBlock: item.rawText || item.rawBlock || item.stem || '',
            pageText: rawText || ''
        }
    }));
};

/**
 * Attach PDF page trace metadata to a single recognized item.
 * Sets sourceFileId, sourceFileName, sourcePage, pageIndex,
 * sourcePageImage, pageText, sourceText and a nested sourceTrace object.
 * @param {Object} item - recognized question/answer/solution item
 * @param {Object} file - file record with .id and .filename
 * @param {number} pageNo - 1-based page number
 * @param {string} imageUrl - page image URL
 * @param {string} [pageText=''] - raw page text
 * @returns {Object} item with trace metadata
 */
const attachSinglePdfPageTrace = (item, file, pageNo, imageUrl, pageText = '') => {
    const next = { ...(item || {}) };

    next.sourceFileId = next.sourceFileId || file.id;
    next.sourceFileName = next.sourceFileName || file.filename;
    next.sourcePage = next.sourcePage || pageNo;
    next.pageIndex = next.pageIndex || pageNo;
    next.sourcePageImage = next.sourcePageImage || imageUrl;
    next.pageText = next.pageText || pageText || '';
    next.sourceText = next.sourceText || pageText || '';

    next.sourceTrace = {
        ...(next.sourceTrace || {}),
        sourceFileId: next.sourceTrace?.sourceFileId || file.id,
        sourceFileName: next.sourceTrace?.sourceFileName || file.filename,
        sourcePage: next.sourceTrace?.sourcePage || pageNo,
        pageIndex: next.sourceTrace?.pageIndex || pageNo,
        sourcePageImage: next.sourceTrace?.sourcePageImage || imageUrl,
        rawBlock: next.sourceTrace?.rawBlock || next.rawBlock || '',
        pageText: next.sourceTrace?.pageText || pageText || '',
        sourceText: next.sourceTrace?.sourceText || pageText || ''
    };

    return next;
};

return { normalizePdfPipelineResult, assertSafePartialInvariants, attachPdfPageTrace, attachSinglePdfPageTrace };
});
