(function (root, factory) {
    const api = factory();
    root.Qisi = root.Qisi || {};
    root.Qisi.ProductionReviewValidator = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const isRecord = value => Boolean(
        value && typeof value === 'object' && !Array.isArray(value)
    );
    const clone = value => {
        if (Array.isArray(value)) return value.map(clone);
        if (isRecord(value)) {
            return Object.fromEntries(
                Object.entries(value).map(([key, item]) => [key, clone(item)])
            );
        }
        return value;
    };
    const errorOf = (code, field, message) => ({ code, field, message });

    const createProductionReviewValidator = ({
        policy,
        clock = () => Date.now()
    } = {}) => {
        if (
            typeof policy?.createAdmissionContext !== 'function' ||
            typeof policy?.evaluateDraftAdmission !== 'function' ||
            !Array.isArray(policy?.FORMAL_FIELDS)
        ) {
            throw new TypeError('Formal Admission Policy is required.');
        }

        const validate = (draft, { baseErrors = [], baseWarnings = [] } = {}) => {
            const errors = Array.isArray(baseErrors)
                ? clone(baseErrors)
                : [errorOf(
                    'review-draft-schema-invalid',
                    'baseErrors',
                    'Base review errors must be an array.'
                )];
            const warnings = Array.isArray(baseWarnings)
                ? clone(baseWarnings)
                : [];

            if (
                !isRecord(draft) ||
                !String(draft?.id || '').trim() ||
                !Number.isInteger(draft?.version) ||
                draft.version < 1 ||
                !String(draft?.type || '').trim() ||
                !isRecord(draft?.source) ||
                !String(draft?.source?.sourceId || '').trim()
            ) {
                errors.push(errorOf(
                    'review-draft-schema-invalid',
                    'draft',
                    'Review draft requires ID, positive version, type, and source.'
                ));
            }

            const provenance = isRecord(draft?.fieldProvenance)
                ? draft.fieldProvenance
                : {};
            for (const field of policy.FORMAL_FIELDS) {
                const item = provenance[field];
                if (
                    item?.status === 'manual' &&
                    (
                        !Number.isInteger(item.manualEditRevision) ||
                        item.manualEditRevision < 1
                    )
                ) {
                    errors.push(errorOf(
                        'review-manual-state-invalid',
                        field,
                        `Manual field ${field} requires an actual edit revision.`
                    ));
                }
            }

            const evaluatedAt = new Date(clock()).toISOString();
            const requestId = `review-precheck:${draft?.id || 'missing'}:${
                draft?.version ?? 'missing'
            }`;
            const context = policy.createAdmissionContext({
                mode: draft?.producer?.mode || draft?.source?.mode || '',
                actorId: 'review-precheck',
                explicitConfirmation: true,
                requestId,
                idempotencyKey: requestId,
                evaluatedAt,
                source: isRecord(draft?.source) ? draft.source : {},
                producer: isRecord(draft?.producer) ? draft.producer : {},
                route: isRecord(draft?.route) ? draft.route : {}
            });
            const admissionDecision = policy.evaluateDraftAdmission(
                draft,
                context
            );
            errors.push(...clone(admissionDecision.errors || []));
            warnings.push(...clone(admissionDecision.warnings || []));

            return {
                valid: errors.length === 0 && admissionDecision.accepted === true,
                errors,
                warnings,
                admissionDecision
            };
        };

        return Object.freeze({ validate });
    };

    return Object.freeze({ createProductionReviewValidator });
});
