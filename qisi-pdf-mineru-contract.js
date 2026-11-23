(function(root, factory) {
    const api = factory(root);
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    root.Qisi = root.Qisi || {}; root.Qisi.PdfMineruContract = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(root) {
    'use strict';
    const records = root.Qisi?.PdfReviewRecords || require('./qisi-pdf-review-records');
    const record = records.createRecordContract('pdf-mineru-v1', 'pdfReview');
    function validateCanonical(drafts, batchId, identity) {
        record.validateCanonical(drafts, batchId, identity);
        for (const draft of drafts) {
            if (!/^[a-f0-9]{64}$/.test(draft.pdfReview.sourceSha256 || '') ||
                !Array.isArray(draft.pdfReview.rawSources) ||
                !draft.pdfReview.rawSources.some(s => s.sourceId === draft.source.sourceId && s.sha256 === draft.pdfReview.sourceSha256) ||
                draft.images.some(image => draft.fieldProvenance.images?.status !== 'manual' && (!image.assetPath || !/^[a-f0-9]{64}$/.test(image.sourceSha256 || '') ||
                    !draft.pdfReview.rawSources.some(s => s.sourceId === image.sourceFileId && s.sha256 === image.sourceSha256)))) {
                throw Object.assign(new Error('PDF_MINERU_SOURCE_IDENTITY_INVALID'), { code: 'PDF_MINERU_SOURCE_IDENTITY_INVALID' });
            }
        }
        return drafts;
    }
    return Object.freeze({ ...record, validateCanonical });
});
