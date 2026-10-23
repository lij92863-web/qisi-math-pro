(function initLibrarySnapshot(root, factory) {
    const api = factory(root);
    root.Qisi = root.Qisi || {};
    root.Qisi.LibrarySnapshot = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    // Domain reads retain their original order and range. The loader prepares a
    // detached display snapshot, publishes it once, then retires its old resources.
    const rows = value => (Array.isArray(value) ? value.filter(row => row && typeof row === 'object') : []);


    const displayRows = value => (Array.isArray(value) ? value : []).map(row => {
        if (!row || typeof row !== 'object') return row;
        return { ...row,
            options: Array.isArray(row.options) ? [...row.options] : row.options,
            images: Array.isArray(row.images) ? row.images.map(image => image && typeof image === 'object' ? { ...image } : image) : row.images
        };
    });

    const requireStorage = (storage, methods) => {
        if (methods.some(name => typeof storage?.[name] !== 'function')) {
            const error = new Error('LIBRARY_SNAPSHOT_STORAGE_REQUIRED');
            error.code = 'LIBRARY_SNAPSHOT_STORAGE_REQUIRED'; throw error;
        }
    };
    const readQuestionLibrary = async ({ storage, attachImages = async () => {} } = {}) => {
        requireStorage(storage, ['loadLibrary']);
        const questions = displayRows(await storage.loadLibrary());
        if (typeof attachImages === 'function') await attachImages(questions, 'library');
        return { questions: rows(questions) };
    };
    const readExternalLibrary = async ({ storage, attachImages = async () => {} } = {}) => {
        requireStorage(storage, ['listTable']);
        const external = displayRows(await storage.listTable('externalQuestions', { orderBy: 'importedAt', reverse: true }));
        if (typeof attachImages === 'function') await attachImages(external, 'external');
        const importBatches = await storage.listTable('importBatches', { orderBy: 'importedAt', reverse: true });
        return { externalQuestions: rows(external), importBatches };
    };
    const readRecentTasks = async ({ storage } = {}) => {
        requireStorage(storage, ['listRecentTasks']);
        return { recentTasks: await storage.listRecentTasks() };
    };
    const readReviewWorkspace = async ({ draftPersistence, batchId } = {}) => {
        if (!batchId) return { activeDraft: null };
        if (typeof draftPersistence?.reloadDraftBatch !== 'function') {
            const error = new Error('LIBRARY_SNAPSHOT_DRAFT_PERSISTENCE_REQUIRED');
            error.code = 'LIBRARY_SNAPSHOT_DRAFT_PERSISTENCE_REQUIRED'; throw error;
        }
        return { activeDraft: await draftPersistence.reloadDraftBatch(batchId) };
    };
    const readTemplates = async ({ storage } = {}) => {
        requireStorage(storage, ['listTable']);
        return { customTemplates: await storage.listTable('customTemplates', { orderBy: 'createdAt', reverse: true }) };
    };
    const readPersonalKnowledge = async ({ storage } = {}) => {
        requireStorage(storage, ['get']);
        const saved = await storage.get('personalKnowledge', 'tree');
        return { personalKnowledgeTree: Array.isArray(saved?.nodes) ? saved.nodes : [] };
    };
    const loadLibrarySnapshot = async (ports = {}) => {
        requireStorage(ports.storage, ['loadLibrary', 'listTable']);
        // Deliberately sequential, retaining the compatibility entry's read order.
        const library = await readQuestionLibrary(ports);
        const external = await readExternalLibrary(ports);
        const recent = await readRecentTasks(ports);
        const review = await readReviewWorkspace(ports);
        const templates = await readTemplates(ports);
        const knowledge = await readPersonalKnowledge(ports);
        return { ...library, ...external, ...recent, ...review, ...templates, ...knowledge };
    };

    const createLibraryLoader = ({
        storage, draftPersistence, imageResources, urlPort, applyOptionSplit,
        fingerprint, publish, afterPublish = async () => {}, warn
    } = {}) => {
        if (typeof imageResources?.createUrlScope !== 'function' ||
            typeof imageResources?.attachImageUrls !== 'function' ||
            typeof fingerprint?.core !== 'function' || typeof fingerprint?.stem !== 'function' ||
            typeof publish !== 'function' || typeof afterPublish !== 'function') {
            throw new Error('LIBRARY_SNAPSHOT_LOADER_DEPENDENCY_REQUIRED');
        }
        let disposed = false;
        const epochs = { library: 0, external: 0 }, currentScopes = new Map(), scopes = new Set();
        const release = scope => { if (scope && scopes.delete(scope)) scope.dispose(); };
        const releaseUnused = scope => {
            if (![...currentScopes.values()].includes(scope)) release(scope);
        };
        const run = async (domain, batchId = '') => {
            if (disposed) return false;
            const keys = domain === 'library' ? ['library'] : domain === 'external' ? ['external'] : ['library', 'external'];
            const request = Object.fromEntries(keys.map(key => [key, ++epochs[key]]));
            const current = () => !disposed && keys.every(key => request[key] === epochs[key]);
            const preparedScopes = new Map(keys.map(key => {
                const scope = imageResources.createUrlScope(urlPort); scopes.add(scope); return [key, scope];
            }));
            const releasePrepared = () => { for (const scope of preparedScopes.values()) release(scope); };
            const ports = { storage, draftPersistence, batchId,
                attachImages: (items, key) => imageResources.attachImageUrls({ items, storage,
                    applyOptionSplit, createObjectUrl: preparedScopes.get(key).create, warn }) };
            let snapshot;
            try {
                if (domain === 'all') snapshot = { ...await loadLibrarySnapshot(ports), batchId };
                else if (domain === 'banks') {
                    const library = await readQuestionLibrary(ports), external = await readExternalLibrary(ports);
                    snapshot = { ...library, ...external, domain };
                } else snapshot = { ...await (domain === 'library' ? readQuestionLibrary(ports) : readExternalLibrary(ports)), domain };
                if (Object.hasOwn(snapshot, 'questions')) {
                    const core = new Map(), stem = new Map();
                    for (const question of snapshot.questions) {
                        const coreKey = fingerprint.core(question), stemKey = fingerprint.stem(question);
                        if (coreKey && !core.has(coreKey)) core.set(coreKey, question);
                        if (stemKey && !stem.has(stemKey)) stem.set(stemKey, question);
                    }
                    snapshot = { ...snapshot, coreFingerprintMap: core, stemFingerprintMap: stem };
                }
            } catch (error) {
                releasePrepared(); if (!current()) return false; throw error;
            }
            if (!current()) { releasePrepared(); return false; }
            const previous = new Set(keys.map(key => currentScopes.get(key)).filter(Boolean));
            try { publish(snapshot); } catch (error) { releasePrepared(); throw error; }
            for (const [key, scope] of preparedScopes) currentScopes.set(key, scope);
            // A render failure keeps both published and uncertain old resources;
            // dispose owns those retained scopes, as in the full-refresh contract.
            await afterPublish();
            for (const scope of previous) releaseUnused(scope);
            return true;
        };
        const dispose = () => {
            if (disposed) return;
            disposed = true; ++epochs.library; ++epochs.external;
            for (const scope of [...scopes]) release(scope);
            currentScopes.clear();
        };
        return Object.freeze({ refresh: batchId => run('all', batchId),
            refreshLibrary: () => run('library'), refreshExternal: () => run('external'),
            refreshQuestionBanks: () => run('banks'), dispose });
    };

    return Object.freeze({ readQuestionLibrary, readExternalLibrary, readRecentTasks, readReviewWorkspace, readTemplates, readPersonalKnowledge, loadLibrarySnapshot, createLibraryLoader });
});
