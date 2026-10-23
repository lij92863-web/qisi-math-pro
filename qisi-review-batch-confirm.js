(function initReviewBatchConfirm(root, factory) {
    const api = factory(root);
    root.Qisi = root.Qisi || {};
    root.Qisi.ReviewBatchConfirm = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    // Selection plans and guarded single/batch review action coordination.
    const toggleSelection = (selectedIds, id) => {
        const key = String(id || '');
        const current = Array.isArray(selectedIds) ? selectedIds : [];
        if (!key) return current;
        return current.includes(key)
            ? current.filter(item => item !== key)
            : [...current, key];
    };

    const selectAllVisible = (selectedIds, visibleIds) => {
        const current = Array.isArray(selectedIds) ? selectedIds : [];
        const visible = (Array.isArray(visibleIds) ? visibleIds : []).filter(Boolean);
        const allSelected = visible.length > 0 && visible.every(id => current.includes(id));
        return allSelected
            ? current.filter(id => !visible.includes(id))
            : [...new Set([...current, ...visible])];
    };

    const eligibleDrafts = (drafts, ids) => {
        const list = Array.isArray(drafts) ? drafts : [];
        return (Array.isArray(ids) ? ids : [])
            .map(id => list.find(draft => draft.id === id))
            .filter(draft => draft && draft.status !== 'submitted' && draft.status !== 'reviewed');
    };

    const batchConfirmNotice = (confirmedCount, failedCount) => (
        failedCount
            ? `已确认 ${confirmedCount} 题，${failedCount} 题未通过。`
            : `已确认 ${confirmedCount} 题。`
    );

    // Both page actions use the existing workflow service. This owner controls
    // action order and reentrancy; admission and transaction policy stay there.
    const createReviewActions = ({ session, workflow, editor, sourceFor,
        refreshLibrary, notify, reportFailure, errorText, actorId = 'local-teacher' } = {}) => {
        for (const port of [session?.capture, session?.isCurrent, session?.save, session?.reconcile,
            session?.acceptCommandResult, workflow?.confirmDraft, workflow?.submitDraft,
            editor?.prepareDraft, editor?.imagesFor, editor?.refreshStats,
            sourceFor, refreshLibrary, notify, reportFailure, errorText]) {
            if (typeof port !== 'function') throw new Error('REVIEW_ACTION_PORT_REQUIRED');
        }
        const activeSingles = new Set(), activeBatches = new Set();
        const saveCurrent = () => session.save({ images: editor.imagesFor(session.current()),
            prepareDraft: editor.prepareDraft, refreshStats: editor.refreshStats, notify, silent: true });
        const getDraft = (batchId, id) => session.refs.batchDraftQuestions.value.find(row => row.batchId === batchId && row.id === id);
        const sync = async token => {
            if (!session.isCurrent(token)) return false;
            try { return await session.reconcile(token, sourceFor); }
            catch (error) { if (session.isCurrent(token)) notify('操作结果需刷新核对：' + errorText(error)); return false; }
        };
        const confirmAndSubmit = async (questionId = session.current()?.id) => {
            const id = String(questionId || ''), initial = session.capture();
            if (!id || !initial) return false;
            const key = initial.batchId + ':' + id;
            if (activeSingles.has(key) || activeBatches.has(initial.batchId)) return false;
            let draft = getDraft(initial.batchId, id);
            if (!draft) return false;
            if (draft.status === 'submitted') { notify('该题已经入库。'); return true; }
            activeSingles.add(key);
            let token = initial, stage = 'save';
            try {
                if (id === session.current()?.id && session.dirty() && !await saveCurrent()) return false;
                if (!session.isCurrent(initial)) return false;
                token = session.capture(); draft = getDraft(token.batchId, id);
                if (!draft || (id === token.draftId && session.dirty())) return false;
                if (draft.status !== 'reviewed') {
                    stage = 'confirm';
                    const confirmed = await workflow.confirmDraft({ batchId: draft.batchId, draftId: id,
                        expectedDraftVersion: draft.version, actorId });
                    if (!confirmed.accepted) {
                        if (session.isCurrent(token)) reportFailure(confirmed.validation?.errors?.[0]?.message || '题目校验失败，暂时不能入库。');
                        return false;
                    }
                    if (session.isCurrent(token)) session.acceptCommandResult(token, { draft: confirmed.draft }, sourceFor);
                    draft = confirmed.draft;
                }
                // A confirmation already persisted is never described as rolled
                // back. New input or navigation stops the automatic next action.
                if (!session.isCurrent(token) || session.dirty()) {
                    if (session.isCurrent(token)) notify('该题已确认；新的未保存编辑尚未入库。');
                    return false;
                }
                stage = 'submit';
                const submitted = await workflow.submitDraft({ batchId: draft.batchId, draftId: id,
                    expectedDraftVersion: draft.version, actorId });
                if (!submitted.accepted) {
                    if (session.isCurrent(token)) reportFailure('该题已确认，入库未完成：' +
                        (submitted.validation?.errors?.[0]?.message || submitted.decision?.errors?.[0]?.message || '正式入库准入校验失败。'));
                    await sync(token); return false;
                }
                if (session.isCurrent(token) && submitted.draft) session.acceptCommandResult(token, { draft: submitted.draft }, sourceFor);
                stage = 'refresh';
                // The library loader is invoked without a review batch. Review
                // reconciliation below owns its editor-preserving readback.
                await refreshLibrary();
                if (!await sync(token)) return false;
                const clean = !session.dirty();
                notify(clean ? '已确认并入库。' : '已确认并入库；后续新输入尚未入库，请保留并核对。'); return clean;
            } catch (error) {
                await sync(token);
                if (session.isCurrent(token)) {
                    const stored = getDraft(token.batchId, id);
                    const fact = stored?.status === 'submitted' ? '该题已入库，后续刷新未完成：'
                        : stored?.status === 'reviewed' || stage === 'submit' ? '该题已确认，入库未完成：' : '操作未完成：';
                    reportFailure(fact + errorText(error));
                }
                return false;
            } finally { activeSingles.delete(key); }
        };
        const confirmSelected = async () => {
            const ids = [...new Set(session.refs.selectedDraftIds.value)];
            if (!ids.length) { notify('请先勾选要确认的题目。'); return false; }
            const initial = session.capture(); if (!initial || activeBatches.has(initial.batchId) ||
                [...activeSingles].some(key => key.startsWith(initial.batchId + ':'))) return false;
            activeBatches.add(initial.batchId);
            let token = initial, confirmedCount = 0;
            const failed = [];
            try {
                if (session.dirty() && !await saveCurrent()) return false;
                if (!session.isCurrent(initial)) return false;
                token = session.capture();
                const drafts = eligibleDrafts(session.refs.batchDraftQuestions.value.filter(row => row.batchId === token.batchId), ids);
                for (let index = 0; index < drafts.length; index++) {
                    if (!session.isCurrent(token)) return false;
                    if (session.dirty()) { failed.push(...drafts.slice(index).map(row => row.id)); break; }
                    const draft = getDraft(token.batchId, drafts[index].id);
                    if (!draft || draft.status === 'submitted' || draft.status === 'reviewed') continue;
                    try {
                        const result = await workflow.confirmDraft({ batchId: draft.batchId, draftId: draft.id,
                            expectedDraftVersion: draft.version, actorId });
                        if (result.accepted) {
                            ++confirmedCount;
                            if (session.isCurrent(token)) session.acceptCommandResult(token, { draft: result.draft }, sourceFor);
                        } else failed.push(draft.id);
                    } catch (_error) { failed.push(draft.id); }
                }
                if (!session.isCurrent(token)) return false;
                // Selection changes made after the click remain the user's own.
                const current = session.refs.selectedDraftIds.value;
                session.refs.selectedDraftIds.value = [...current.filter(id => !ids.includes(id)),
                    ...failed.filter(id => current.includes(id))];
                const refreshed = await sync(token);
                if (session.isCurrent(token)) notify(batchConfirmNotice(confirmedCount, failed.length) +
                    (refreshed ? '' : '读回未完成，请刷新核对。'));
                return refreshed && failed.length === 0;
            } finally { activeBatches.delete(initial.batchId); }
        };
        return Object.freeze({ confirmAndSubmit, confirmSelected });
    };

    return Object.freeze({ toggleSelection, selectAllVisible, eligibleDrafts, batchConfirmNotice, createReviewActions });
});
