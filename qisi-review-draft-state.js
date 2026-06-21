(function (root, factory) {
    const api = factory();
    root.Qisi = root.Qisi || {};
    root.Qisi.ReviewDraftState = api;
    if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    const summarizeDraftStatus = drafts => {
        const items = (drafts || []).map((d, i) => ({ question: d.question || String(i + 1), hasAnswer: Boolean(d.answer), hasSolution: Boolean(d.solution), warnings: d.warnings || [] }));
        return { total: items.length, complete: items.filter(d => d.hasAnswer && d.hasSolution).length, missingAnswer: items.filter(d => !d.hasAnswer).length, missingSolution: items.filter(d => !d.hasSolution).length, safePartial: items.some(d => !d.hasAnswer) };
    };
    return { summarizeDraftStatus };
});
