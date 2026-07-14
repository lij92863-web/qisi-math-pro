const test = require('node:test');
const assert = require('node:assert/strict');

const Bridge = require('../qisi-production-import-bridge.js');
const StateMachine = require('../qisi-import-state-machine.js');
const BatchContext = require('../qisi-batch-context-service.js');
const Roles = require('../qisi-source-role-classifier.js');
const Projection = require('../qisi-pdf-candidate-projection.js');
const ControlledWrite = require('../qisi-pdf-support-controlled-write.js');
const CandidateNormalizer = require('../qisi-candidate-normalizer.js');
const OutputPort = require('../qisi-production-import-output-port.js');
const Validation = require('../qisi-import-validation-service.js');
const ReviewBuilder = require('../qisi-review-draft-builder.js');
const Diagnostics = require('../qisi-import-diagnostics.js');
const RoutePolicy = require('../qisi-production-import-route-policy.js');

const clone = value => structuredClone(value);
const batch = () => ({
    id: 'shadow-batch', status: 'pending', sourceVersion: 1,
    recognitionMode: 'standard', createdAt: 1, updatedAt: 1
});
const pdfFiles = () => [{
    id: 'pdf-question', batchId: 'shadow-batch', filename: 'question.pdf',
    fileType: 'pdf', roles: ['question'], sourceOrder: 1
}, {
    id: 'pdf-support', batchId: 'shadow-batch', filename: 'support.pdf',
    fileType: 'pdf', roles: ['answer', 'solution'], sourceOrder: 2
}];
const docxFiles = () => [{
    id: 'docx-question', batchId: 'shadow-batch', filename: 'question.docx',
    fileType: 'docx', roles: ['full'], sourceOrder: 1
}];

const pdfDraft = overrides => ({
    id: 'pdf-draft-1', questionNumber: '1', type: 'solution',
    stem: 'Prove the deterministic statement.', options: [],
    answer: '', solution: '', images: [], warnings: [],
    sourceQuestionFileId: 'pdf-question', sourceFileId: 'pdf-question',
    sourcePage: 1,
    sourceTrace: {
        sourceFileId: 'pdf-question', sourcePage: 1,
        evidenceId: 'question-block-1', sourceKind: 'textLayer'
    },
    ...overrides
});

function controlledWrite(draft, { answer = 'A', solution = 'proof', answerOn = true,
    solutionOn = true } = {}) {
    return {
        ...ControlledWrite.buildPdfSupportFieldLevelControlledWrite({
            drafts: [draft],
            parserSafeAnswerItems: answerOn
                ? [{ questionNumber: '1', answer, evidenceId: 'answer-block-1' }]
                : [],
            parserSafeSolutionItems: solutionOn
                ? [{ questionNumber: '1', solution, evidenceId: 'solution-block-1' }]
                : []
        }),
        decisionId: 'cw:shadow:1'
    };
}

function projectionContext({
    draft = pdfDraft(), mode = 'full', safe = ['1'], fused = [],
    answerOn = true, solutionOn = true, draftSourceId
} = {}) {
    const nextDraft = draftSourceId
        ? {
            ...draft, sourceQuestionFileId: draftSourceId,
            sourceFileId: draftSourceId,
            sourceTrace: { ...draft.sourceTrace, sourceFileId: draftSourceId }
        }
        : draft;
    return {
        drafts: [nextDraft],
        sources: pdfFiles(),
        controlledWriteDecisions: [controlledWrite(nextDraft, {
            answerOn, solutionOn
        })],
        controlledWriteDecisionId: 'cw:shadow:combined',
        alignmentResults: [{
            mode, safeQuestionNumbers: safe,
            fusedQuestionNumbers: fused,
            warnings: mode === 'prefix' ? [{ code: 'sequence-prefix' }] : []
        }],
        routeContext: { engine: 'pdf-text-layer' }
    };
}

const normalizerHelpers = {
    hasUnescapedLatexCommandInJsonString: () => false,
    escapeLatexBackslashesInJsonCandidate: value => value,
    tryRepairedCandidate: () => ({ result: null })
};
const outputHelpers = {
    cleanText: value => String(value || '').trim(),
    normalizeQuestionKey: value => String(value || '').match(/\d{1,3}/)?.[0] || '',
    cleanOptions: values => Array.isArray(values) ? values : [],
    mergeImages: (...lists) => lists.flat(),
    clock: () => 50
};

