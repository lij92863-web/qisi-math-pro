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
    // 读回校验要能比对 deletedDrafts 这类结构值：写入与读出是两次独立的结构复制，
    // 引用比较永远不等。数组按内容比，其余类型保持严格相等 —— 不做无依据的深比较。
    const sameStat = (left, right) => {
        if (left === right) return true;
        if (!Array.isArray(left) || !Array.isArray(right)) return false;
        return JSON.stringify(left) === JSON.stringify(right);
    };

    // 批次顶层审计数组随批次整行读出，所以只留最近 50 条。超出时丢最旧的，且必须
    // 说出来 —— 悄悄截断会让"删了但查不到"变成常态。
    const DELETED_DRAFTS_LIMIT = 50;

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
            'refreshDraftBatchStats',
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
                if (!sameStat(readback.batch?.[key], value)) {
                    throw error('DRAFT_MAINTENANCE_READBACK_MISMATCH', {
                        batchId,
                        field: key
                    });
                }
            }
            return readback;
        };

        const refreshBatchStats = async ({ batchId, signal } = {}) => {
            const id = String(batchId || '').trim();
            if (!id) throw error('DRAFT_MAINTENANCE_INPUT_INVALID');
            assertActive(signal);
            const result = await persistence.refreshDraftBatchStats({
                batchId: id, calculateStats: countsFor, updatedAt: clock(), signal
            });
            assertActive(signal);
            for (const [key, value] of Object.entries(result.counts)) {
                if (result.readback.batch?.[key] !== value) {
                    throw error('DRAFT_MAINTENANCE_READBACK_MISMATCH', {
                        batchId: id, field: key
                    });
                }
            }
            return result;
        };

        const dedupeBatchDrafts = async ({
            batchId,
            files = [],
            signal
        } = {}) => {
            const loaded = await load(batchId, signal);
            const submittedCount = loaded.questions.filter(
                draft => draft?.status === 'submitted'
            ).length;
            const result = dedupeDrafts(
                loaded.questions.filter(draft => draft?.status !== 'submitted'),
                {
                    stage: 'manual-active-batch',
                    batchId,
                    files,
                    draftImages: loaded.images
                }
            );
            if (!result || !Array.isArray(result.drafts) ||
                !Array.isArray(result.draftImages)) {
                throw error('DRAFT_MAINTENANCE_DEDUPE_MALFORMED');
            }
            // 合并只产出非 submitted 行；把它们按原顺序放回原位，
            // 已提交行原样保留，维护动作永远不能改写凭证。
            const mergedById = new Map(clone(result.drafts).map(
                draft => [String(draft?.id ?? ''), draft]
            ));
            const drafts = loaded.questions.flatMap(draft => {
                if (draft?.status === 'submitted') return [clone(draft)];
                const merged = mergedById.get(String(draft?.id ?? ''));
                return merged ? [merged] : [];
            });
            const images = clone(result.draftImages);
            const problemCount = drafts.filter(draft => {
                const isChoice = draft.type === '单选题' ||
                    draft.type === '多选题';
                return isChoice && countOptions(draft.options) < 4;
            }).length;
            const batchPatch = {
                totalCount: drafts.length,
                problemCount,
                skippedSubmitted: submittedCount,
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
                skippedSubmitted: submittedCount,
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

        // 单题软删。这是全系统唯一能写 `status:'deleted'` 的地方：deletedBy / reason 是
        // 安全判据不是审计装饰，能写 drafts 就能伪造，所以"谁能删"收口在服务层，
        // 仓储只校验"写进来的墓碑是否自证"。
        const deleteDraftQuestion = async ({
            batchId, draftId, reason, actorId, signal
        } = {}) => {
            const id = String(batchId || '').trim();
            const targetId = String(draftId || '').trim();
            const why = String(reason || '').trim();
            const who = String(actorId || '').trim();
            if (!id || !targetId || !why || !who) {
                throw error('DRAFT_MAINTENANCE_INPUT_INVALID');
            }
            const loaded = await load(id, signal);
            const target = loaded.questions.find(
                draft => String(draft?.id ?? '') === targetId
            );
            if (!target) {
                throw error('DRAFT_MAINTENANCE_DRAFT_NOT_FOUND', {
                    batchId: id, draftId: targetId
                });
            }
            const version = versionOf(loaded.batch);
            const deletedAt = clock();
            // 行状态与批次审计同批提交。分两次调用时仓储侧的墓碑自证与双写校验都会拦下，
            // 所以这里不存在"只改了行"或"只记了审计"的中间态。
            const drafts = loaded.questions.map(draft =>
                String(draft?.id ?? '') === targetId
                    ? {
                        ...clone(draft),
                        status: 'deleted',
                        deletedAt,
                        deletedBy: who,
                        reason: why
                    }
                    : clone(draft)
            );
            const deletedDrafts = [
                ...(Array.isArray(loaded.batch?.deletedDrafts)
                    ? loaded.batch.deletedDrafts : []),
                {
                    draftId: targetId,
                    questionNumber: target.questionNumber ?? null,
                    submittedQuestionId: target.submittedQuestionId ?? null,
                    reason: why,
                    actorId: who,
                    deletedAt
                }
            ].slice(-DELETED_DRAFTS_LIMIT);
            const visible = {
                ...loaded,
                questions: drafts.filter(draft => draft.status !== 'deleted')
            };
            const readback = await persistAndReadback({
                batchId: id,
                loaded,
                drafts,
                images: loaded.images,
                batchPatch: {
                    ...countsFor(visible),
                    // 批次标题上的题数必须跟着可见集合走，否则删完还显示旧数字。
                    totalCount: visible.questions.length,
                    deletedDrafts,
                    updatedAt: clock()
                },
                // 幂等键带版本：同一版本重复点删要能被识别成重放，换了版本就是一次新的
                // 删除请求，不能因为键相同而被静默吞掉。
                idempotencyKey:
                    `maintenance:delete-draft:${id}:${targetId}:${version}`,
                signal
            });
            return {
                draftId: targetId,
                version,
                droppedAuditCount: Math.max(
                    0,
                    (Array.isArray(loaded.batch?.deletedDrafts)
                        ? loaded.batch.deletedDrafts.length : 0) + 1 -
                        DELETED_DRAFTS_LIMIT
                ),
                readback
            };
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
            deleteDraftQuestion,
            deleteDraftBatch,
            deleteDraftBatches
        });
    };

    return Object.freeze({ createDraftMaintenanceService });
});
