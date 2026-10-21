(function initPrintResources(root, factory) {
    const api = factory(root);
    root.Qisi = root.Qisi || {};
    root.Qisi.PrintResources = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    // Print-time resource hydration: clone the paper questions and attach data URLs
    // for their image blobs. The page owns the database read and the blob encoder.
    const collectImageIds = questions => [...new Set((Array.isArray(questions) ? questions : [])
        .flatMap(question => (question?.images || []).map(image => image?.id))
        .filter(Boolean))];

    const hydrateQuestionsForPrint = async ({ questions, loadImageRows, blobToDataUrl } = {}) => {
        if (typeof loadImageRows !== 'function' || typeof blobToDataUrl !== 'function') {
            const error = new Error('PRINT_RESOURCES_DEPENDENCY_REQUIRED');
            error.code = 'PRINT_RESOURCES_DEPENDENCY_REQUIRED';
            throw error;
        }
        const list = Array.isArray(questions) ? questions : [];
        const ids = collectImageIds(list);
        const imageRows = ids.length ? await loadImageRows(ids) : [];
        return Promise.all(list.map(async question => {
            const clone = {
                ...question,
                meta: question.meta ? { ...question.meta } : undefined,
                options: [...(question.options || [])]
            };
            clone.images = await Promise.all((question.images || []).map(async image => {
                const row = imageRows.find(item => item.id === image.id);
                if (row?.blob) return { ...image, url: await blobToDataUrl(row.blob) };
                return { ...image };
            }));
            return clone;
        }));
    };

    return Object.freeze({ collectImageIds, hydrateQuestionsForPrint });
});
