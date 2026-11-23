const test = require('node:test');
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const { createLiveQuestionIndex, createLibraryService } = require('../qisi-library-service');
const { questionMatchesLibraryFilters } = require('../qisi-utils');
const { createQuestionChangeFeed } = require('../qisi-library-snapshot');

test('50,000 questions: one write evaluates and indexes one changed row with a search active', t => {
    let reads = 0, fingerprintCalls = 0;
    const library = createLibraryService({
        matchesFilters(...args) { reads++; return questionMatchesLibraryFilters(...args); },
        cacheSearchText: true
    });
    const index = createLiveQuestionIndex({
        compareKeys: (a, b) => a > b ? 1 : a < b ? -1 : 0,
        fingerprint: { core: question => { fingerprintCalls++; return question.stem; }, stem: question => question.stem },
        normalize: row => row, classify: row => ({ systemKnowledge: row.systemKnowledge }), onChange() {}
    });
    const start = performance.now();
    index.replace(Array.from({ length: 50000 }, (_, i) => ({
        id: 50000 - i, createdAt: 50000 - i, systemKnowledge: '圆锥曲线',
        stem: (i % 37 ? '椭圆方程' : '双曲线方程') + i, images: i % 3 ? [] : [{ id: 'image-' + i }]
    })));
    const startup = performance.now() - start;
    const criteria = { keyword: '双曲线', filters: { imageState: 'hasImage' } };
    const beforeSearch = performance.now();
    const active = index.select(criteria, library.makePredicate);
    const search = performance.now() - beforeSearch;
    assert.equal(active.length, 451);
    assert.equal(active.slice(100, 110).length, 10);
    reads = 0;
    fingerprintCalls = 0;
    const beforeUpdate = performance.now();
    index.apply([50001], [{ id: 50001, createdAt: 50001, stem: '双曲线新题', images: [{ id: 'new' }] }]);
    const save = performance.now() - beforeUpdate;
    assert.equal(index.select(criteria, library.makePredicate).slice(0, 1)[0].id, 50001);
    assert.equal(reads, 1);
    assert.equal(fingerprintCalls, 1);
    assert.equal(active.length, 452);
    assert.equal(index.ordered.length, 50001);
    index.apply([50001, 49999], [undefined, { ...index.byId.get(49999), createdAt: 5 }]);
    assert.equal(index.ordered.length, 50000);
    assert.equal(active.length, 451);
    const ordered = index.ordered.slice();
    assert.deepEqual(ordered, ordered.slice().sort((a, b) => b.createdAt - a.createdAt || b.id - a.id));
    t.diagnostic(JSON.stringify({ projectionMs: startup, firstFilteredSearchMs: search, incrementalUpdateMs: save }));
});

test('commits during a read are replayed and clear falls back to a fresh snapshot', async () => {
    let notify, release, reads = 0, published = [];
    const feed = createQuestionChangeFeed({
        databaseName: 'test',
        mutationEvents: { subscribe(listener) { notify = listener; }, unsubscribe() {} },
        storage: {
            async loadLibrary() { reads++; if (reads === 1) await new Promise(resolve => { release = resolve; }); return [reads]; },
            async loadQuestionsById(ids) { return ids; }
        },
        replace: rows => published.push(['all', ...rows]),
        apply: (ids, rows) => published.push(['ids', ...ids, ...rows]),
        report: error => { throw error; }
    });
    const start = feed.refresh();
    await Promise.resolve();
    notify({ 'idb://test/questions/': { from: 'q', to: 'q', d: 1 } });
    release();
    await start;
    assert.deepEqual(published, [['all', 1], ['ids', 'q', 'q']]);
    notify({ 'idb://test/questions/': { from: -Infinity, to: [[]], d: 1 } });
    await feed.refresh();
    assert.deepEqual(published.at(-1), ['all', 2]);
    feed.dispose();
});

test('sync retries retain changed keys, stop after three attempts, and clear stale state after manual recovery', async () => {
    const timers = new Map(), reads = [], applied = [], statuses = [], reports = [];
    let notify, fails = true, delay;
    const feed = createQuestionChangeFeed({
        databaseName: 'test',
        mutationEvents: { subscribe(listener) { notify = listener; }, unsubscribe() {} },
        storage: {
            async loadLibrary() { reads.push('all'); return []; },
            async loadQuestionsById(ids) { reads.push(ids); if (fails) throw new Error('read failed'); return ids; }
        },
        replace() {}, apply: ids => applied.push(ids), report: error => reports.push(error.message),
        onStale: stale => statuses.push(stale),
        schedule(callback, ms) { delay = ms; timers.set(ms, callback); return ms; },
        cancel(timer) { timers.delete(timer); }
    });
    const change = id => notify({ 'idb://test/questions/': { from: id, to: id, d: 1 } });
    const settle = () => new Promise(resolve => setImmediate(resolve));
    try {
        await feed.refresh();
        change('first');
        await settle();
        assert.deepEqual(statuses, [true]);
        change('second');
        for (const ms of [500, 2000, 5000]) {
            assert.equal(delay, ms);
            const tick = timers.get(ms);
            timers.delete(ms);
            tick();
            await settle();
        }
        assert.equal(timers.size, 0);
        assert.deepEqual(reports, ['read failed']);
        assert.equal(reads.length, 5);
        assert.deepEqual(applied, []);
        fails = false;
        change('third');
        await feed.refresh();
        assert.deepEqual([...applied[0]].sort(), ['first', 'second', 'third']);
        assert.equal(reads.filter(read => read === 'all').length, 1);
        assert.equal(statuses.at(-1), false);
    } finally { feed.dispose(); }
});
