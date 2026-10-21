(function initLibraryImageResources(root, factory) {
    const api = factory(root);
    root.Qisi = root.Qisi || {};
    root.Qisi.LibraryImageResources = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    // Library read projection: normalise question rows and attach display URLs for
    // their image rows. Object URL creation/ownership and storage stay with app.js
    // (it passes createObjectUrl / rememberUrl / storage); this module never revokes.
    const requireDependency = (value, code) => {
        if (typeof value !== 'function') {
            const error = new Error(code);
            error.code = code;
            throw error;
        }
        return value;
    };

    const normalizeRows = (items, applyOptionSplit) => {
        const splitOptions = requireDependency(applyOptionSplit, 'LIBRARY_IMAGE_RESOURCES_OPTION_SPLIT_REQUIRED');
        const list = Array.isArray(items) ? items : [];
        for (const q of list) {
            if (!Array.isArray(q.options)) q.options = ['', '', '', ''];
            if (!Array.isArray(q.images)) q.images = [];
            splitOptions(q);
            if (!q.knowledge && !q.meta?.knowledge) q.knowledge = '';
            q.knowledgeType = q.knowledgeType || q.meta?.knowledgeType || 'system';
            q.systemKnowledge = q.systemKnowledge || q.meta?.systemKnowledge ||
                (q.knowledgeType === 'system' ? q.knowledge || q.meta?.knowledge || '' : '');
            q.personalKnowledge = q.personalKnowledge || q.meta?.personalKnowledge ||
                (q.knowledgeType === 'personal' ? q.knowledge || q.meta?.knowledge || '' : '');
        }
        return list;
    };

    const collectImageIds = list => {
        const wanted = new Set();
        for (const q of list) {
            for (const image of q.images || []) {
                const id = String(image?.id || '');
                if (id) wanted.add(id);
            }
        }
        return wanted;
    };

    const attachImageUrls = async ({ items, storage, createObjectUrl, rememberUrl, applyOptionSplit, warn } = {}) => {
        const list = normalizeRows(items, applyOptionSplit);
        const loadImageRecords = requireDependency(storage?.loadImageRecords, 'LIBRARY_IMAGE_RESOURCES_STORAGE_REQUIRED');
        const create = requireDependency(createObjectUrl, 'LIBRARY_IMAGE_RESOURCES_URL_FACTORY_REQUIRED');
        const remember = typeof rememberUrl === 'function' ? rememberUrl : () => {};
        const notify = typeof warn === 'function' ? warn : () => {};

        const wantedIds = collectImageIds(list);
        const blobRows = wantedIds.size ? await loadImageRecords([...wantedIds]) : [];
        const blobById = new Map(blobRows.map(row => [String(row?.id || ''), row]));

        for (const q of list) {
            for (const image of q.images) {
                const blobRow = blobById.get(String(image?.id || ''));
                if (blobRow?.blob) {
                    image.url = create(blobRow.blob);
                    image.displayable = true;
                    image.missingBlob = false;
                    remember(image.url);
                } else {
                    image.url = '';
                    image.displayable = false;
                    image.missingBlob = true;
                    notify('[QUESTION_IMAGE][missing-blob]', { questionId: q.id, imageId: image.id });
                }
            }
        }
        return list;
    };

    return Object.freeze({ normalizeRows, collectImageIds, attachImageUrls });
});
