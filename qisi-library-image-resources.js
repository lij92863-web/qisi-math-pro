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

    const prepareStoredRows = (items, applyOptionSplit) => {
        const list = normalizeRows(items, applyOptionSplit);
        for (const row of list) {
            row.images = row.images.filter(image => image?.id).map(image => ({
                ...image, storageImage: true, url: '', displayable: undefined, missingBlob: undefined
            }));
        }
        return list;
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

    let reader;
    const configureStoredImages = ({ storage, createObjectUrl, revokeObjectUrl }) => {
        const active = new Map(), scheduled = new Set();
        let flushScheduled = false;
        const flush = async () => {
            flushScheduled = false;
            const batch = [...scheduled].filter(entry => {
                if (entry.users) return true;
                entry.resolve('');
                return false;
            });
            scheduled.clear();
            if (!batch.length) return;
            try {
                const loaded = new Map((await storage.loadImageRecords(batch.map(entry => entry.id))).map(row => [String(row.id), row.blob]));
                for (const entry of batch) {
                    const blob = loaded.get(entry.id);
                    entry.url = entry.users && blob ? createObjectUrl(blob) : '';
                    entry.resolve(entry.url);
                }
            } catch (error) {
                batch.forEach(entry => entry.reject(error));
            }
        };
        reader = images => {
            const entries = new Map();
            for (const image of images) {
                if (!image?.storageImage || image.url) continue;
                const id = String(image.id);
                if (entries.has(id)) continue;
                let entry = active.get(id);
                if (!entry) {
                    entry = { id, url: '', users: 0 };
                    entry.ready = new Promise((resolve, reject) => Object.assign(entry, { resolve, reject }));
                    active.set(id, entry);
                    scheduled.add(entry);
                    if (!flushScheduled) { flushScheduled = true; queueMicrotask(flush); }
                }
                entry.users++;
                entries.set(id, entry);
            }
            let held = true;
            return {
                ready: Promise.all([...entries.values()].map(entry => entry.ready)).then(() => images.map(image => {
                    const entry = image?.storageImage && !image.url && entries.get(String(image.id));
                    return entry ? { ...image, url: entry.url, displayable: Boolean(entry.url), missingBlob: !entry.url } : image;
                })),
                release() {
                    if (!held) return;
                    held = false;
                    for (const entry of entries.values()) {
                        if (--entry.users) continue;
                        if (active.get(entry.id) === entry) active.delete(entry.id);
                        if (entry.url) revokeObjectUrl(entry.url);
                    }
                }
            };
        };
        return { invalidate(ids) {
            if (!ids) active.clear();
            else for (const id of ids) active.delete(String(id));
        } };
    };
    const openStoredImages = (images = []) => reader ? reader(images) : { ready: Promise.resolve(images), release() {} };
    const useStoredImages = (source, { shallowRef, watch, nextTick }) => {
        const output = shallowRef([]);
        watch(source, (images, _previous, onCleanup) => {
            output.value = images;
            if (!images.some(image => image?.storageImage && !image.url)) return;
            let current = true;
            const lease = openStoredImages(images);
            onCleanup(() => { current = false; nextTick(lease.release); });
            lease.ready.then(rows => { if (current) output.value = rows; }).catch(error => {
                if (current) console.warn('题图读取失败', error);
            });
        }, { immediate: true });
        return output;
    };

    return Object.freeze({ normalizeRows, prepareStoredRows, collectImageIds, attachImageUrls, createUrlScope,
        retainImageResources, configureStoredImages, openStoredImages, useStoredImages });
});
