const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createNavigationRecorder } = require('../scripts/golden/navigation.cjs');

function fixture(options) {
    const session = new EventEmitter(), calls = [];
    session.send = async method => { calls.push(method); };
    return { session, calls, recorder: createNavigationRecorder(session, options) };
}

test('navigation observation enables each read-only domain once and releases only its own listeners', async () => {
    const { session, calls, recorder } = fixture();
    const unrelated = () => {};
    session.on('Page.frameNavigated', unrelated);
    await recorder.start();
    assert.deepEqual(calls.sort(), ['Network.enable', 'Page.enable', 'Runtime.enable']);
    recorder.stop();
    assert.deepEqual(session.listeners('Page.frameNavigated'), [unrelated]);
    assert.equal(session.listenerCount('Runtime.executionContextsCleared'), 0);
    recorder.stop();
});

test('navigation observation preserves frame, loader and context identities without request bodies or query secrets', () => {
    let now = 100;
    const { session, recorder } = fixture({ now: () => now++ });
    session.emit('Page.frameRequestedNavigation', { frameId: 'main', reason: 'scriptInitiated', url: 'http://user:password@127.0.0.1:33581/next?secret=value#private', disposition: 'currentTab' });
    session.emit('Network.requestWillBeSent', { type: 'Document', requestId: 'r1', frameId: 'main', loaderId: 'l2', request: { method: 'GET', url: 'http://127.0.0.1:33581/next?secret=value', postData: 'private-body' }, initiator: { type: 'script', stack: { callFrames: [{ functionName: 'go', url: 'http://127.0.0.1:33581/source.js?key=private', lineNumber: 7, columnNumber: 2 }] } } });
    session.emit('Runtime.executionContextCreated', { context: { id: 4, uniqueId: 'u4', origin: 'http://127.0.0.1:33581', auxData: { frameId: 'main', isDefault: true, type: 'default' } } });
    session.emit('Runtime.executionContextDestroyed', { executionContextId: 4, executionContextUniqueId: 'u4' });
    const snapshot = recorder.snapshot();
    assert.deepEqual(snapshot.events.map(e => e.sequence), [1, 2, 3, 4]);
    assert.deepEqual(snapshot.events.map(e => e.at), [100, 101, 102, 103]);
    assert.equal(snapshot.events[0].url, 'http://127.0.0.1:33581/next');
    assert.equal(snapshot.events[1].loaderId, 'l2');
    assert.equal(snapshot.events[1].initiator.stack.callFrames[0].url, 'http://127.0.0.1:33581/source.js');
    assert.equal(snapshot.events[2].frameId, 'main');
    assert.equal(snapshot.events[3].executionContextId, 4);
    assert.doesNotMatch(JSON.stringify(snapshot), /password|secret|private|postData/);
    recorder.stop();
});

test('non-document requests are excluded and later navigation survives bounded trace truncation', () => {
    const { session, recorder } = fixture({ maxEvents: 2 });
    session.emit('Network.requestWillBeSent', { type: 'Image', request: { url: 'http://localhost/private-image' } });
    for (let i = 0; i < 4; i++) session.emit('Page.frameStartedLoading', { frameId: 'f' + i });
    const snapshot = recorder.snapshot();
    assert.equal(snapshot.droppedEvents, 2);
    assert.deepEqual(snapshot.events.map(e => e.frameId), ['f2', 'f3']);
    assert.deepEqual(snapshot.events.map(e => e.sequence), [3, 4]);
    recorder.stop();
});

test('trace snapshots are detached values and stopping does not manufacture or clear observed evidence', () => {
    const { session, recorder } = fixture();
    session.emit('Runtime.executionContextsCleared', {});
    const first = recorder.snapshot();
    first.events[0].kind = 'modified';
    first.events.push({ kind: 'fake' });
    recorder.stop();
    session.emit('Runtime.executionContextsCleared', {});
    assert.equal(recorder.snapshot().events.length, 1);
    assert.equal(recorder.snapshot().events[0].kind, 'Runtime.executionContextsCleared');
});

test('observer setup failures remain the original error and cannot become a successful replay', async () => {
    const { session, recorder } = fixture();
    const original = Object.freeze(new Error('CDP unavailable'));
    let calls = 0;
    session.send = async () => { calls++; throw original; };
    await assert.rejects(recorder.start(), error => error === original);
    assert.equal(calls, 3);
    recorder.stop();
});

test('invalid trace bounds are rejected before subscribing', () => {
    const session = new EventEmitter();
    for (const maxEvents of [0, -1, 1.5, Infinity]) {
        assert.throws(() => createNavigationRecorder(session, { maxEvents }), /NAVIGATION_TRACE_LIMIT_INVALID/);
    }
    assert.deepEqual(session.eventNames(), []);
});

test('runner retains navigation evidence on the first failed operation and on observer setup failure', async () => {
    const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
    const H = require('./e2e/browser-harness');
    const { runSuite } = require('../scripts/golden/run.cjs');
    const originalStart = H.startBrowserApp, originalImport = H.createImportThroughUi;
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'qisi-navigation-report-'));
    const suite = JSON.parse(fs.readFileSync(path.resolve('golden/synthetic-suite.json')));
    suite.cases = suite.cases.filter(item => item.id === 'docx-stable-pair');
    const suiteFile = path.join(directory, 'single.json');
    fs.writeFileSync(suiteFile, JSON.stringify(suite));
    try {
        for (const setupFails of [false, true]) {
            const session = new EventEmitter();
            const original = Object.freeze(new Error(setupFails ? 'observer unavailable' : 'operation context destroyed'));
            let starts = 0, imports = 0, closes = 0;
            session.send = async () => { if (setupFails) throw original; };
            H.startBrowserApp = async () => { starts++; return { page: {}, context: { newCDPSession: async () => session }, close: async () => { closes++; } }; };
            H.createImportThroughUi = async () => {
                imports++;
                session.emit('Page.frameRequestedNavigation', { frameId: 'main', url: 'http://127.0.0.1/next', reason: 'scriptInitiated' });
                session.emit('Runtime.executionContextsCleared', {});
                throw original;
            };
            const report = await runSuite({ suiteFile, out: path.join(directory, setupFails ? 'setup-failure' : 'operation-failure') });
            const result = report.cases[0];
            assert.equal(report.ok, false);
            assert.equal(result.error, original.message);
            assert.equal(result.failureStage, setupFails ? 'navigation-observer-start' : 'ui-import');
            assert.equal(result.navigation.events.length, setupFails ? 0 : 2);
            assert.equal(starts, 1);
            assert.equal(imports, setupFails ? 0 : 1);
            assert.equal(closes, 1);
            assert.deepEqual(session.eventNames(), []);
            assert.equal(result.counts, undefined);
        }
    } finally {
        H.startBrowserApp = originalStart;
        H.createImportThroughUi = originalImport;
    }
});
