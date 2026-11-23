(function initReviewSessionCommands(root, factory) {
    const api = factory(root);
    root.Qisi = root.Qisi || {};
    root.Qisi.ReviewSessionCommands = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    // Review session state, transitions and persistence orchestration.
    const resolveSelection = ({ currentId, nextId, dirty } = {}) => {
        if (!nextId || nextId === currentId) return 'noop';
        return dirty ? 'prompt' : 'switch';
    };

    const persistDraftCommand = async ({
        service, command, kind = 'draft', failureMessage = '草稿保存失败', notify
    } = {}) => {
        if (typeof notify !== 'function') {
            const error = new Error('REVIEW_SESSION_COMMAND_NOTIFY_REQUIRED');
            error.code = 'REVIEW_SESSION_COMMAND_NOTIFY_REQUIRED';
            throw error;
        }
        if (!service || typeof service.persistReviewDraftCommand !== 'function' ||
            typeof service.persistReviewImageCommand !== 'function') {
            const error = new Error('REVIEW_SESSION_COMMAND_SERVICE_REQUIRED');
            error.code = 'REVIEW_SESSION_COMMAND_SERVICE_REQUIRED';
            throw error;
        }
        try {
            return kind === 'image'
                ? await service.persistReviewImageCommand(command)
                : await service.persistReviewDraftCommand(command);
        } catch (error) {
            // Keep unsaved editor input; the persisted version is unchanged.
            notify(`${failureMessage}：${error?.code || error?.message || 'storage-failure'}`);
            return null;
        }
    };

    // One instance owns the review page's refs. app.js aliases these refs rather
    // than maintaining a second editor/session state.
    const createReviewSession = ({ ref, fields, storage, persistence } = {}) => {
        if (typeof ref !== 'function' || typeof fields?.snapshotDraftEditorFields !== 'function' ||
            typeof storage?.listRecentTasks !== 'function' || typeof persistence?.reloadDraftBatch !== 'function') {
            throw new Error('REVIEW_SESSION_DEPENDENCY_REQUIRED');
        }
        const refs = Object.freeze({
            activeBatchId: ref(''), activeDraftQuestionId: ref(''), activeDraftTab: ref('stem'),
            selectedDraftIds: ref([]), batchImportMode: ref('list'), batchImportFilter: ref('all'),
            batchImportBatches: ref([]), batchImportFiles: ref([]), batchDraftQuestions: ref([]),
            batchDraftImages: ref([]), unmatchedAnswers: ref([]),
            activeDraftEditorBuffer: ref(''), activeDraftEditorOriginal: ref(''),
            activeDraftEditorOriginalFields: ref({}), activeDraftEditorQuestionId: ref('')
        });
        let readEpoch = 0, interactionEpoch = 0, disposed = false, loadedBatchId = '';
        const cleanups = [];
        const current = () => {
            if (!refs.activeBatchId.value) return null;
            const list = refs.batchDraftQuestions.value.filter(q => q.batchId === refs.activeBatchId.value);
            return list.find(q => q.id === refs.activeDraftQuestionId.value) || list[0] || null;
        };
        const dirty = () => {
            const q = current();
            return Boolean(q) && (refs.activeDraftEditorBuffer.value !== refs.activeDraftEditorOriginal.value ||
                fields.draftEditorFieldSignature(q) !== JSON.stringify(refs.activeDraftEditorOriginalFields.value));
        };
        const syncCurrent = sourceFor => {
            const q = current();
            const source = q ? sourceFor(q) : '';
            refs.activeDraftEditorBuffer.value = source;
            refs.activeDraftEditorOriginal.value = source;
            refs.activeDraftEditorOriginalFields.value = q ? fields.snapshotDraftEditorFields(q) : {};
            refs.activeDraftEditorQuestionId.value = q?.id || '';
        };
        const discard = () => {
            refs.activeDraftEditorBuffer.value = refs.activeDraftEditorOriginal.value;
            const q = current();
            if (q) fields.restoreDraftEditorFields(q, refs.activeDraftEditorOriginalFields.value);
        };
        const leaveBatch = (confirmLeave = () => false) => {
            if (dirty() && !confirmLeave('当前题目有未保存修改，离开批次将放弃这些修改，是否继续？')) return false;
            ++readEpoch; ++interactionEpoch;
            refs.activeBatchId.value = '';
            refs.activeDraftQuestionId.value = '';
            refs.selectedDraftIds.value = [];
            syncCurrent(() => '');
            return true;
        };
        const reload = async () => {
            const request = ++readEpoch, batchId = refs.activeBatchId.value;
            const recent = await storage.listRecentTasks();
            const loaded = batchId ? await persistence.reloadDraftBatch(batchId) : null;
            if (disposed || request !== readEpoch || batchId !== refs.activeBatchId.value) return false;
            refs.batchImportBatches.value = recent;
            if (loaded) {
                if (loadedBatchId !== batchId) refs.selectedDraftIds.value = [];
                refs.batchImportFiles.value = loaded.files;
                refs.batchDraftQuestions.value = loaded.questions;
                refs.batchDraftImages.value = loaded.images;
                refs.unmatchedAnswers.value = loaded.batch?.unmatchedAnswers || [];
                loadedBatchId = batchId;
            }
            return true;
        };
        const openBatch = async (batchId, { sourceFor, afterRender = async () => {}, confirmLeave } = {}) => {
            if (disposed) return false;
            if (batchId === refs.activeBatchId.value && dirty()) return true;
            if (dirty() && !confirmLeave?.('当前题目有未保存修改，切换批次将放弃这些修改，是否继续？')) return false;
            ++interactionEpoch;
            refs.activeBatchId.value = batchId;
            refs.activeDraftQuestionId.value = '';
            refs.selectedDraftIds.value = [];
            refs.batchImportMode.value = 'review';
            refs.batchImportFilter.value = 'all';
            refs.activeDraftTab.value = 'stem';
            if (!await reload()) return false;
            refs.activeDraftQuestionId.value = current()?.id || '';
            const id = refs.activeDraftQuestionId.value;
            await afterRender();
            if (disposed || refs.activeBatchId.value !== batchId || refs.activeDraftQuestionId.value !== id) return false;
            syncCurrent(sourceFor);
            return true;
        };
        const captureNavigation = () => ({ epoch: interactionEpoch, batchId: refs.activeBatchId.value });
        const adoptImportResult = async (result, visit, { sourceFor, afterRender } = {}) => {
            if (disposed || !visit || visit.epoch !== interactionEpoch || visit.batchId !== refs.activeBatchId.value || dirty() ||
                (visit.batchId && visit.batchId !== result.batchId)) return false;
            if (!result.batchId || result.readback?.batch?.id !== result.batchId) throw new Error('IMPORT_REVIEW_IDENTITY_INVALID');
            return openBatch(result.batchId, { sourceFor, afterRender });
        };

        const select = async (id, { sourceFor, afterRender = async () => {}, confirmLeave } = {}) => {
            const decision = resolveSelection({ currentId: refs.activeDraftQuestionId.value, nextId: id, dirty: dirty() });
            if (disposed || decision === 'noop') return false;
            if (decision === 'prompt') {
                if (!confirmLeave?.('当前题目的 LaTeX 有未保存修改。切换题目将放弃这些修改，是否继续？')) return false;
                discard();
            }
            const batchId = refs.activeBatchId.value;
            ++interactionEpoch;
            refs.activeDraftQuestionId.value = id;
            refs.activeDraftTab.value = 'stem';
            await afterRender();
            if (disposed || refs.activeBatchId.value !== batchId || refs.activeDraftQuestionId.value !== id) return false;
            syncCurrent(sourceFor);
            return true;
        };
        const protectExit = ({ target, getQuestion = current } = {}) => {
            const handler = event => {
                if (!getQuestion() || !dirty()) return;
                event.preventDefault(); event.returnValue = '';
            };
            target.addEventListener('beforeunload', handler);
            cleanups.push(() => target.removeEventListener('beforeunload', handler));
        };
        const capture = () => {
            const q = current();
            return refs.activeBatchId.value ? { epoch: interactionEpoch, batchId: refs.activeBatchId.value, draftId: q?.id || '',
                source: refs.activeDraftEditorBuffer.value, signature: q ? fields.draftEditorFieldSignature(q) : '' } : null;
        };
        const matches = token => !disposed && token && token.epoch === interactionEpoch && refs.activeBatchId.value === token.batchId && (current()?.id || '') === token.draftId;
        // Accept only a verified persistence receipt for the same page visit.
        // Later source/metadata edits remain unsaved; no broad readback discards them.
        const acceptImageResult = (token, result, sourceFor) => {
            if (!matches(token)) return false;
            const draft = result.draft;
            if (draft) {
                const target = refs.batchDraftQuestions.value.find(row => row.id === draft.id && row.batchId === token.batchId);
                if (!target || Number(target.version) > Number(draft.version)) return false;
                const isActive = target.id === token.draftId;
                const baseline = JSON.parse(token.signature || '{}');
                const currentFields = isActive ? fields.snapshotDraftEditorFields(target) : {};
                const pending = Object.fromEntries(Object.entries(currentFields).filter(([key, value]) =>
                    JSON.stringify(value) !== JSON.stringify(baseline[key])));
                const source = isActive ? sourceFor(draft) : '';
                Object.assign(target, draft);
                if (Object.keys(pending).length) fields.restoreDraftEditorFields(target, { ...fields.snapshotDraftEditorFields(draft), ...pending });
                if (isActive) {
                    if (refs.activeDraftEditorBuffer.value === token.source) refs.activeDraftEditorBuffer.value = source;
                    refs.activeDraftEditorOriginal.value = source;
                    refs.activeDraftEditorOriginalFields.value = fields.snapshotDraftEditorFields(draft);
                    refs.activeDraftEditorQuestionId.value = draft.id;
                }
            }
            const updates = result.image ? [result.image] : (result.images || []);
            const byId = new Map(updates.filter(row => row.batchId === token.batchId).map(row => [row.id, row]));
            const present = new Set(refs.batchDraftImages.value.map(row => row.id));
            refs.batchDraftImages.value = refs.batchDraftImages.value.map(row => byId.get(row.id) || row)
                .concat([...byId.values()].filter(row => !present.has(row.id)));
            return true;
        };

        const reconcile = async (token, sourceFor) => {
            if (!matches(token)) return false;
            const recent = await storage.listRecentTasks();
            const loaded = await persistence.reloadDraftBatch(token.batchId);
            if (!matches(token)) return false;
            const receiptToken = { ...token, source: refs.activeDraftEditorOriginal.value,
                signature: JSON.stringify(refs.activeDraftEditorOriginalFields.value) };
            const active = loaded.questions.find(row => row.id === token.draftId);
            if (active) acceptImageResult(receiptToken, { draft: active, images: loaded.images }, sourceFor);
            const currentById = new Map(refs.batchDraftQuestions.value.map(row => [row.id, row]));
            refs.batchDraftQuestions.value = loaded.questions.map(row => {
                const live = currentById.get(row.id);
                if (row.id === token.draftId || (live && Number(live.version) > Number(row.version))) return live || row;
                return row;
            });
            refs.batchImportBatches.value = recent;
            refs.batchImportFiles.value = loaded.files;
            refs.unmatchedAnswers.value = loaded.batch?.unmatchedAnswers || [];
            if (!active) refs.batchDraftImages.value = loaded.images;
            return true;
        };

        const save = async ({ images, prepareDraft, refreshStats, notify, silent = false } = {}) => {
            const q = current(), token = capture();
            if (!q || q.status === 'submitted') return false;
            const prepared = prepareDraft({ question: q, source: token.source, images });
            const result = await persistDraftCommand({ service: persistence,
                command: { batchId: q.batchId, draft: prepared.draft, expectedDraftVersion: q.version }, notify });
            if (!result) return false;
            if (matches(token)) {
                const target = current();
                if (Number(target.version) > Number(result.draft.version)) return false;
                const baseline = JSON.parse(token.signature);
                const pending = Object.fromEntries(Object.entries(fields.snapshotDraftEditorFields(target)).filter(([key, value]) =>
                    JSON.stringify(value) !== JSON.stringify(baseline[key])));
                Object.assign(target, result.draft);
                if (Object.keys(pending).length) fields.restoreDraftEditorFields(target, { ...fields.snapshotDraftEditorFields(result.draft), ...pending });
                if (refs.activeDraftEditorBuffer.value === token.source) refs.activeDraftEditorBuffer.value = prepared.source;
                refs.activeDraftEditorOriginal.value = prepared.source;
                refs.activeDraftEditorOriginalFields.value = fields.snapshotDraftEditorFields(result.draft);
                refs.activeDraftEditorQuestionId.value = q.id;
            }
            try { await refreshStats(q.batchId); }
            catch (error) {
                if (matches(token)) notify('草稿已保存，统计刷新失败：' + (error?.code || error?.message || 'storage-failure'));
                return false;
            }
            if (!matches(token)) return false;
            const complete = !dirty();
            if (!silent) notify(complete ? '题目 LaTeX 已保存。' : '本次内容已保存，仍有新的未保存修改。');
            return complete;
        };
        const dispose = () => {
            disposed = true; ++readEpoch;
            for (const cleanup of cleanups.splice(0)) cleanup();
        };
        return Object.freeze({ refs, current, dirty, syncCurrent, discard, leaveBatch, reload, openBatch, captureNavigation, adoptImportResult, select, protectExit, capture, isCurrent: matches, acceptImageResult, acceptCommandResult: acceptImageResult, reconcile, save, dispose });
    };

    return Object.freeze({ resolveSelection, persistDraftCommand, createReviewSession });
});
