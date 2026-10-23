const test = require('node:test');
const assert = require('node:assert/strict');
const resources = require('../qisi-library-image-resources');
const { createLibraryLoader } = require('../qisi-library-snapshot');

const deferred = () => {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
};

function fixture() {
    let view, errorStage = '', createFailure = false, number = 0;
    let read = async () => [{ id: 'q', options: ['a'], images: [{ id: 'image' }] }];
    let rendered = async () => {};
    const created = [], revoked = [], warnings = [], reads = [];
    const failAt = name => { reads.push(name); if (errorStage === name) throw new Error('FIXTURE_' + name); };
    const storage = {
        async loadLibrary() { failAt('library'); return read(); },
        async loadImageRecords(ids) { failAt('images'); return ids.map(id => ({ id, blob: 'bytes:' + id })); },
        async listTable(name) { failAt(name); return []; },
        async listRecentTasks() { failAt('recent'); return []; },
        async get() { failAt('personal'); return { nodes: [{ id: 'knowledge' }] }; }
    };
    const loader = createLibraryLoader({
        storage, imageResources: resources,
        draftPersistence: { async reloadDraftBatch() { failAt('draft'); return { questions: [], files: [], images: [] }; } },
        urlPort: {
            createObjectUrl() {
                if (createFailure) throw new Error('FIXTURE_URL_CREATION');
                const value = 'blob:fixture-' + ++number; created.push(value); return value;
            },
            revokeObjectUrl(value) { revoked.push(value); }
        },
        applyOptionSplit() {}, fingerprint: { core: q => q.id, stem: q => q.id },
        publish(snapshot) { view = snapshot; }, afterPublish: () => rendered(),
        warn: (...args) => warnings.push(args)
    });
    return { loader, storage, created, revoked, reads, warnings,
        get view() { return view; }, fail(stage) { errorStage = stage; },
        setRead(fn) { read = fn; }, setRendered(fn) { rendered = fn; },
        failCreate() { createFailure = true; }
    };
}

test('a failed late domain keeps the last complete snapshot and decodable-resource ownership', async () => {
    for (const stage of ['externalQuestions', 'importBatches', 'recent', 'draft', 'customTemplates', 'personal']) {
        const f = fixture();
        try {
            await f.loader.refresh('batch');
            const previous = f.view, url = previous.questions[0].images[0].url;
            f.fail(stage);
            await assert.rejects(f.loader.refresh('batch'), new RegExp('FIXTURE_' + stage));
            assert.equal(f.view, previous, stage);
            assert.equal(f.revoked.includes(url), false, stage);
            assert.deepEqual(f.revoked, f.created.filter(value => value !== url), 'only failed preparation resources are released');
        } finally { f.loader.dispose(); }
        assert.deepEqual([...new Set(f.revoked)].sort(), f.created.sort());
    }
});

test('a new snapshot owns its resources before old resources retire after rendering', async () => {
    const f = fixture();
    try {
        await f.loader.refresh();
        const old = f.view.questions[0].images[0].url;
        const rendered = deferred();
        f.setRendered(() => rendered.promise);
        const refreshing = f.loader.refresh();
        while (f.created.length < 2) await new Promise(resolve => setImmediate(resolve));
        await new Promise(resolve => setImmediate(resolve));
        assert.notEqual(f.view.questions[0].images[0].url, old);
        assert.equal(f.revoked.includes(old), false);
        rendered.resolve();
        await refreshing;
        assert.deepEqual(f.revoked, [old]);
        assert.equal(f.view.coreFingerprintMap.get('q'), f.view.questions[0]);
    } finally { f.loader.dispose(); }
});

test('captured editor images retain old URLs until the real consumer releases them', async () => {
    const f = fixture();
    try {
        await f.loader.refresh();
        const old = f.view.questions[0].images[0].url;
        const release = resources.retainImageResources(f.view.questions[0].images);
        await f.loader.refresh();
        assert.equal(f.revoked.includes(old), false);
        release(); release();
        assert.equal(f.revoked.filter(value => value === old).length, 1);
    } finally { f.loader.dispose(); }
});

