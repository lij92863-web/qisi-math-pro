(function (root, factory) {
    const api = factory();
    root.Qisi = root.Qisi || {};
    root.Qisi.InjectedImportPath = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const TRANSPORT_KIND = 'qisi.mock-import-transport.v1';
    const clone = value => JSON.parse(JSON.stringify(value));
    const normalizeNumber = value => String(value ?? '').trim();

    class InjectedImportError extends Error {
        constructor(code, message) {
            super(message);
            this.name = 'InjectedImportError';
            this.code = code;
            this.stage = 'injected-import';
        }
    }

    const createInjectedImportPath = ({
        repository,
        validateDrafts,
        buildReviewDrafts,
        persistDraftBatch,
        clock = () => Date.now()
    } = {}) => {
        if (
            typeof repository?.get !== 'function' ||
            typeof repository?.findBy !== 'function'
        ) {
            throw new TypeError('Storage repository is required.');
        }
        if (typeof validateDrafts !== 'function') {
            throw new TypeError('Import validation service is required.');
        }
        if (typeof buildReviewDrafts !== 'function') {
            throw new TypeError('Review draft builder is required.');
        }
        if (typeof persistDraftBatch !== 'function') {
            throw new TypeError('Draft persistence service is required.');
        }

        const run = async (batchId, transport) => {
            const id = String(batchId || '').trim();
            if (
                transport?.kind !== TRANSPORT_KIND ||
                typeof transport?.produceCandidates !== 'function'
            ) {
                throw new InjectedImportError(
                    'mock-transport-invalid', 'Injected import transport is invalid.'
                );
            }
            const batch = await repository.get('draftImportBatches', id);
            const files = await repository.findBy('draftImportFiles', 'batchId', id);
            if (!batch || !files.length) {
                throw new InjectedImportError(
                    'import-context-missing', 'Batch and source files are required.'
                );
            }
            await repository.update('draftImportBatches', id, {
                status: 'processing', progress: 5, updatedAt: clock(), errorMessage: ''
            });
            try {
                const envelope = await transport.produceCandidates({
                    batch: clone(batch), files: clone(files)
                });
                if (
                    !envelope || typeof envelope !== 'object' ||
                    !Array.isArray(envelope.candidates)
                ) {
                    throw new InjectedImportError(
                        'candidate-envelope-malformed',
                        'Mock transport returned a malformed candidate envelope.'
                    );
                }
                if (envelope.candidates.some(candidate =>
                    typeof candidate === 'string' || candidate?.rawJsonCandidate === true
                )) {
                    throw new InjectedImportError(
                        'raw-json-candidate-rejected',
                        'Raw JSON candidates cannot enter review drafts.'
                    );
                }
                const byNumber = new Map(envelope.candidates.map(candidate => [
                    normalizeNumber(candidate?.questionNumber), candidate
                ]));
                const expected = (envelope.expectedQuestionNumbers || [])
                    .map(normalizeNumber).filter(Boolean);
                const selected = [];
                if (expected.length) {
                    for (const questionNumber of expected) {
                        if (!byNumber.has(questionNumber)) break;
                        selected.push(byNumber.get(questionNumber));
                    }
                } else {
                    selected.push(...envelope.candidates);
                }
                if (!selected.length) {
                    throw new InjectedImportError(
                        'candidate-prefix-empty',
                        'No safe candidate prefix is available.'
                    );
                }
                const now = clock();
                const validatedDrafts = validateDrafts(selected, {
                    batch: clone(batch),
                    files: clone(files),
                    expectedQuestionNumbers: expected,
                    prefixTruncated: expected.length > selected.length
                });
                if (
                    !Array.isArray(validatedDrafts) ||
                    validatedDrafts.length !== selected.length
                ) {
                    throw new InjectedImportError(
                        'import-validation-malformed',
                        'Import validation returned a malformed draft set.'
                    );
                }
                const reviewDrafts = buildReviewDrafts(validatedDrafts, {
                    batchId: id,
                    now
                });
                if (
                    !Array.isArray(reviewDrafts) ||
                    reviewDrafts.length !== validatedDrafts.length
                ) {
                    throw new InjectedImportError(
                        'review-draft-build-malformed',
                        'Review draft builder returned a malformed draft set.'
                    );
                }
                const expectedVersion = Number.isInteger(
                    batch.draftPersistence?.version
                ) ? batch.draftPersistence.version : 0;
                await persistDraftBatch({
                    drafts: reviewDrafts,
                    files: files.map(file => ({
                        ...file, parseStatus: 'success', updatedAt: now, errorMessage: ''
                    })),
                    batch: {
                        ...batch, status: 'review', progress: 100,
                        totalCount: reviewDrafts.length, reviewedCount: 0,
                        submittedCount: 0, problemCount: 0,
                        prefixTruncated: expected.length > reviewDrafts.length,
                        updatedAt: now, errorMessage: ''
                    },
                    expectedVersion,
                    idempotencyKey: `review:${id}:${expectedVersion + 1}`
                });
                return {
                    batchId: id,
                    drafts: reviewDrafts,
                    prefixTruncated: expected.length > reviewDrafts.length
                };
            } catch (error) {
                await repository.update('draftImportBatches', id, {
                    status: 'failed', progress: 100,
                    updatedAt: clock(), errorMessage: error?.message || String(error)
                });
                throw error;
            }
        };

        return Object.freeze({ run });
    };

    return Object.freeze({ TRANSPORT_KIND, InjectedImportError, createInjectedImportPath });
});
