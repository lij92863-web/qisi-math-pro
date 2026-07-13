const Bridge = require('../../qisi-production-import-bridge.js');
const StateMachine = require('../../qisi-import-state-machine.js');

const clone = value => structuredClone(value);

const makeDraft = (overrides = {}) => ({
    id: 'draft-1', batchId: 'batch-1', version: 1, order: 1,
    questionNumber: '1', type: 'solution', stem: 'safe stem',
    options: [], answer: '', solution: '', images: [], warnings: [],
    source: { format: 'docx', sourceId: 'source-1', sourceOrder: 1 },
    producer: {
        mode: 'deterministic-docx', routeId: 'docx-deterministic-import',
        routeReason: 'test-production-owner', engine: 'fixture',
        deterministic: true
    },
    route: { identity: 'docx-deterministic-import', transitions: [] },
    fieldProvenance: {},
    controlledWrite: { evaluated: false, acceptedFields: [], rejectedFields: [] },
    supportLevel: 'full', manualReviewRequired: false,
    validation: { schemaValid: true, sequenceValid: true, ownershipValid: true },
    ...overrides
});

function createHarness(overrides = {}) {
    const metrics = {
        producerCalls: 0,
        persistenceCalls: 0,
        reloadCalls: 0,
        formalWrites: 0,
        progress: [],
        failures: []
    };
    const review = makeDraft();
    let batch = {
        id: 'batch-1', sourceType: 'docx', sourceVersion: 1,
        status: 'pending', progress: 0, draftPersistence: { version: 0 }
    };
    const files = [{
        id: 'source-1', batchId: 'batch-1', fileType: 'docx',
        roles: ['full'], sourceOrder: 1, sourceVersion: 1
    }];
    let storedDrafts = [];
    const base = {
        createStateMachine: options =>
            StateMachine.createImportStateMachine(options),
        loadBatchAndFiles: async () => ({
            batch: clone(batch),
            files: clone(files),
            batchContext: {
                sourceManifest: clone(files),
                userSettings: {}, engineConfig: {}
            }
        }),
        classifySourceRoles: async () => ({
            sources: [{
                id: 'source-1', fileType: 'docx', roles: ['full'],
                sourceOrder: 1, isQuestion: true,
                isSupplementalImage: false
            }]
        }),
        runDocxImport: async () => {
            metrics.producerCalls += 1;
            return { drafts: [makeDraft()], draftImages: [], warnings: [] };
        },
        runPdfImport: async () => { throw new Error('unexpected-pdf'); },
        projectPdfCandidates: async () => { throw new Error('unexpected-pdf'); },
        normalizeCandidates: async rows => rows,
        projectImportOutput: async input => ({
            drafts: input.drafts, draftImages: input.draftImages
        }),
        validateCandidates: async rows => rows,
        buildReviewDrafts: async () => [clone(review)],
        persistReviewDraftBatch: async command => {
            metrics.persistenceCalls += 1;
            storedDrafts = clone(command.drafts);
            batch = {
                ...batch,
                ...command.batchPatch,
                status: 'review',
                draftPersistence: {
                    version: (batch.draftPersistence?.version || 0) + 1,
                    idempotencyKey: command.idempotencyKey,
                    signature: 'fixture-signature'
                }
            };
            return {
                version: batch.draftPersistence.version,
                idempotent: false
            };
        },
        reloadDraftBatch: async () => {
            metrics.reloadCalls += 1;
            return {
                batch: clone(batch),
                files: clone(files),
                questions: clone(storedDrafts),
                images: []
            };
        },
        createDiagnostics: () => ({
            start() {}, record() {}, fail() {}, snapshot: () => ({})
        }),
        reportProgress: async input => metrics.progress.push(clone(input)),
        reportImportFailure: async input => metrics.failures.push(clone(input)),
        clock: () => 100,
        ...overrides
    };
    return {
        bridge: Bridge.createProductionImportBridge(base),
        ports: base,
        metrics,
        getBatch: () => clone(batch),
        setBatch: value => { batch = clone(value); },
        getStoredDrafts: () => clone(storedDrafts)
    };
}

module.exports = { createHarness, makeDraft };
