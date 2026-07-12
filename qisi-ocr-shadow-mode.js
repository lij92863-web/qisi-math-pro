(function (root, factory) {
    const api = factory();
    root.Qisi = root.Qisi || {};
    root.Qisi.OcrShadowMode = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const summarize = candidate => ({
        engine: candidate?.engine || '',
        engineVersion: candidate?.engineVersion || '',
        requestId: candidate?.requestId || '',
        sourceId: candidate?.sourceId || '',
        page: candidate?.page ?? null,
        blockCount: Array.isArray(candidate?.blocks) ? candidate.blocks.length : 0,
        formulaCount: Array.isArray(candidate?.formulas) ? candidate.formulas.length : 0,
        imageCount: Array.isArray(candidate?.images) ? candidate.images.length : 0,
        warningCodes: (candidate?.warnings || []).map(warning =>
            typeof warning === 'object' ? warning.code || 'warning' : String(warning)
        ),
        durationMs: candidate?.durationMs ?? null
    });

    const compareCandidates = (productionCandidate, shadowCandidate) => {
        const production = summarize(productionCandidate);
        const shadow = summarize(shadowCandidate);
        return Object.freeze({
            production,
            shadow,
            differences: {
                blocks: shadow.blockCount - production.blockCount,
                formulas: shadow.formulaCount - production.formulaCount,
                images: shadow.imageCount - production.imageCount,
                warnings: shadow.warningCodes.length - production.warningCodes.length
            },
            conflict: JSON.stringify(production) !== JSON.stringify(shadow),
            manualReviewRequired: JSON.stringify(production) !== JSON.stringify(shadow),
            eligibleForReview: false,
            eligibleForControlledWrite: false,
            autoSelectWinner: false,
            fieldMergeAllowed: false
        });
    };

    const runShadow = async ({
        productionCandidate,
        shadowEngine,
        input,
        options = {}
    } = {}) => {
        if (!productionCandidate) throw new TypeError('Production candidate is required.');
        if (!shadowEngine?.recognizePage) throw new TypeError('Shadow engine is required.');
        const shadowCandidate = await shadowEngine.recognizePage(input, {
            ...options,
            shadowMode: true
        });
        return {
            productionCandidate,
            shadowCandidate,
            report: compareCandidates(productionCandidate, shadowCandidate),
            productionCandidateUnchanged: true
        };
    };

    return Object.freeze({ summarize, compareCandidates, runShadow });
});
