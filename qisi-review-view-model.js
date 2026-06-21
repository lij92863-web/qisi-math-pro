(function (root, factory) {
    const api = factory();
    root.Qisi = root.Qisi || {};
    root.Qisi.ReviewViewModel = api;
    if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    const buildReviewViewModel = (draft, index) => ({
        index, question: draft.question || String(index + 1), answer: draft.answer || '', solution: draft.solution || '',
        hasAnswer: Boolean(draft.answer), hasSolution: Boolean(draft.solution),
        isMissingAnswer: !draft.answer, isSafePartial: !draft.answer,
        warnings: (draft.warnings || []).slice(0, 10)
    });
    return { buildReviewViewModel };
});
