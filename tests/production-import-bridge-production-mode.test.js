const test = require('node:test');
const assert = require('node:assert/strict');

const Bridge = require('../qisi-production-import-bridge.js');
const StateMachine = require('../qisi-import-state-machine.js');
const RoutePolicy = require('../qisi-production-import-route-policy.js');

const draft = () => ({
    id: 'draft-1', batchId: 'batch-1', version: 1, order: 1,
    questionNumber: '1', type: '解答题', stem: 'safe stem',
    options: [], answer: '1', solution: 'safe solution', images: [],
    source: { format: 'docx', sourceId: 'source-1' },
    producer: {
        mode: 'deterministic-docx', routeId: 'docx-deterministic',
        routeReason: 'fixture', engine: 'fixture', deterministic: true
    },
    route: { identity: 'docx-deterministic', transitions: [] },
    fieldProvenance: {}, controlledWrite: {
        evaluated: false, acceptedFields: [], rejectedFields: []
    },
    supportLevel: 'full', manualReviewRequired: false
});
function ports(overrides = {}) {
    const calls = [];
    const review = draft();
    const value = {
        createStateMachine: options => StateMachine.createImportStateMachine(options),
        loadBatchAndFiles: async () => ({
            batch: {
                id: 'batch-1', sourceVersion: 1, status: 'pending',
                producerMode: 'docx-deterministic',
                progress: 0, draftPersistence: { version: 0 }
            },
            files: [{
                id: 'source-1', batchId: 'batch-1', fileType: 'docx',
                roles: ['full'], sourceOrder: 1
            }],
            batchContext: {
                batchMetadata: { producerMode: 'docx-deterministic' },
                sourceManifest: [{
                    id: 'source-1', fileType: 'docx', roles: ['full'],
                    sourceOrder: 1
                }],
                userSettings: {}, engineConfig: {}
            }
        }),
        classifySourceRoles: async () => ({
            sources: [{
                id: 'source-1', fileType: 'docx', roles: ['full'],
                sourceOrder: 1, isQuestion: true, isSupplementalImage: false
            }]
        }),
        resolveProductionRoute: input =>
            RoutePolicy.resolveProductionImportRoute(input),
        runDocxImport: async () => ({ drafts: [draft()], draftImages: [] }),
        runPdfImport: async () => { throw new Error('unexpected-pdf'); },
        projectPdfCandidates: async () => { throw new Error('unexpected-pdf'); },
        normalizeCandidates: async rows => rows,
        projectImportOutput: async input => ({
            drafts: input.drafts, draftImages: input.draftImages
        }),
        validateCandidates: async rows => rows,
        buildReviewDrafts: async () => [review],
        persistReviewDraftBatch: async command => {
            calls.push(['persist', command]);
            return { version: 1, idempotent: false };
        },
        reloadDraftBatch: async () => {
            calls.push(['reload']);
            return {
                batch: { id: 'batch-1', status: 'review' },
                files: [], questions: [review], images: []
            };
        },
        createDiagnostics: () => ({
            start() {}, record() {}, fail() {}, snapshot: () => ({})
        }),
        reportProgress: async input => calls.push(['progress', input]),
        reportImportFailure: async input => calls.push(['failure', input]),
        clock: () => 100,
        ...overrides
    };
    return { value, calls };
}

test('execution mode is explicit and never inferred from available ports', async () => {
    const harness = ports();
    await assert.rejects(
        Bridge.createProductionImportBridge(harness.value).run({
            batchId: 'batch-1', requestId: 'request-1'
        }),
        error => error.code === 'PRODUCTION_IMPORT_MODE_REQUIRED'
    );
    assert.deepEqual(harness.calls, []);
});

test('production succeeds only after transaction readback matches the review result', async () => {
    const harness = ports();
    const result = await Bridge.createProductionImportBridge(harness.value).run({
        mode: 'production', batchId: 'batch-1', requestId: 'request-1',
        expectedSourceVersion: 1
    });
    assert.equal(result.mode, 'production');
    assert.equal(result.state.state, 'WAITING_CONFIRMATION');
    assert.equal(result.readback.batch.status, 'review');
    assert.deepEqual(harness.calls.map(call => call[0]).filter(name =>
        ['persist', 'reload'].includes(name)
    ), ['persist', 'reload']);
});

test('shadow mode performs no persistence, status, failure, or readback write path', async () => {
    const harness = ports();
    const result = await Bridge.createProductionImportBridge(harness.value).run({
        mode: 'shadow', batchId: 'batch-1', requestId: 'shadow-request-1'
    });
    assert.equal(result.mode, 'shadow');
    assert.equal(result.persistence, null);
    assert.equal(result.readback, null);
    assert.deepEqual(harness.calls, []);
});

test('readback mismatch fails closed after the transaction and never reports success', async () => {
    const harness = ports({
        reloadDraftBatch: async () => ({
            batch: { id: 'batch-1', status: 'review' },
            files: [], questions: [], images: []
        })
    });
    await assert.rejects(
        Bridge.createProductionImportBridge(harness.value).run({
            mode: 'production', batchId: 'batch-1', requestId: 'request-1',
            expectedSourceVersion: 1
        }),
        error => error.code === 'PRODUCTION_IMPORT_READBACK_MISMATCH'
    );
});
