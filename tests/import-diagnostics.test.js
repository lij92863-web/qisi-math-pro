'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const {
    LIMITS,
    createImportDiagnostics
} = require('../qisi-import-diagnostics.js');
const {
    TRANSPORT_KIND,
    createInjectedImportPath
} = require('../qisi-injected-import-path.js');

test('records only allowlisted lifecycle metadata with measured duration', () => {
    let now = 100;
    const emitted = [];
    const diagnostics = createImportDiagnostics({
        clock: () => now,
        logger: event => emitted.push(event)
    });

    diagnostics.start({
        requestId: 'req-1', batchId: 'batch-1', stage: 'started',
        rawText: 'PRIVATE_START_TEXT'
    });
    now = 135;
    diagnostics.record({
        stage: 'candidates-produced', engine: 'qwen-vl-max',
        duration: 999999,
        counts: { files: 2, candidates: 3, secretCount: 91 },
        response: 'PRIVATE_FULL_MODEL_RESPONSE'
    });

    const snapshot = diagnostics.snapshot();
    assert.deepEqual(snapshot.events, [
        {
            requestId: 'req-1', batchId: 'batch-1', stage: 'started',
            duration: 0
        },
        {
            requestId: 'req-1', batchId: 'batch-1',
            stage: 'candidates-produced', duration: 35,
            engine: 'qwen-vl-max', counts: { files: 2, candidates: 3 }
        }
    ]);
    assert.deepEqual(emitted, snapshot.events);
    assert.equal(Object.isFrozen(snapshot), true);
    assert.equal(Object.isFrozen(snapshot.events), true);
    assert.equal(Object.isFrozen(snapshot.events[1].counts), true);
});

test('privacy attacks and arbitrary Error strings cannot cross the boundary', () => {
    const privateMarkers = [
        'PRIVATE_OCR_TEXT', 'data:image/png;base64,PRIVATE_BASE64',
        'sk-private-key', 'PRIVATE_FULL_MODEL_RESPONSE',
        'PRIVATE_ERROR_CODE'
    ];
    const emitted = [];
    const diagnostics = createImportDiagnostics({
        clock: () => 10,
        logger: event => emitted.push(event)
    });
    diagnostics.start({ requestId: 'req-safe', batchId: 'batch-safe' });
    diagnostics.record({
        stage: 'drafts-validated', engine: privateMarkers[0],
        rawText: privateMarkers[0], image: privateMarkers[1],
        apiKey: privateMarkers[2], response: privateMarkers[3],
        counts: { drafts: 1, apiKeys: 99 }
    });
    diagnostics.fail({
        name: 'Error', code: privateMarkers[4],
        message: privateMarkers.join('|'), response: privateMarkers[3]
    }, { stage: 'drafts-validated' });

    const serialized = JSON.stringify({ snapshot: diagnostics.snapshot(), emitted });
    for (const marker of privateMarkers) assert.equal(serialized.includes(marker), false);
    assert.equal(diagnostics.snapshot().events.at(-1).errorCode, 'import-failed');
});

test('maps known failures and cancellation to stable error codes', () => {
    const known = createImportDiagnostics({ clock: () => 1 });
    known.start({ requestId: 'req-known', batchId: 'batch-known' });
    known.fail({
        code: 'candidate-envelope-malformed',
        message: 'PRIVATE_MESSAGE'
    }, { stage: 'candidates-produced' });
    assert.equal(
        known.snapshot().events.at(-1).errorCode,
        'candidate-envelope-malformed'
    );

    const cancelled = createImportDiagnostics({ clock: () => 1 });
    cancelled.start({ requestId: 'req-cancel', batchId: 'batch-cancel' });
    cancelled.fail({ name: 'AbortError', message: 'PRIVATE_ABORT_REASON' }, {
        stage: 'candidates-produced'
    });
    assert.equal(cancelled.snapshot().events.at(-1).errorCode, 'import-cancelled');
});

test('caps identifiers, counts, duration, and retained event volume', () => {
    let now = 500;
    const diagnostics = createImportDiagnostics({ clock: () => now });
    diagnostics.start({
        requestId: 'r'.repeat(500), batchId: 'b'.repeat(500)
    });
    now = 400;
    diagnostics.record({
        stage: 'context-loaded',
        counts: { files: Number.MAX_SAFE_INTEGER, candidates: -2 }
    });
    now = Number.MAX_SAFE_INTEGER;
    for (let index = 0; index < LIMITS.maxEvents + 20; index += 1) {
        diagnostics.record({ stage: 'prefix-selected', counts: { selected: index } });
    }

    const snapshot = diagnostics.snapshot();
    assert.equal(snapshot.requestId, 'import-request');
    assert.equal(snapshot.batchId, 'unknown-batch');
    assert.equal(snapshot.events[1].duration, 0);
    assert.deepEqual(snapshot.events[1].counts, { files: LIMITS.maxCount });
    assert.equal(snapshot.events.length, LIMITS.maxEvents);
    assert.equal(
        snapshot.events.at(-1).duration <= LIMITS.maxDuration,
        true
    );
});

