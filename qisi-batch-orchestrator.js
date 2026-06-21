(function (root, factory) {
    const api = factory();
    root.Qisi = root.Qisi || {};
    root.Qisi.BatchOrchestrator = api;
    if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    const normalizeBatchImportInput = files => (Array.isArray(files) ? files : []).map((f, i) => ({
        index: i, name: f.name || '', size: f.size || 0, type: f.type || ''
    }));
    const summarizeBatchImportResult = draftItems => ({
        total: (draftItems || []).length,
        withAnswers: (draftItems || []).filter(d => d.answer).length,
        withSolutions: (draftItems || []).filter(d => d.solution).length,
        missingAnswers: (draftItems || []).filter(d => !d.answer).map(d => d.question),
        missingSolutions: (draftItems || []).filter(d => !d.solution).map(d => d.question)
    });
    return { normalizeBatchImportInput, summarizeBatchImportResult };
});
