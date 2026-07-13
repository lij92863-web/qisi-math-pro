(function (root, factory) {
    const api = factory();
    root.Qisi = root.Qisi || {};
    root.Qisi.BatchFormalSubmit = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const clone = value => JSON.parse(JSON.stringify(value));

    const createBatchFormalSubmit = ({
        policy,
        repository,
        clock = () => Date.now(),
        random = () => Math.random()
    } = {}) => {
        if (
            typeof policy?.createAdmissionContext !== 'function' ||
            typeof policy?.evaluateDraftAdmission !== 'function'
        ) {
            throw new TypeError('Formal Admission Policy is required.');
        }
        if (typeof repository?.confirmDraftToQuestion !== 'function') {
            throw new TypeError('Formal question repository is required.');
        }

        const buildManualFieldProvenance = (draft, field) => {
            const existing = clone(draft?.fieldProvenance || {});
            if (!policy.FORMAL_FIELDS.includes(field)) return existing;
            const current = existing[field] || {};
            existing[field] = {
                kind: 'manual',
                status: 'manual',
                sourceId: current.sourceId || draft?.source?.sourceId || '',
                manuallyEdited: true,
                manualEditRevision:
                    (Number.isInteger(current.manualEditRevision)
                        ? current.manualEditRevision
                        : 0) + 1
            };
            return existing;
        };

        const nextDraftVersion = version =>
            Number.isInteger(version) ? version + 1 : 1;

        const submit = async ({
            draft,
            imageRecords = [],
            actorId = 'local-teacher'
        } = {}) => {
            const clockValue = clock();
            const evaluatedAt = new Date(clockValue).toISOString();
            const requestId = `batch-submit:${draft?.id}:${draft?.version}`;
            const context = policy.createAdmissionContext({
                mode: draft?.producer?.mode || draft?.source?.mode || '',
                actorId,
                explicitConfirmation: true,
                requestId,
                idempotencyKey: requestId,
                evaluatedAt,
                source: draft?.source || {},
                producer: draft?.producer || {},
                route: draft?.route || {}
            });
            const decision = policy.evaluateDraftAdmission(draft, context);
            if (!decision.accepted) {
                return { accepted: false, decision };
            }
            const questionId = `q_${clockValue}_${random().toString(36).slice(2, 7)}`;
            const committed = await repository.confirmDraftToQuestion(
                draft.id,
                decision,
                {
                    expectedDraftVersion: draft.version,
                    idempotencyKey: requestId,
                    actorId,
                    requestId,
                    questionId,
                    context,
                    imageRecords
                }
            );
            return { accepted: true, decision, committed };
        };

        return Object.freeze({
            buildManualFieldProvenance,
            nextDraftVersion,
            submit
        });
    };

    return Object.freeze({ createBatchFormalSubmit });
});
