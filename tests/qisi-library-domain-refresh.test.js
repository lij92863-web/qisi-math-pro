const test = require('node:test');
const assert = require('node:assert/strict');
const resources = require('../qisi-library-image-resources');
const { createLibraryLoader } = require('../qisi-library-snapshot');
const gate = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function domainFixture() {
    const reads = [], created = [], revoked = []; let view = {};
    const storage = {
        async loadLibrary() { reads.push('library'); return [{ id: 'q', stem: 'old', images: [{ id: 'qi' }] }]; },
        async loadImageRecords(ids) { return ids.map(id => ({ id, blob: id })); },
        async listTable(name) { reads.push(name); return name === 'externalQuestions' ? [{ id: 'external', images: [{ id: 'ei' }] }] : []; },
        async listRecentTasks() { reads.push('recent'); return []; },
        async get() { reads.push('knowledge'); return { nodes: [{ id: 'tree' }] }; }
    };
    const loader = createLibraryLoader({ storage,
        draftPersistence: { async reloadDraftBatch() { reads.push('review'); return { questions: [], images: [], files: [] }; } },
        imageResources: resources, urlPort: { createObjectUrl() { const url = 'blob:domain-' + created.length; created.push(url); return url; },
            revokeObjectUrl(url) { revoked.push(url); } }, applyOptionSplit() {},
        fingerprint: { core: q => q.stem, stem: q => q.stem },
        publish(snapshot) { view = { ...view, ...snapshot }; }, afterPublish: async () => {}, warn() {} });
    return { loader, storage, reads, created, revoked, get view() { return view; } };
}

test('library refresh never reads or clears other domains and publishes fingerprints with the new rows', async () => {
    const f = domainFixture(); await f.loader.refresh('batch');
    const external = f.view.externalQuestions, templates = f.view.customTemplates, knowledge = f.view.personalKnowledgeTree;
    const externalUrl = external[0].images[0].url, previousUrl = f.view.questions[0].images[0].url;
    f.reads.length = 0;
    f.storage.loadLibrary = async () => { f.reads.push('library'); return [{ id: 'new', stem: 'new source', images: [{ id: 'qi' }] }]; };
    await f.loader.refreshLibrary();
    assert.deepEqual(f.reads, ['library']);
    assert.equal(f.view.externalQuestions, external); assert.equal(f.view.customTemplates, templates); assert.equal(f.view.personalKnowledgeTree, knowledge);
    assert.equal(f.view.coreFingerprintMap.get('new source'), f.view.questions[0]);
    assert.equal(f.view.coreFingerprintMap.has('old'), false);
    assert.equal(f.revoked.includes(previousUrl), true); assert.equal(f.revoked.includes(externalUrl), false);
    f.loader.dispose(); assert.equal(new Set(f.revoked).size, f.created.length);
});

test('external refresh keeps the library rows, fingerprint maps and its image URLs intact', async () => {
    const f = domainFixture(); await f.loader.refresh();
    const questions = f.view.questions, core = f.view.coreFingerprintMap, url = questions[0].images[0].url;
    f.reads.length = 0; await f.loader.refreshExternal();
    assert.deepEqual(f.reads, ['externalQuestions', 'importBatches']);
    assert.equal(f.view.questions, questions); assert.equal(f.view.coreFingerprintMap, core); assert.equal(f.revoked.includes(url), false);
    f.loader.dispose();
});

test('independent library and external requests may finish in reverse order without cancelling each other', async () => {
    const f = domainFixture(); await f.loader.refresh();
    const waiting = gate(), priorList = f.storage.listTable;
    f.storage.loadLibrary = () => waiting.promise;
    const library = f.loader.refreshLibrary();
    f.storage.listTable = (name, ...args) => name === 'externalQuestions'
        ? Promise.resolve([{ id: 'latest-external', images: [{ id: 'ei' }] }]) : priorList(name, ...args);
    assert.equal(await f.loader.refreshExternal(), true);
    waiting.resolve([{ id: 'latest-library', stem: 'new', images: [{ id: 'qi' }] }]);
    assert.equal(await library, true);
    assert.equal(f.view.questions[0].id, 'latest-library'); assert.equal(f.view.externalQuestions[0].id, 'latest-external');
    f.loader.dispose();
});

test('a late failed external preparation preserves both published domains and releases its own temporary image', async () => {
    const f = domainFixture(); await f.loader.refresh();
    const old = f.view, libraryUrl = old.questions[0].images[0].url, externalUrl = old.externalQuestions[0].images[0].url;
    const list = f.storage.listTable;
    f.storage.listTable = (name, ...args) => { if (name === 'importBatches') throw new Error('external-metadata-failed'); return list(name, ...args); };
    await assert.rejects(f.loader.refreshExternal(), /external-metadata-failed/);
    assert.equal(f.view, old); assert.equal(f.revoked.includes(libraryUrl), false); assert.equal(f.revoked.includes(externalUrl), false);
    assert.equal(f.revoked.includes(f.created.at(-1)), true); f.loader.dispose();
});

test('a newer domain refresh invalidates an older full snapshot rather than publishing mixed stale values', async () => {
    const f = domainFixture(); await f.loader.refresh();
    const waiting = gate(); let request = 0;
    f.storage.loadLibrary = () => ++request === 1 ? waiting.promise : Promise.resolve([{ id: 'new', stem: 'new', images: [] }]);
    const full = f.loader.refresh(); await f.loader.refreshLibrary();
    waiting.resolve([{ id: 'old-full', stem: 'old-full', images: [{ id: 'qi' }] }]);
    assert.equal(await full, false); assert.equal(f.view.questions[0].id, 'new');
    f.loader.dispose();
});

test('joint bank refresh retains the original library-then-external order and leaves auxiliary domains alone', async () => {
    const f = domainFixture(); await f.loader.refresh(); f.reads.length = 0;
    await f.loader.refreshQuestionBanks();
    assert.deepEqual(f.reads, ['library', 'externalQuestions', 'importBatches']);
    assert.deepEqual(f.view.personalKnowledgeTree, [{ id: 'tree' }]); f.loader.dispose();
});
