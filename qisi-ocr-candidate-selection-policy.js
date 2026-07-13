(function (root, factory) {
    const api = factory();
    root.Qisi = root.Qisi || {};
    root.Qisi.OcrCandidateSelectionPolicy = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const RANKING_BASIS = Object.freeze(['completeness', 'engineConfidence']);

    const promotionKey = (engine, engineVersion) =>
        `${String(engine || '').trim()}::${String(engineVersion || '').trim()}`;

    const promotedVersions = promotions => new Set(
        (Array.isArray(promotions) ? promotions : [])
            .filter(item => item?.productionPromoted === true &&
                typeof item.holdoutDecisionId === 'string' && item.holdoutDecisionId.trim())
            .map(item => promotionKey(item.engine, item.engineVersion))
    );

    const evaluateCandidate = (candidate, {
        promotions = [],
        minCompleteness = 0
    } = {}) => {
        const reasons = [];
        const engine = typeof candidate?.engine === 'string' ? candidate.engine.trim() : '';
        const engineVersion = typeof candidate?.engineVersion === 'string'
            ? candidate.engineVersion.trim()
            : '';
        if (!engine || !engineVersion) reasons.push('candidate-identity-invalid');
        if (!promotedVersions(promotions).has(promotionKey(engine, engineVersion))) {
            reasons.push('engine-not-production-promoted');
        }

        const validation = candidate?.validation;
        for (const [field, reason] of [
            ['schemaValid', 'schema-invalid'],
            ['sequenceValid', 'sequence-invalid'],
            ['ownershipValid', 'ownership-invalid'],
            ['formulaValid', 'formula-invalid'],
            ['provenanceComplete', 'provenance-incomplete']
        ]) {
            if (validation?.[field] !== true) reasons.push(reason);
        }

        const completeness = candidate?.metrics?.completeness;
        const confidence = candidate?.metrics?.engineConfidence;
        if (!Number.isFinite(completeness) || completeness < 0 || completeness > 1 ||
            completeness < minCompleteness) {
            reasons.push('completeness-below-threshold');
        }
        if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
            reasons.push('engine-confidence-missing');
        }
        const safetyErrors = candidate?.metrics?.safetyErrors;
        if (!Array.isArray(safetyErrors) || safetyErrors.length > 0) {
            reasons.push('fatal-safety-errors');
        }

        return Object.freeze({
            engine,
            engineVersion,
            requestId: typeof candidate?.requestId === 'string' ? candidate.requestId : '',
            eligible: reasons.length === 0,
            reasons: Object.freeze([...new Set(reasons)]),
            completeness: Number.isFinite(completeness) ? completeness : null,
            engineConfidence: Number.isFinite(confidence) ? confidence : null,
            safetyErrorCount: Array.isArray(safetyErrors) ? safetyErrors.length : null
        });
    };

    const dominates = (left, right) =>
        left.completeness >= right.completeness &&
        left.engineConfidence >= right.engineConfidence &&
        (left.completeness > right.completeness ||
            left.engineConfidence > right.engineConfidence);

    const selectProductionCandidate = (candidates, options = {}) => {
        const inputs = Array.isArray(candidates) ? candidates : [];
        const evaluations = inputs.map(candidate => evaluateCandidate(candidate, options));
        const eligibleIndices = evaluations.flatMap((evaluation, index) =>
            evaluation.eligible ? [index] : []
        );
        let selectedIndex = -1;
        let decisionReason = 'no-eligible-candidate';
        if (eligibleIndices.length === 1) {
            selectedIndex = eligibleIndices[0];
            decisionReason = 'single-eligible-candidate';
        } else if (eligibleIndices.length > 1) {
            const dominant = eligibleIndices.filter(index =>
                eligibleIndices.every(other =>
                    other === index || dominates(evaluations[index], evaluations[other])
                )
            );
            if (dominant.length === 1) {
                selectedIndex = dominant[0];
                decisionReason = 'deterministic-metric-dominance';
            } else {
                decisionReason = 'metric-conflict';
            }
        }
        const selected = selectedIndex >= 0;
        return Object.freeze({
            decision: selected ? 'selected' : 'manual-review',
            decisionReason,
            selectedCandidate: selected ? inputs[selectedIndex] : null,
            retainedCandidates: Object.freeze([...inputs]),
            evaluations: Object.freeze(evaluations),
            rankingBasis: RANKING_BASIS,
            manualReviewRequired: !selected,
            synthesizedCandidate: null,
            fieldMergeAllowed: false,
            semanticGuessingAllowed: false,
            eligibleForControlledWrite: false,
            eligibleForFormalAdmission: false
        });
    };

    return Object.freeze({
        RANKING_BASIS,
        promotionKey,
        evaluateCandidate,
        selectProductionCandidate
    });
});
