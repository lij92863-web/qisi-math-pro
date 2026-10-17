(function (root, factory) {
    const api = factory();
    root.Qisi = root.Qisi || {};
    root.Qisi.DraftMaintenanceService = api;
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
        { name: 'DraftMaintenanceError', code, details: clone(details) }
    );
    const assertActive = signal => {
        if (!signal?.aborted) return;
        const cancelled = error('DRAFT_MAINTENANCE_CANCELLED');
        cancelled.name = 'AbortError';
        throw cancelled;
    };
    const versionOf = batch => Number.isInteger(batch?.draftPersistence?.version)
        ? batch.draftPersistence.version
        : 0;

    const createDraftMaintenanceService = ({
        persistence,
        dedupeDrafts,
        countOptions,
        problemsForDraft,
        preserveRawEvidence,
        cleanDisplayFields,
        clock = () => Date.now()
    } = {}) => {
        const requiredPersistence = [
            'reloadDraftBatch',
            'persistReviewDraftBatch',
            'deleteDraftBatch'
        ];
        if (
            !persistence ||
            requiredPersistence.some(name =>
                typeof persistence[name] !== 'function'
            )
        ) {
            throw error('DRAFT_MAINTENANCE_DEPENDENCY_REQUIRED');
        }
        if (
            typeof dedupeDrafts !== 'function' ||
            typeof countOptions !== 'function' ||
            typeof problemsForDraft !== 'function' ||
            typeof preserveRawEvidence !== 'function' ||
            typeof cleanDisplayFields !== 'function'
        ) {
            throw error('DRAFT_MAINTENANCE_DEPENDENCY_REQUIRED');
        }

        const load = async (batchId, signal) => {
            const id = String(batchId || '').trim();
            if (!id) throw error('DRAFT_MAINTENANCE_INPUT_INVALID');
            assertActive(signal);
            const loaded = await persistence.reloadDraftBatch(id);
            assertActive(signal);
            return loaded;
        };

        const countsFor = loaded => {
            const drafts = loaded.questions;
            const images = loaded.images;
            const submittedCount = drafts.filter(
                draft => draft.status === 'submitted'
            ).length;
            return {
                reviewedCount: drafts.filter(
                    draft => draft.status === 'reviewed'
                ).length,
                submittedCount,
                problemCount: drafts.filter(draft =>
                    draft.status !== 'submitted' &&
                    problemsForDraft(draft).length > 0
                ).length,
                unassignedImageCount: images.filter(
                    image => image.status === 'unassigned'
                ).length,
                status: drafts.length && submittedCount === drafts.length
                    ? 'completed'
                    : (loaded.batch.status || 'review')
            };
        };

        const persistAndReadback = async ({
            batchId,
            loaded,
            drafts,
            images,
            batchPatch,
            idempotencyKey,
            signal
        }) => {
            assertActive(signal);
            await persistence.persistReviewDraftBatch({
                batchId,
                drafts,
                images,
                files: loaded.files,
                expectedVersion: versionOf(loaded.batch),
                batchPatch,
                idempotencyKey,
                signal
            });
            assertActive(signal);
            const readback = await load(batchId, signal);
            for (const [key, value] of Object.entries(batchPatch)) {
                if (key === 'updatedAt') continue;
                if (readback.batch?.[key] !== value) {
                    throw error('DRAFT_MAINTENANCE_READBACK_MISMATCH', {
                        batchId,
                        field: key
                    });
                }
            }
            return readback;
        };

        const refreshBatchStats = async ({ batchId, signal } = {}) => {
            const loaded = await load(batchId, signal);
            const counts = countsFor(loaded);
            const readback = await persistAndReadback({
                batchId,
                loaded,
                drafts: loaded.questions,
                images: loaded.images,
                batchPatch: { ...counts, updatedAt: clock() },
                idempotencyKey:
                    `maintenance:stats:${batchId}:${versionOf(loaded.batch)}`,
                signal
            });
            return { counts, readback };
        };

        const dedupeBatchDrafts = async ({
            batchId,
            files = [],
            signal
        } = {}) => {
            const loaded = await load(batchId, signal);
            const result = dedupeDrafts(loaded.questions, {
                stage: 'manual-active-batch',
                batchId,
                files,
                draftImages: loaded.images
            });
            if (!result || !Array.isArray(result.drafts) ||
                !Array.isArray(result.draftImages)) {
                throw error('DRAFT_MAINTENANCE_DEDUPE_MALFORMED');
            }
            const drafts = clone(result.drafts);
            const images = clone(result.draftImages);
            const problemCount = drafts.filter(draft => {
                const isChoice = draft.type === '单选题' ||
                    draft.type === '多选题';
                return isChoice && countOptions(draft.options) < 4;
            }).length;
            const batchPatch = {
                totalCount: drafts.length,
                problemCount,
                unassignedImageCount: images.filter(
                    image => image.status === 'unassigned'
                ).length,
                updatedAt: clock()
            };
            const readback = await persistAndReadback({
                batchId,
                loaded,
                drafts,
                images,
                batchPatch,
                idempotencyKey:
                    `maintenance:dedupe:${batchId}:${versionOf(loaded.batch)}`,
                signal
            });
            return {
                beforeCount: loaded.questions.length,
                afterCount: drafts.length,
                readback
            };
        };

        const cleanupDisplayFields = async ({ batchId, signal } = {}) => {
            const loaded = await load(batchId, signal);
            let changedCount = 0;
            const drafts = loaded.questions.map(source => {
                const draft = clone(source);
                const provenance = JSON.stringify(draft.fieldProvenance || {});
                const before = JSON.stringify({
                    stem: draft.stem,
                    options: draft.options,
                    answer: draft.answer,
                    solution: draft.solution
                });
                preserveRawEvidence(draft);
                cleanDisplayFields(draft);
                if (JSON.stringify(draft.fieldProvenance || {}) !== provenance) {
                    throw error('DRAFT_MAINTENANCE_PROVENANCE_CHANGED', {
                        draftId: draft.id
                    });
                }
                const after = JSON.stringify({
                    stem: draft.stem,
                    options: draft.options,
                    answer: draft.answer,
                    solution: draft.solution
                });
                if (before !== after) {
                    draft.updatedAt = clock();
                    changedCount += 1;
                }
                return draft;
            });
            if (!changedCount) return { changedCount: 0, readback: loaded };
            const readback = await persistAndReadback({
                batchId,
                loaded,
                drafts,
                images: loaded.images,
                batchPatch: { updatedAt: clock() },
                idempotencyKey:
                    `maintenance:cleanup:${batchId}:${versionOf(loaded.batch)}`,
                signal
            });
            return { changedCount, readback };
        };

        const deleteDraftBatch = async ({
            batchId,
            expectedVersion,
            signal
        } = {}) => {
            assertActive(signal);
            const result = await persistence.deleteDraftBatch(batchId, {
                expectedVersion,
                signal
            });
            assertActive(signal);
            try {
                await persistence.reloadDraftBatch(batchId);
            } catch (cause) {
                if (cause?.code === 'DRAFT_BATCH_NOT_FOUND') return result;
                throw cause;
            }
            throw error('DRAFT_MAINTENANCE_READBACK_MISMATCH', { batchId });
        };

        const deleteDraftBatches = async ({ batchIds, signal } = {}) => {
            if (!Array.isArray(batchIds)) {
                throw error('DRAFT_MAINTENANCE_INPUT_INVALID');
            }
            const results = [];
            for (const batchId of [...new Set(batchIds.map(String))]) {
                assertActive(signal);
                results.push(await deleteDraftBatch({ batchId, signal }));
            }
            return { deletedCount: results.length, results };
        };

        return Object.freeze({
            refreshBatchStats,
            dedupeBatchDrafts,
            cleanupDisplayFields,
            deleteDraftBatch,
            deleteDraftBatches
        });
    };

    return Object.freeze({ createDraftMaintenanceService });
});
