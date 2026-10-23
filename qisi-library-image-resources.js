(function initLibraryImageResources(root, factory) {
    const api = factory(root);
    root.Qisi = root.Qisi || {};
    root.Qisi.LibraryImageResources = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    // Read projections and an explicitly owned group of display URLs. Each load
    // owns a fresh scope; callers transfer or dispose the entire scope.
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

    const urlOwners = new Map();

    const createUrlScope = ({ createObjectUrl, revokeObjectUrl } = {}) => {
        const create = requireDependency(createObjectUrl, 'LIBRARY_IMAGE_RESOURCES_URL_FACTORY_REQUIRED');
        const revoke = requireDependency(revokeObjectUrl, 'LIBRARY_IMAGE_RESOURCES_URL_REVOKER_REQUIRED');
        const owned = new Set();
        let disposed = false, released = false, consumers = 0;
        const releaseIfUnused = () => {
            if (!disposed || consumers || released) return;
            released = true;
            for (const url of owned) { revoke(url); urlOwners.delete(url); }
            owned.clear();
        };
        const scope = Object.freeze({
            create(blob) {
                if (disposed) throw new Error('LIBRARY_IMAGE_RESOURCES_SCOPE_DISPOSED');
                const url = create(blob);
                owned.add(url);
                urlOwners.set(url, scope);
                return url;
            },
            retain() {
                if (released) return () => {};
                ++consumers;
                let held = true;
                return () => {
                    if (!held) return;
                    held = false;
                    --consumers;
                    releaseIfUnused();
                };
            },
            dispose() {
                if (disposed) return;
                disposed = true;
                releaseIfUnused();
            }
        });
        return scope;
    };

    // Question cards capture their editor images for the component lifetime.
    // Hold only the scopes actually referenced; no resource methods enter rows.
    const retainImageResources = images => {
        const scopes = new Set((images || []).map(image => urlOwners.get(image?.url)).filter(Boolean));
        const releases = [...scopes].map(scope => scope.retain());
        return () => { for (const release of releases) release(); };
    };

    return Object.freeze({ normalizeRows, collectImageIds, attachImageUrls, createUrlScope, retainImageResources });
});