test('a throwing secure logger port cannot change import behavior', () => {
    const diagnostics = createImportDiagnostics({
        clock: () => 7,
        logger() { throw new Error('PRIVATE_LOGGER_FAILURE'); }
    });
    assert.doesNotThrow(() => {
        diagnostics.start({ requestId: 'req-log', batchId: 'batch-log' });
        diagnostics.record({ stage: 'context-loaded', counts: { files: 1 } });
    });
    assert.equal(diagnostics.snapshot().events.length, 2);
});

test('real injected import path publishes the complete sanitized stage sequence', async () => {
    const diagnostics = createImportDiagnostics({ clock: () => 20 });
    const batch = { id: 'batch-live', draftPersistence: { version: 0 } };
    const files = [{
        id: 'file-live', batchId: batch.id, fileType: 'docx',
        filename: 'PRIVATE_FILENAME.docx'
    }];
    const repository = {
        async get() { return batch; },
        async findBy() { return files; },
        async update() {}
    };
    let persisted = false;
    const path = createInjectedImportPath({
        repository,
        diagnostics,
        validateDrafts: drafts => drafts,
        buildReviewDrafts: drafts => drafts.map((draft, index) => ({
            ...draft, id: `draft-${index + 1}`, batchId: batch.id, version: 1
        })),
        persistDraftBatch: async () => { persisted = true; },
        clock: () => 1000
    });

    const result = await path.run(batch.id, {
        kind: TRANSPORT_KIND,
        engine: 'qwen-vl-max',
        async produceCandidates() {
            return {
                engine: 'qwen-vl-max',
                candidates: [{
                    questionNumber: '1', stem: 'PRIVATE_QUESTION_CONTENT'
                }]
            };
        }
    });

    assert.equal(persisted, true);
    assert.deepEqual(result.diagnostics.events.map(event => event.stage), [
        'started', 'context-loaded', 'candidates-produced', 'prefix-selected',
        'drafts-validated', 'review-drafts-built', 'review-drafts-persisted'
    ]);
    assert.equal(
        JSON.stringify(result.diagnostics).includes('PRIVATE_QUESTION_CONTENT'),
        false
    );
    assert.equal(
        JSON.stringify(result.diagnostics).includes('PRIVATE_FILENAME'),
        false
    );
});

test('production path loads and uses the diagnostics owner without forbidden authority', () => {
    const source = fs.readFileSync(path.join(ROOT, 'qisi-import-diagnostics.js'), 'utf8');
    const injected = fs.readFileSync(path.join(ROOT, 'qisi-injected-import-path.js'), 'utf8');
    const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    const main = fs.readFileSync(path.join(ROOT, 'main.html'), 'utf8');
    const layers = JSON.parse(fs.readFileSync(
        path.join(ROOT, 'architecture/layers.json'), 'utf8'
    ));
    const owners = JSON.parse(fs.readFileSync(
        path.join(ROOT, 'architecture/owners.json'), 'utf8'
    ));

    for (const token of [
        'document.', 'window.', 'Vue', 'fetch(', 'XMLHttpRequest',
        'FormalAdmission', 'StorageRepository', 'controlledWrite'
    ]) assert.equal(source.includes(token), false, token);
    for (const method of ['diagnostics.start(', 'diagnostics.record(',
        'diagnostics.fail(', 'diagnostics.snapshot(']) {
        assert.match(injected, new RegExp(method.replace(/[.(]/g, '\\$&')));
    }
    assert.match(
        app,
        /createDiagnostics:\s*\(\)\s*=>[\s\S]{0,100}ImportDiagnostics\.createImportDiagnostics/
    );
    assert.ok(
        main.indexOf('qisi-import-diagnostics.js') <
        main.indexOf('qisi-production-import-bridge.js')
    );
    const module = layers.modules.find(item => item.id === 'import-diagnostics');
    assert.deepEqual(module.allowedDependencies, ['secure-logger']);
    assert.equal(module.status, 'production-wired');
    assert.equal(owners.importDiagnosticsOwner, 'qisi-import-diagnostics.js');
});
