(function initReviewBatchConfirm(root, factory) {
    const api = factory(root);
    root.Qisi = root.Qisi || {};
    root.Qisi.ReviewBatchConfirm = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    // Pure selection and batch-confirm planning. The workflow service call, the
    // persistence and the toast stay in app.js; this module only decides what to do.
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

    return Object.freeze({ toggleSelection, selectAllVisible, eligibleDrafts, batchConfirmNotice });
});
