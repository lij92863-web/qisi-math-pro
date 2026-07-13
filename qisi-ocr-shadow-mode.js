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

    const METRIC_FIELDS = Object.freeze([
        'schemaValid',
        'blockCount',
        'formulaCount',
        'imageCount',
        'warningCount',
        'durationMs',
        'rawCer',
        'normalizedCer',
        'formulaTokenF1',
        'questionRecall',
        'ownershipAccuracy',
        'fatalSafetyErrors',
        'manualCorrectionCost'
    ]);

    const defaultMetrics = candidate => ({
        blockCount: Array.isArray(candidate?.blocks) ? candidate.blocks.length : 0,
        formulaCount: Array.isArray(candidate?.formulas) ? candidate.formulas.length : 0,
        imageCount: Array.isArray(candidate?.images) ? candidate.images.length : 0,
        warningCount: Array.isArray(candidate?.warnings) ? candidate.warnings.length : 0,
        durationMs: Number.isFinite(candidate?.durationMs) ? candidate.durationMs : null
    });

    const sanitizeMetrics = value => {
        const source = value && typeof value === 'object' ? value : {};
        const sanitized = {};
        for (const field of METRIC_FIELDS) {
            const item = source[field];
            if (typeof item === 'boolean' || item === null || Number.isFinite(item)) {
                sanitized[field] = item;
            }
        }
        return Object.freeze(sanitized);
    };

    const metricDelta = (production, shadow) => Object.freeze(Object.fromEntries(
        METRIC_FIELDS.flatMap(field =>
            Number.isFinite(production[field]) && Number.isFinite(shadow[field])
                ? [[field, shadow[field] - production[field]]]
                : []
        )
    ));

    const emitSafeLog = (logger, event, metadata = {}) => {
        if (typeof logger !== 'function') return;
        const safe = {};
        for (const field of [
            'productionEngine', 'shadowEngine', 'requestId', 'status', 'code', 'durationMs'
        ]) {
            if (metadata[field] !== undefined) safe[field] = metadata[field];
        }
        logger(Object.freeze({ event, ...safe }));
    };

    const safetyFlags = () => ({
        eligibleForReview: false,
        eligibleForControlledWrite: false,
        eligibleForFormalAdmission: false,
        defaultUiResult: false,
        autoSelectWinner: false,
        fieldMergeAllowed: false,
        answerSupplementAllowed: false
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
            ...safetyFlags()
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

    const runMeasuredShadow = async ({
        productionCandidate,
        shadowEngine,
        input,
        options = {},
        measureCandidate = defaultMetrics,
        logger
    } = {}) => {
        if (!productionCandidate) throw new TypeError('Production candidate is required.');
        if (!shadowEngine?.recognizePage) throw new TypeError('Shadow engine is required.');
        if (typeof measureCandidate !== 'function') {
            throw new TypeError('Shadow measurement function must be callable.');
        }
        const started = Date.now();
        const productionMetrics = sanitizeMetrics(await measureCandidate(productionCandidate));
        try {
            const shadowCandidate = await shadowEngine.recognizePage(input, {
                ...options,
                shadowMode: true,
                benchmarkOnly: true
            });
            const shadowMetrics = sanitizeMetrics(await measureCandidate(shadowCandidate));
            const comparison = compareCandidates(productionCandidate, shadowCandidate);
            const report = Object.freeze({
                ...comparison,
                shadowStatus: 'measured',
                failureCode: '',
                fallbackToProduction: false,
                productionCandidateUnchanged: true,
                metrics: Object.freeze({
                    production: productionMetrics,
                    shadow: shadowMetrics,
                    delta: metricDelta(productionMetrics, shadowMetrics)
                })
            });
            emitSafeLog(logger, 'ocr-shadow-complete', {
                productionEngine: report.production.engine,
                shadowEngine: report.shadow.engine,
                requestId: report.shadow.requestId,
                status: report.shadowStatus,
                durationMs: Date.now() - started
            });
            return {
                productionCandidate,
                shadowCandidate,
                report,
                productionCandidateUnchanged: true
            };
        } catch (cause) {
            const failureCode = typeof cause?.code === 'string' && cause.code
                ? cause.code
                : 'ocr-shadow-failed';
            const report = Object.freeze({
                production: summarize(productionCandidate),
                shadow: null,
                differences: null,
                conflict: true,
                manualReviewRequired: true,
                ...safetyFlags(),
                shadowStatus: 'failed',
                failureCode,
                fallbackToProduction: true,
                productionCandidateUnchanged: true,
                metrics: Object.freeze({
                    production: productionMetrics,
                    shadow: null,
                    delta: null
                })
            });
            emitSafeLog(logger, 'ocr-shadow-failure', {
                productionEngine: report.production.engine,
                requestId: options.requestId || '',
                status: report.shadowStatus,
                code: failureCode,
                durationMs: Date.now() - started
            });
            return {
                productionCandidate,
                shadowCandidate: null,
                report,
                productionCandidateUnchanged: true
            };
        }
    };

    return Object.freeze({
        METRIC_FIELDS,
        summarize,
        sanitizeMetrics,
        compareCandidates,
        runShadow,
        runMeasuredShadow
    });
});
