const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Bridge = require('../qisi-production-import-bridge.js');
const StateMachine = require('../qisi-import-state-machine.js');
const BatchContext = require('../qisi-batch-context-service.js');
const Roles = require('../qisi-source-role-classifier.js');
const DocxCoordinator = require('../qisi-docx-import-coordinator.js');
const PdfCoordinator = require('../qisi-pdf-import-coordinator.js');
const CandidateNormalizer = require('../qisi-candidate-normalizer.js');
const Validation = require('../qisi-import-validation-service.js');
const ReviewBuilder = require('../qisi-review-draft-builder.js');
const OutputPort = require('../qisi-production-import-output-port.js');
const Diagnostics = require('../qisi-import-diagnostics.js');
const Projection = require('../qisi-pdf-candidate-projection.js');
const ControlledWrite = require('../qisi-pdf-support-controlled-write.js');

const ROOT = path.resolve(__dirname, '..');

const clone = value => structuredClone(value);
const docxFiles = () => [{
    id: 'docx-1', batchId: 'batch-1', filename: 'questions.docx',
    fileType: 'docx', roles: ['full'], sourceOrder: 1, parseStatus: 'pending'
}];
const pdfFiles = () => [{
    id: 'pdf-question', batchId: 'batch-1', filename: 'questions.pdf',
    fileType: 'pdf', roles: ['question'], sourceOrder: 1, parseStatus: 'pending'
}, {
    id: 'pdf-support', batchId: 'batch-1', filename: 'support.pdf',
    fileType: 'pdf', roles: ['answer', 'solution'], sourceOrder: 2,
    parseStatus: 'pending'
}];

const docxDraft = () => ({
    id: 'draft-docx-1', questionNumber: '1', type: '解答题',
    stem: 'deterministic docx stem', options: [], answer: 'answer',
    solution: 'solution', warnings: ['docx-warning'],
    source: { mode: 'docx-deterministic', sourceId: 'docx-1' }
});
const pdfDraft = () => ({
    id: 'draft-pdf-1', questionNumber: '1', type: 'choice',
    stem: 'safe pdf stem',
    options: [
        { label: 'A', text: 'alpha' }, { label: 'B', text: 'beta' },
        { label: 'C', text: 'gamma' }, { label: 'D', text: 'delta' }
    ],
    answer: '', solution: '', images: [], warnings: ['missing-answer'],
    sourceQuestionFileId: 'pdf-question', sourceFileId: 'pdf-question',
    sourcePage: 1,
    sourceTrace: {
        sourceFileId: 'pdf-question', sourcePage: 1,
        evidenceId: 'question-block', sourceKind: 'textLayer'
    }
});

const pdfProjectionInput = (draft = pdfDraft()) => ({
    source: {
        sourceId: 'pdf-question', sourceType: 'pdf', sourceOrder: 1
    },
    engineResult: { sourceKind: 'textLayer', engine: 'pdf-text-layer' },
    parsedQuestion: draft,
    alignmentResult: {
        mode: 'prefix', safeQuestionNumbers: ['1'],
        fusedQuestionNumbers: [], warnings: [{ code: 'sequence-prefix' }]
    },
    controlledWriteDecision: {
        ...ControlledWrite.buildPdfSupportFieldLevelControlledWrite({
            drafts: [draft],
            parserSafeAnswerItems: [{
                questionNumber: '1', answer: '{"unsafe":"shell"}'
            }],
            parserSafeSolutionItems: [{
                questionNumber: '1', solution: 'safe solution'
            }]
        }),
        decisionId: 'cw:bridge:1'
    },
    evidence: {
        fields: Object.fromEntries([
            'questionNumber', 'stem', 'options', 'answer', 'solution', 'images'
        ].map(field => [field, { page: 1, blockIds: [`${field}-block`] }])),
        rawEvidenceRefs: [{ evidenceId: 'question-block' }]
    },
    pageContext: { page: 1, sourceOrder: 1 },
    validation: {
        schemaValid: true, sequenceValid: true, ownershipValid: true
    }
});

const pdfProjectionContext = (draft = pdfDraft()) => {
    const input = pdfProjectionInput(draft);
    return {
        drafts: [draft],
        sources: pdfFiles(),
        controlledWriteDecisions: [input.controlledWriteDecision],
        controlledWriteDecisionId: input.controlledWriteDecision.decisionId,
        alignmentResults: [input.alignmentResult],
        routeContext: {
            sourceMode: 'pdf-deterministic', engine: 'pdf-text-layer'
        }
    };
};

