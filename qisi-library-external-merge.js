(function initLibraryExternalMerge(root, factory) {
    const api = factory(root);
    root.Qisi = root.Qisi || {};
    root.Qisi.LibraryExternalMerge = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    // Pure planning for "add external questions to the personal library". The commit,
    // the reload and the confirmation dialogs stay in app.js.
    const UNRESOLVED_STATUSES = Object.freeze(['similar', 'answerConflict']);

    const countUnresolved = items => (Array.isArray(items) ? items : [])
        .filter(item => UNRESOLVED_STATUSES.includes(item?.status) && item?.action === 'skip')
        .length;

    const buildMergeOperations = ({ items, findQuestion, getMatchInfo, fillQuestion, copyQuestion } = {}) => {
        const requireDependency = (value, code) => {
            if (typeof value !== 'function') {
                const error = new Error(code);
                error.code = code;
                throw error;
            }
            return value;
        };
        const getInfo = requireDependency(getMatchInfo, 'LIBRARY_EXTERNAL_MERGE_MATCH_HELPER_REQUIRED');
        const fill = requireDependency(fillQuestion, 'LIBRARY_EXTERNAL_MERGE_FILL_HELPER_REQUIRED');
        const copy = requireDependency(copyQuestion, 'LIBRARY_EXTERNAL_MERGE_COPY_HELPER_REQUIRED');
        const find = typeof findQuestion === 'function' ? findQuestion : () => null;

        const operations = [];
        for (const item of Array.isArray(items) ? items : []) {
            const external = item?.question;
            if (!external) continue;
            if (item.action === 'skip') {
                operations.push({ action: 'skip', externalId: external.id });
                continue;
            }
            if (item.action === 'fill') {
                const matchInfo = getInfo(external);
                const local = matchInfo?.matchedQuestion || find(item.matchedQuestionId);
                if (local) {
                    operations.push({
                        action: 'fill',
                        externalId: external.id,
                        question: fill(local, external, item),
                        expectedUpdatedAt: local.updatedAt
                    });
                    continue;
                }
            }
            if (item.action === 'add' || item.action === 'fill') {
                operations.push({ action: 'add', externalId: external.id, question: copy(external, item) });
            }
        }
        return operations;
    };

    return Object.freeze({ UNRESOLVED_STATUSES, countUnresolved, buildMergeOperations });
});