test('latest request wins when independent reads complete in the opposite order', async () => {
    const f = fixture();
    const older = deferred(), newer = deferred();
    try {
        await f.loader.refresh();
        let count = 0;
        f.setRead(() => (++count === 1 ? older : newer).promise);
        const first = f.loader.refresh(), second = f.loader.refresh();
        newer.resolve([{ id: 'newer', images: [{ id: 'image' }] }]);
        assert.equal(await second, true);
        older.resolve([{ id: 'older', images: [{ id: 'image' }] }]);
        assert.equal(await first, false);
        assert.deepEqual(f.view.questions.map(q => q.id), ['newer']);
        assert.equal(f.revoked.includes(f.view.questions[0].images[0].url), false);
        assert.equal(f.revoked.length, 2);
    } finally { f.loader.dispose(); }
});

test('dispose invalidates pending reads, prevents publication and releases every allocated URL once', async () => {
    const f = fixture(), gate = deferred();
    await f.loader.refresh();
    const original = f.view;
    f.setRead(() => gate.promise);
    const pending = f.loader.refresh();
    f.loader.dispose(); f.loader.dispose();
    gate.resolve([{ id: 'late', images: [{ id: 'image' }] }]);
    assert.equal(await pending, false);
    assert.equal(await f.loader.refresh(), false);
    assert.equal(f.view, original);
    assert.deepEqual(f.revoked, f.created);
});

test('a rendering failure never disposes the newly published resources', async () => {
    const f = fixture();
    try {
        await f.loader.refresh();
        f.setRendered(async () => { throw new Error('FIXTURE_RENDER_FAILURE'); });
        await assert.rejects(f.loader.refresh(), /FIXTURE_RENDER_FAILURE/);
        assert.equal(f.revoked.includes(f.view.questions[0].images[0].url), false);
        assert.equal(f.revoked.length, 0, 'unknown render completion must not invalidate the previous DOM either');
    } finally { f.loader.dispose(); }
    assert.deepEqual(f.revoked.sort(), f.created.sort());
});

test('preparation does not mutate a reused storage row or its image array', async () => {
    const f = fixture();
    const row = { id: 'same', images: [{ id: 'image' }], options: ['a'] };
    const expected = structuredClone(row);
    f.setRead(async () => [row]);
    try {
        await f.loader.refresh(); await f.loader.refresh();
        assert.deepEqual(row, expected);
        assert.notEqual(f.view.questions[0], row);
        assert.notEqual(f.view.questions[0].images[0], row.images[0]);
    } finally { f.loader.dispose(); }
});

test('initial and partial image preparation failures are explicit and release only their new scopes', async () => {
    const f = fixture();
    f.fail('library');
    await assert.rejects(f.loader.refresh(), /FIXTURE_library/);
    assert.equal(f.view, undefined);
    assert.deepEqual(f.created, []);
    f.fail('');
    const originalCreate = f.storage.loadImageRecords;
    f.setRead(async () => [{ id: 'q', images: [{ id: 'i1' }, { id: 'i2' }] }]);
    f.storage.loadImageRecords = async ids => {
        const rows = await originalCreate(ids);
        Object.defineProperty(rows[1], 'blob', { get() { throw new Error('FIXTURE_CORRUPT_IMAGE'); } });
        return rows;
    };
    await assert.rejects(f.loader.refresh(), /FIXTURE_CORRUPT_IMAGE/);
    assert.equal(f.view, undefined);
    assert.deepEqual(f.revoked, f.created);
    f.loader.dispose();
});

test('missing blobs retain their visible warning contract and cannot create a fallback URL', async () => {
    const f = fixture();
    f.storage.loadImageRecords = async () => [];
    try {
        await f.loader.refresh();
        const image = f.view.questions[0].images[0];
        assert.equal(image.url, ''); assert.equal(image.missingBlob, true); assert.equal(image.displayable, false);
        assert.equal(f.warnings.length, 1); assert.deepEqual(f.created, []);
    } finally { f.loader.dispose(); }
});