const normalizerHelpers = {
    hasUnescapedLatexCommandInJsonString: () => false,
    escapeLatexBackslashesInJsonCandidate: value => value,
    tryRepairedCandidate: () => ({ result: null })
};
const outputHelpers = {
    cleanText: value => String(value || '').trim(),
    normalizeQuestionKey: value => {
        const match = String(value || '').match(/\d{1,3}/);
        return match ? String(Number(match[0])) : '';
    },
    cleanOptions: values => Array.isArray(values) ? values : [],
    mergeImages: (...lists) => {
        const rows = lists.flat();
        return [...new Map(rows.map(row => [row.id, row])).values()];
    },
    clock: () => 50
};

function createHarness(overrides = {}) {
    const batch = {
        id: 'batch-1', status: 'pending', progress: 0,
        sourceVersion: 1, recognitionMode: 'standard', createdAt: 1, updatedAt: 1
    };
    const files = clone(overrides.files || docxFiles());
    const calls = [];
    const progress = [];
    const failures = [];
    const diagnosticEvents = [];
    const persisted = [];
    const repository = {
        async get(table, id) {
            calls.push('load-batch');
            return table === 'draftImportBatches' && id === batch.id
                ? clone(batch) : undefined;
        },
        async findBy(table, field, value) {
            calls.push('load-files');
            return table === 'draftImportFiles' && field === 'batchId' && value === batch.id
                ? clone(files) : [];
        }
    };
    const validationState = {
        sequenceValid: overrides.sequenceValid !== false,
        ownershipValid: overrides.ownershipValid !== false
    };
    const validatorPorts = {
        context: { files },
        validateSequence() {
            return validationState.sequenceValid
                ? { valid: true, errors: [], warnings: [] }
                : { valid: false, errors: [{ code: 'sequence-gap' }], warnings: [] };
        },
        validateSchema() {
            return { valid: true, errors: [], warnings: [] };
        },
        validateOwnership() {
            return validationState.ownershipValid
                ? { valid: true, errors: [], warnings: [] }
                : { valid: false, errors: [{ code: 'wrong-attachment' }], warnings: [] };
        },
        validateSafePartial() {
            return { valid: true, errors: [], warnings: [] };
        },
        validateControlledWriteEvidence() {
            return { valid: true, errors: [], warnings: [] };
        }
    };

    const ports = {
        createStateMachine: options => StateMachine.createImportStateMachine(options),
        loadBatchAndFiles: input => BatchContext.loadBatchAndFiles(
            { ...input, getRoles: file => file.roles },
            { repository }
        ),
        classifySourceRoles: manifest => {
            calls.push('classify');
            return Roles.classifySourceRoles(manifest);
        },
        runDocxImport: async (context, signal) => {
            calls.push('docx');
            return DocxCoordinator.runDocxImport(
                { batchId: context.batchId, sources: context.sources },
                {
                    parseSource: overrides.parseDocxSource || (async () => ({
                        drafts: clone(overrides.sourceDrafts || [docxDraft()]),
                        draftImages: [{
                            id: 'image-docx-1', batchId: 'batch-1',
                            questionId: 'draft-docx-1', status: 'assigned'
                        }],
                        warnings: ['coordinator-warning']
                    }))
                },
                signal
            );
        },
        runPdfImport: async (context, signal) => {
            calls.push('pdf');
            return PdfCoordinator.runPdfImport(
                {
                    batchId: context.batchId,
                    batch: context.batch,
                    sources: context.sources
                },
                {
                    processSources: async () => ({
                        drafts: clone(overrides.sourceDrafts || [pdfDraft()]),
                        projectionContext: clone(
                            overrides.projectionContext || pdfProjectionContext()
                        ),
                        draftImages: [], unmatched: [], warnings: ['safe-prefix'], errors: []
                    }),
                    createSafePartial: draft => ({
                        draft, isSafePartial: true, isComplete: false,
                        requiresManualReview: true
                    })
                },
                signal
            );
        },
        projectPdfCandidates: inputs => {
            calls.push('pdf-project');
            return Projection.projectPdfCandidates(inputs);
        },
        normalizeCandidates: drafts => {
            calls.push('normalize');
            return CandidateNormalizer.normalizeCandidates(
                [{ questions: drafts }], normalizerHelpers
            );
        },
        projectImportOutput: input => {
            calls.push('project');
            return OutputPort.projectImportOutput(input, outputHelpers);
        },
        validateCandidates: (drafts, context) => {
            calls.push('validate');
            return Validation.validateImportDrafts(drafts, {
                ...validatorPorts,
                context
            });
        },
        buildReviewDrafts: (drafts, context) => {
            calls.push('build');
            return ReviewBuilder.buildReviewDrafts(drafts, context);
        },
        persistReviewDraftBatch: async command => {
            calls.push('persist');
            if (overrides.persistenceError) throw overrides.persistenceError;
            persisted.push(clone(command));
            return { version: 1, idempotent: false };
        },
        createDiagnostics: () => Diagnostics.createImportDiagnostics({
            clock: (() => { let value = 0; return () => ++value; })(),
            logger: event => diagnosticEvents.push(event)
        }),
        reportProgress: async input => { progress.push(clone(input)); },
        reportImportFailure: async input => { failures.push(clone(input)); },
        clock: () => 100
    };
    return { ports, calls, progress, failures, diagnosticEvents, persisted };
}