function bridgeHarness({ route = 'pdf', context, docxDraft } = {}) {
    const files = route === 'pdf' ? pdfFiles() : docxFiles();
    const currentBatch = batch();
    currentBatch.producerMode = route === 'pdf'
        ? 'pdf' : 'docx-deterministic';
    const persisted = [];
    let projectionCalls = 0;
    const repository = {
        async get(table, id) {
            return table === 'draftImportBatches' && id === currentBatch.id
                ? clone(currentBatch) : undefined;
        },
        async findBy(table, field, value) {
            return table === 'draftImportFiles' && field === 'batchId' &&
                value === currentBatch.id ? clone(files) : [];
        }
    };
    const valid = value => ({
        valid: value === true,
        errors: value === true ? [] : [{ code: 'shadow-safety-rejected' }],
        warnings: []
    });
    const ports = {
        createStateMachine: options => StateMachine.createImportStateMachine(options),
        loadBatchAndFiles: input => BatchContext.loadBatchAndFiles(
            { ...input, getRoles: file => file.roles }, { repository }
        ),
        classifySourceRoles: Roles.classifySourceRoles,
        resolveProductionRoute: input =>
            RoutePolicy.resolveProductionImportRoute(input),
        runDocxImport: async () => ({
            drafts: [clone(docxDraft)], draftImages: [], warnings: [], errors: []
        }),
        runPdfImport: async () => ({
            drafts: clone(context.drafts),
            draftImages: [], unmatched: [], warnings: [], errors: [],
            projectionContext: clone(context),
            safePartialCandidates: context.drafts.map(draft => ({
                draft: clone(draft), isSafePartial: true,
                isComplete: false, requiresManualReview: true
            }))
        }),
        projectPdfCandidates: value => {
            projectionCalls += 1;
            return Projection.projectPdfCandidates(value);
        },
        normalizeCandidates: drafts => CandidateNormalizer.normalizeCandidates(
            [{ questions: drafts }], normalizerHelpers
        ),
        projectImportOutput: value => OutputPort.projectImportOutput(
            value, outputHelpers
        ),
        validateCandidates: (drafts, validationContext) =>
            Validation.validateImportDrafts(drafts, {
                context: validationContext,
                validateSequence: values => valid(values.every(item =>
                    item.validation?.sequenceValid !== false
                )),
                validateSchema: draft => valid(
                    draft.validation?.schemaValid !== false
                ),
                validateOwnership: draft => valid(
                    draft.validation?.ownershipValid !== false
                ),
                validateSafePartial: draft => valid(
                    draft.supportLevel !== 'rejected'
                ),
                validateControlledWriteEvidence: draft => valid(
                    route !== 'pdf' || draft.controlledWrite?.evaluated === true
                )
            }),
        buildReviewDrafts: ReviewBuilder.buildReviewDrafts,
        persistReviewDraftBatch: async command => {
            persisted.push(clone(command));
            return { version: 1, idempotent: false };
        },
        createDiagnostics: () => Diagnostics.createImportDiagnostics({
            clock: (() => { let value = 0; return () => ++value; })(),
            logger: () => {}
        }),
        reportProgress: async () => {},
        reportImportFailure: async () => {},
        clock: () => 100
    };
    return { bridge: Bridge.createProductionImportBridge(ports), persisted,
        projectionCalls: () => projectionCalls };
}

test('DOCX deterministic bypasses the PDF projection owner unchanged', async () => {
    const draft = {
        id: 'docx-draft-1', questionNumber: '1', type: 'solution',
        stem: 'deterministic DOCX', options: [], answer: '', solution: '',
        images: [], warnings: [],
        source: { mode: 'docx-deterministic', sourceId: 'docx-question' }
    };
    const harness = bridgeHarness({ route: 'docx', docxDraft: draft });
    const result = await harness.bridge.run({
        mode: 'shadow', batchId: 'shadow-batch', requestId: 'shadow-docx'
    });
    assert.equal(result.drafts[0].stem, draft.stem);
    assert.equal(harness.projectionCalls(), 0);
});

test('Bridge and legacy projection are canonically equal for full, prefix, and missing answer cases', async () => {
    for (const context of [
        projectionContext(),
        projectionContext({ mode: 'prefix', answerOn: false, solutionOn: false }),
        projectionContext({ answerOn: false, solutionOn: true })
    ]) {
        const legacy = Projection.projectPdfCandidates(context)[0];
        const harness = bridgeHarness({ route: 'pdf', context });
        const result = await harness.bridge.run({
            mode: 'shadow', batchId: 'shadow-batch', requestId: 'shadow-pdf'
        });
        assert.deepEqual(
            Projection.compareCanonicalPdfCandidates(legacy, result.drafts[0]),
            []
        );
        assert.equal(harness.projectionCalls(), 1);
        assert.equal(harness.persisted.length, 0);
    }
});

test('known-bad wrong ownership is rejected by both projections before shadow persistence', async () => {
    const context = projectionContext({ draftSourceId: 'pdf-support' });
    const legacy = Projection.projectPdfCandidates(context)[0];
    assert.equal(legacy.supportLevel, 'rejected');
    assert.equal(legacy.validation.ownershipValid, false);

    const harness = bridgeHarness({ route: 'pdf', context });
    await assert.rejects(
        harness.bridge.run({
            mode: 'shadow', batchId: 'shadow-batch', requestId: 'shadow-known-bad'
        }),
        error => error.code === 'IMPORT_VALIDATION_FAILED'
    );
    assert.equal(harness.persisted.length, 0);
});
