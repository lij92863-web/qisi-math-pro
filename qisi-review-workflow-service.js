(function (root, factory) {
    const api = factory();
    root.Qisi = root.Qisi || {};
    root.Qisi.ReviewWorkflowService = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const clone = value => {
        if (Array.isArray(value)) return value.map(clone);
        if (value && typeof value === 'object') {
            const prototype = Object.getPrototypeOf(value);
            if (prototype && prototype !== Object.prototype) return value;
            return Object.fromEntries(
                Object.entries(value).map(([key, item]) => [key, clone(item)])
            );
        }
        return value;
    };
    const error = (code, details = {}) => Object.assign(
        new Error(code),
        { name: 'ReviewWorkflowError', code, details: clone(details) }
    );
    const assertActive = signal => {
        if (!signal?.aborted) return;
        const cancelled = error('REVIEW_WORKFLOW_CANCELLED');
        cancelled.name = 'AbortError';
        throw cancelled;
    };

    const createReviewWorkflowService = ({
        persistence,
        reviewController,
        validateDraft,
        normalizeDraft,
        formalSubmit,
        refreshBatchStats,
        mergeImages,
        dataUrlToBlob,
        clock = () => Date.now()
    } = {}) => {
        if (
            !persistence ||
            typeof persistence.reloadDraftBatch !== 'function' ||
            typeof persistence.persistReviewDraftCommand !== 'function' ||
            typeof reviewController?.confirm !== 'function' ||
            typeof validateDraft !== 'function' ||
            typeof normalizeDraft !== 'function' ||
            typeof formalSubmit?.submit !== 'function' ||
            typeof refreshBatchStats !== 'function' ||
            typeof mergeImages !== 'function' ||
            typeof dataUrlToBlob !== 'function'
        ) {
            throw error('REVIEW_WORKFLOW_DEPENDENCY_REQUIRED');
        }

        const loadCurrent = async ({
            batchId,
            draftId,
            expectedDraftVersion,
            signal
        }) => {
            const normalizedBatchId = String(batchId || '').trim();
            const normalizedDraftId = String(draftId || '').trim();
            if (!normalizedBatchId || !normalizedDraftId) {
                throw error('REVIEW_WORKFLOW_INPUT_INVALID');
            }
            assertActive(signal);
            const loaded = await persistence.reloadDraftBatch(
                normalizedBatchId
            );
            assertActive(signal);
            const draft = loaded.questions.find(
                item => item.id === normalizedDraftId
            );
            if (!draft) throw error('REVIEW_WORKFLOW_DRAFT_NOT_FOUND');
            if (
                Number.isInteger(expectedDraftVersion) &&
                draft.version !== expectedDraftVersion
            ) {
                throw error('REVIEW_WORKFLOW_STALE_DRAFT', {
                    expectedDraftVersion,
                    actualDraftVersion: draft.version
                });
            }
            return { loaded, draft };
        };

        const normalize = draft => {
            const copy = clone(draft);
            const normalized = normalizeDraft(copy);
            return normalized && typeof normalized === 'object'
                ? normalized
                : copy;
        };

        const confirmDraft = async ({
            batchId,
            draftId,
            expectedDraftVersion,
            actorId = 'local-teacher',
            signal
        } = {}) => {
            const current = await loadCurrent({
                batchId,
                draftId,
                expectedDraftVersion,
                signal
            });
            if (current.draft.status === 'submitted') {
                throw error('REVIEW_WORKFLOW_SUBMITTED_IMMUTABLE');
            }
            const confirmation = reviewController.confirm(
                normalize(current.draft),
                { actorId }
            );
            if (!confirmation || typeof confirmation.accepted !== 'boolean') {
                throw error('REVIEW_WORKFLOW_CONFIRMATION_MALFORMED');
            }
            if (!confirmation.accepted) {
                return {
                    accepted: false,
                    validation: clone(confirmation.validation || {}),
                    draft: clone(current.draft)
                };
            }
            const persisted = await persistence.persistReviewDraftCommand({
                batchId,
                draft: confirmation.draft,
                expectedDraftVersion: current.draft.version,
                idempotencyKey:
                    `workflow:confirm:${draftId}:${current.draft.version}`,
                signal
            });
            assertActive(signal);
            const stats = await refreshBatchStats({ batchId, signal });
            const readback = await loadCurrent({ batchId, draftId, signal });
            if (readback.draft.status !== 'reviewed') {
                throw error('REVIEW_WORKFLOW_READBACK_MISMATCH');
            }
            return {
                accepted: true,
                draft: clone(readback.draft),
                persisted,
                stats
            };
        };

        const validate = draft => {
            let result;
            try {
                result = validateDraft(clone(draft));
            } catch (_cause) {
                throw error('REVIEW_WORKFLOW_VALIDATOR_FAILED');
            }
            if (
                !result || typeof result !== 'object' ||
                typeof result.valid !== 'boolean' ||
                !Array.isArray(result.errors || []) ||
                !Array.isArray(result.warnings || [])
            ) {
                throw error('REVIEW_WORKFLOW_VALIDATOR_MALFORMED');
            }
            return result;
        };

        const imageRecordsFor = async (draft, images, signal) => {
            const bound = images.filter(image =>
                image.questionId === draft.id && image.status !== 'deleted'
            );
            const combined = mergeImages(draft.images || [], bound);
            const records = [];
            for (const image of combined) {
                assertActive(signal);
                if (String(image?.url || '').startsWith('data:')) {
                    records.push({
                        id: image.id,
                        blob: await dataUrlToBlob(image.url),
                        createdAt: clock()
                    });
                }
            }
            return records;
        };

        const submitDraft = async ({
            batchId,
            draftId,
            expectedDraftVersion,
            actorId = 'local-teacher',
            requestId = '',
            signal,
            refreshStats = true
        } = {}) => {
            const current = await loadCurrent({
                batchId,
                draftId,
                expectedDraftVersion,
                signal
            });
            const stableRequestId = requestId ||
                `workflow:submit:${draftId}:${current.draft.version}`;
            if (current.draft.status === 'submitted') {
                if (
                    current.draft.admissionAudit?.requestId === stableRequestId ||
                    current.draft.admissionAudit?.idempotencyKey === stableRequestId
                ) {
                    return {
                        accepted: true,
                        idempotent: true,
                        draft: clone(current.draft),
                        questionId: current.draft.submittedQuestionId || ''
                    };
                }
                throw error('REVIEW_WORKFLOW_SUBMITTED_IMMUTABLE');
            }
            if (current.draft.status !== 'reviewed') {
                throw error('REVIEW_WORKFLOW_NOT_REVIEWED');
            }
            const validation = validate(current.draft);
            if (!validation.valid) {
                return {
                    accepted: false,
                    code: 'REVIEW_WORKFLOW_VALIDATION_REJECTED',
                    validation
                };
            }
            const imageRecords = await imageRecordsFor(
                current.draft,
                current.loaded.images,
                signal
            );
            assertActive(signal);
            const result = await formalSubmit.submit({
                draftId,
                batchId,
                expectedDraftVersion: current.draft.version,
                imageRecords,
                actorId,
                requestId: stableRequestId,
                idempotencyKey: stableRequestId,
                signal
            });
            if (!result?.accepted) return result;
            const stats = refreshStats
                ? await refreshBatchStats({ batchId, signal })
                : null;
            const readback = await loadCurrent({ batchId, draftId, signal });
            if (
                readback.draft.status !== 'submitted' ||
                !readback.draft.submittedQuestionId
            ) {
                throw error('REVIEW_WORKFLOW_READBACK_MISMATCH');
            }
            return {
                ...result,
                idempotent: Boolean(result.committed?.idempotent),
                draft: clone(readback.draft),
                stats
            };
        };

        const prepareReviewedBatch = async ({ batchId, signal } = {}) => {
            assertActive(signal);
            const loaded = await persistence.reloadDraftBatch(batchId);
            assertActive(signal);
            const reviewed = loaded.questions.filter(
                draft => draft.status === 'reviewed'
            );
            return {
                count: reviewed.length,
                ids: reviewed.map(draft => draft.id),
                pending: loaded.questions.filter(
                    draft => draft.status === 'pending'
                ).length,
                missingAnswer: loaded.questions.filter(draft =>
                    (draft.mergeWarnings || []).includes('missing_answer') ||
                    !String(draft.answer || '').trim()
                ).length,
                duplicate: 0,
                image: loaded.questions.filter(draft =>
                    ['need_confirm', 'low_confidence'].includes(
                        draft.imageReviewStatus
                    )
                ).length
            };
        };

        const submitReviewedBatch = async ({
            batchId,
            draftIds,
            actorId = 'local-teacher',
            requestId = '',
            signal
        } = {}) => {
            assertActive(signal);
            const loaded = await persistence.reloadDraftBatch(batchId);
            const requested = Array.isArray(draftIds) && draftIds.length
                ? [...new Set(draftIds.map(String))]
                : loaded.questions
                    .filter(draft => draft.status === 'reviewed')
                    .map(draft => draft.id);
            const batchRequestId = requestId ||
                `workflow:batch:${batchId}:${requested.join(',')}`;
            const results = [];
            for (const draftId of requested) {
                assertActive(signal);
                const source = loaded.questions.find(
                    draft => draft.id === draftId
                );
                if (!source) {
                    results.push({
                        draftId,
                        accepted: false,
                        code: 'REVIEW_WORKFLOW_DRAFT_NOT_FOUND'
                    });
                    continue;
                }
                try {
                    const value = await submitDraft({
                        batchId,
                        draftId,
                        expectedDraftVersion: source.version,
                        actorId,
                        requestId: `${batchRequestId}:${draftId}`,
                        signal,
                        refreshStats: false
                    });
                    results.push({ draftId, ...value });
                } catch (cause) {
                    if (cause?.name === 'AbortError') throw cause;
                    results.push({
                        draftId,
                        accepted: false,
                        code: cause?.code || 'REVIEW_WORKFLOW_SUBMIT_FAILED'
                    });
                }
            }
            const stats = await refreshBatchStats({ batchId, signal });
            return {
                requestId: batchRequestId,
                okCount: results.filter(item => item.accepted).length,
                failedCount: results.filter(item => !item.accepted).length,
                results,
                stats
            };
        };

        return Object.freeze({
            confirmDraft,
            submitDraft,
            prepareReviewedBatch,
            submitReviewedBatch
        });
    };

    return Object.freeze({ createReviewWorkflowService });
});