test('DOCX complete follows the deterministic review-only state path', async () => {
    const harness = createHarness();
    const bridge = Bridge.createProductionImportBridge(harness.ports);
    const result = await bridge.run({ batchId: 'batch-1' });

    assert.equal(result.route, 'docx');
    assert.equal(result.state.state, 'WAITING_CONFIRMATION');
    assert.deepEqual(result.drafts.map(row => row.id), ['draft-docx-1']);
    assert.equal(result.drafts[0].warnings.includes('docx-warning'), true);
    assert.deepEqual(harness.calls.filter(call => !call.startsWith('load-')), [
        'classify', 'docx', 'normalize', 'project', 'validate', 'build', 'persist'
    ]);
    assert.equal(harness.persisted[0].images[0].questionId, 'draft-docx-1');
    assert.equal(JSON.stringify(result).includes('FORMAL_ADMISSION'), false);
});

test('PDF safe partial uses the recognition path and preserves rejected ownership', async () => {
    const harness = createHarness({ files: pdfFiles() });
    const result = await Bridge.createProductionImportBridge(harness.ports)
        .run({ batchId: 'batch-1' });

    assert.equal(result.route, 'pdf');
    assert.equal(result.state.state, 'WAITING_CONFIRMATION');
    assert.equal(result.drafts[0].supportLevel, 'prefix');
    assert.equal(result.drafts[0].fieldProvenance.answer.status, 'rejected');
    assert.equal(result.drafts[0].fieldProvenance.solution.status, 'controlled-write');
    assert.equal(harness.calls.includes('pdf-project'), true);
    assert.equal(harness.calls.includes('pdf'), true);
    assert.equal(harness.calls.includes('docx'), false);
});

test('mixed DOCX/PDF input fails before either source coordinator', async () => {
    const harness = createHarness({ files: [docxFiles()[0], pdfFiles()[1]] });
    await assert.rejects(
        Bridge.createProductionImportBridge(harness.ports).run({ batchId: 'batch-1' }),
        error => error.code === 'PRODUCTION_IMPORT_SOURCE_UNSUPPORTED'
    );
    assert.equal(harness.calls.includes('docx'), false);
    assert.equal(harness.calls.includes('pdf'), false);
    assert.equal(harness.persisted.length, 0);
});

test('missing role and duplicate source fail before parsing or persistence', async () => {
    for (const [files, expectedCode] of [
        [[{ ...docxFiles()[0], roles: [] }], 'IMPORT_CONTEXT_INVALID'],
        [[docxFiles()[0], { ...docxFiles()[0] }], 'IMPORT_START_INVALID']
    ]) {
        const harness = createHarness({ files });
        await assert.rejects(
            Bridge.createProductionImportBridge(harness.ports).run({ batchId: 'batch-1' }),
            error => error.code === expectedCode
        );
        assert.equal(harness.calls.includes('docx'), false);
        assert.equal(harness.persisted.length, 0);
    }
});

test('raw JSON draft output is rejected before normalization and persistence', async () => {
    const harness = createHarness({ sourceDrafts: ['{"questions":[{"stem":"raw"}]}'] });
    await assert.rejects(
        Bridge.createProductionImportBridge(harness.ports).run({ batchId: 'batch-1' }),
        error => error.code === 'PRODUCTION_IMPORT_RESULT_MALFORMED'
    );
    assert.equal(harness.calls.includes('normalize'), false);
    assert.equal(harness.persisted.length, 0);
});

test('sequence gap and ownership mismatch cannot reach review persistence', async () => {
    for (const override of [
        { sequenceValid: false },
        { ownershipValid: false }
    ]) {
        const harness = createHarness(override);
        await assert.rejects(
            Bridge.createProductionImportBridge(harness.ports).run({ batchId: 'batch-1' }),
            error => error.code === 'IMPORT_VALIDATION_FAILED'
        );
        assert.equal(harness.calls.includes('build'), false);
        assert.equal(harness.persisted.length, 0);
    }
});

test('missing validator port fails closed before loading or persistence', () => {
    const harness = createHarness();
    delete harness.ports.validateCandidates;
    assert.throws(
        () => Bridge.createProductionImportBridge(harness.ports),
        error => error.code === 'PRODUCTION_IMPORT_PORT_REQUIRED' &&
            error.port === 'validateCandidates'
    );
    assert.deepEqual(harness.calls, []);
    assert.equal(harness.persisted.length, 0);
});

