(function initLibrarySnapshot(root, factory) {
    const api = factory(root);
    root.Qisi = root.Qisi || {};
    root.Qisi.LibrarySnapshot = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    // Domain read-back for the library page. The caller keeps the object URL set and
    // the ref assignment; this module performs the reads in the original order so a
    // refresh cannot silently drop a domain or reorder the images.
    const rows = value => (Array.isArray(value) ? value.filter(row => row && typeof row === 'object') : []);

    const loadLibrarySnapshot = async ({ storage, draftPersistence, batchId, attachImages } = {}) => {
        if (!storage || typeof storage.loadLibrary !== 'function' || typeof storage.listTable !== 'function') {
            const error = new Error('LIBRARY_SNAPSHOT_STORAGE_REQUIRED');
            error.code = 'LIBRARY_SNAPSHOT_STORAGE_REQUIRED';
            throw error;
        }
        const attach = typeof attachImages === 'function' ? attachImages : async () => {};

        const library = await storage.loadLibrary();
        await attach(library);
        const external = await storage.listTable('externalQuestions', { orderBy: 'importedAt', reverse: true });
        await attach(external);
        const importBatches = await storage.listTable('importBatches', { orderBy: 'importedAt', reverse: true });
        const recentTasks = await storage.listRecentTasks();
        let activeDraft = null;
        if (batchId) {
            if (!draftPersistence || typeof draftPersistence.reloadDraftBatch !== 'function') {
                const error = new Error('LIBRARY_SNAPSHOT_DRAFT_PERSISTENCE_REQUIRED');
                error.code = 'LIBRARY_SNAPSHOT_DRAFT_PERSISTENCE_REQUIRED';
                throw error;
            }
            activeDraft = await draftPersistence.reloadDraftBatch(batchId);
        }
        const customTemplates = await storage.listTable('customTemplates', { orderBy: 'createdAt', reverse: true });
        const savedPersonalKnowledge = await storage.get('personalKnowledge', 'tree');

        return {
            questions: rows(library),
            externalQuestions: rows(external),
            importBatches,
            recentTasks,
            activeDraft,
            customTemplates,
            personalKnowledgeTree: Array.isArray(savedPersonalKnowledge?.nodes) ? savedPersonalKnowledge.nodes : []
        };
    };

    return Object.freeze({ loadLibrarySnapshot });
});