test('persistence failure is reported only after the atomic owner rejects', async () => {
    const error = new Error('DRAFT_PERSISTENCE_WRITE_FAILED');
    error.code = 'DRAFT_PERSISTENCE_WRITE_FAILED';
    const harness = createHarness({ persistenceError: error });
    await assert.rejects(
        Bridge.createProductionImportBridge(harness.ports).run({ batchId: 'batch-1' }),
        failure => failure.code === 'IMPORT_DRAFT_PERSIST_FAILED' &&
            failure.causeCode === 'DRAFT_PERSISTENCE_WRITE_FAILED'
    );
    assert.equal(harness.calls.at(-1), 'persist');
    assert.equal(harness.failures.length, 1);
});

test('cancellation aborts the source owner, discards late output, and never persists', async () => {
    const controller = new AbortController();
    let release;
    let observedSignal;
    const harness = createHarness({
        parseDocxSource: ({ signal }) => {
            observedSignal = signal;
            return new Promise(resolve => { release = resolve; });
        }
    });
    const pending = Bridge.createProductionImportBridge(harness.ports).run({
        batchId: 'batch-1', signal: controller.signal
    });
    await new Promise(resolve => setImmediate(resolve));
    controller.abort();
    release({ drafts: [docxDraft()], draftImages: [], warnings: [] });

    await assert.rejects(pending, error => error.code === 'IMPORT_CANCELLED');
    assert.equal(observedSignal.aborted, true);
    assert.equal(harness.persisted.length, 0);
});

test('diagnostics and reported failure never expose private error text', async () => {
    const harness = createHarness({
        parseDocxSource: async () => {
            const error = new Error('private teacher document contents');
            error.code = 'DOCX_PRIVATE_FAILURE';
            throw error;
        }
    });
    await assert.rejects(
        Bridge.createProductionImportBridge(harness.ports).run({ batchId: 'batch-1' }),
        error => {
            assert.doesNotMatch(error.message, /private teacher/i);
            return true;
        }
    );
    assert.doesNotMatch(
        JSON.stringify({
            diagnostics: harness.diagnosticEvents,
            failures: harness.failures
        }),
        /private teacher/i
    );
});

test('bridge owner has no DB, UI, FormalAdmission, Route B, or OCR authority', () => {
    const implementation = fs.readFileSync(
        path.join(ROOT, 'qisi-production-import-bridge.js'), 'utf8'
    );
    assert.doesNotMatch(implementation, /\bdb\.|indexedDB|Dexie|\.transaction\s*\(|\.put\s*\(/);
    assert.doesNotMatch(implementation, /document\.|window\.|Vue|FormalAdmission|Route B|controlledWrite/i);
    assert.doesNotMatch(
        implementation,
        /\bfetch\s*\(|\brecognize[A-Z_$][\w$]*\s*\(|\bocr[A-Z_$][\w$]*\s*\(/
    );
});

test('bridge is browser-loaded as a layer-3 scaffold before the app shell', () => {
    const main = fs.readFileSync(path.join(ROOT, 'main.html'), 'utf8');
    const owners = JSON.parse(fs.readFileSync(
        path.join(ROOT, 'architecture/owners.json'), 'utf8'
    ));
    const manifest = JSON.parse(fs.readFileSync(
        path.join(ROOT, 'architecture/layers.json'), 'utf8'
    ));
    const entry = manifest.modules.find(item => item.id === 'production-import-bridge');

    assert.equal(owners.productionImportBridgeOwner, 'qisi-production-import-bridge.js');
    assert.equal(entry.file, 'qisi-production-import-bridge.js');
    assert.equal(entry.layer, 3);
    assert.equal(entry.status, 'scaffold');
    assert.deepEqual(entry.publicApi, [
        'REQUIRED_PORTS',
        'ProductionImportBridgeError',
        'createProductionImportBridge'
    ]);
    for (const dependency of [
        'import-state-machine',
        'batch-context-service',
        'source-role-classifier',
        'docx-import-coordinator',
        'pdf-import-coordinator',
        'candidate-normalizer',
        'import-validation-service',
        'review-draft-builder',
        'draft-persistence-service',
        'import-diagnostics'
    ]) {
        assert.equal(entry.allowedDependencies.includes(dependency), true, dependency);
    }
    assert.ok(main.indexOf('qisi-production-import-bridge.js') >
        main.indexOf('qisi-draft-persistence-service.js'));
    assert.ok(main.indexOf('qisi-production-import-bridge.js') < main.indexOf('app.js'));
});
