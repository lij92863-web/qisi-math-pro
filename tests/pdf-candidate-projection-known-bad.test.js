const test = require('node:test');
const assert = require('node:assert/strict');

const ControlledWrite = require('../qisi-pdf-support-controlled-write.js');
const Projection = require('../qisi-pdf-candidate-projection.js');

const parsedQuestion = () => ({
    id: 'draft-1', questionNumber: '1', type: 'solution',
    stem: 'Prove the statement.', options: [], answer: '',
    solution: '', images: [], confirmed: true
});

const realDecision = (draft = parsedQuestion()) => ({
    ...ControlledWrite.buildPdfSupportFieldLevelControlledWrite({
        drafts: [draft],
        parserSafeSolutionItems: [{
            questionNumber: '1', solution: 'safe proof',
            evidenceId: 'solution-evidence-1'
        }]
    }),
    decisionId: 'cw:1'
});

const validInput = overrides => ({
    source: { sourceId: 'pdf-1', sourceType: 'pdf', sourceOrder: 1 },
    engineResult: { sourceKind: 'textLayer', engine: 'pdf-text-layer' },
    parsedQuestion: parsedQuestion(),
    alignmentResult: {
        mode: 'full', safeQuestionNumbers: ['1'],
        fusedQuestionNumbers: [], warnings: []
    },
    controlledWriteDecision: realDecision(),
    evidence: {
        fields: Object.fromEntries([
            'questionNumber', 'stem', 'options', 'answer', 'solution', 'images'
        ].map(field => [field, { page: 1, blockIds: [`${field}-block`] }])),
        rawEvidenceRefs: [{ evidenceId: 'question-block-1' }]
    },
    pageContext: { page: 1, sourceOrder: 1 },
    validation: {
        schemaValid: true, sequenceValid: true, ownershipValid: true
    },
    ...overrides
});

test('missing source mode fails closed and filename guessing cannot establish it', () => {
    for (const engineResult of [
        {},
        { filename: 'obviously-ai-ocr.pdf' },
        { uiLabel: 'PDF AI' }
    ]) {
        assert.throws(
            () => Projection.projectPdfCandidate(validInput({ engineResult })),
            error => error.code === 'source-mode-missing'
        );
    }
});

test('missing real controlled-write result fails closed without accepting fields', () => {
    for (const controlledWriteDecision of [undefined, null, {}, { fieldDecisions: [] }]) {
        assert.throws(
            () => Projection.projectPdfCandidate(validInput({ controlledWriteDecision })),
            error => error.code === 'controlled-write-missing'
        );
    }
});

test('PDF AI fields without explicit controlled-write decisions remain rejected', () => {
    const result = Projection.projectPdfCandidate(validInput({
        engineResult: { sourceKind: 'ocrMarkdown', engine: 'mock-ocr' }
    }));

    assert.equal(result.source.mode, 'pdf-ai');
    assert.equal(result.supportLevel, 'rejected');
    assert.equal(result.manualReviewRequired, true);
    assert.equal(result.questionNumber, '');
    assert.equal(result.stem, '');
    assert.deepEqual(result.options, []);
    assert.deepEqual(result.images, []);
    for (const field of ['questionNumber', 'stem']) {
        assert.equal(result.fieldProvenance[field].kind, 'rejected');
        assert.equal(result.fieldProvenance[field].manuallyEdited, false);
    }
    for (const field of ['options', 'images']) {
        assert.equal(result.fieldProvenance[field].kind, 'missing');
        assert.equal(result.fieldProvenance[field].manuallyEdited, false);
    }
    assert.equal(result.fieldProvenance.solution.kind, 'controlled-write');
});

test('raw JSON, wrong ownership, and invalid sequences can never become review-safe', () => {
    const raw = Projection.projectPdfCandidate(validInput({
        parsedQuestion: {
            ...parsedQuestion(), rawJsonCandidate: true,
            stem: '{"questions":[{"stem":"leak"}]}'
        }
    }));
    assert.equal(raw.supportLevel, 'rejected');
    assert.equal(JSON.stringify(raw).includes('"questions"'), false);

    const wrongOwnership = Projection.projectPdfCandidate(validInput({
        validation: {
            schemaValid: true, sequenceValid: true, ownershipValid: false
        }
    }));
    assert.equal(wrongOwnership.supportLevel, 'rejected');
    assert.equal(wrongOwnership.validation.ownershipValid, false);

    for (const alignmentResult of [
        {
            mode: 'fail-closed', safeQuestionNumbers: [],
            fusedQuestionNumbers: ['1'], warnings: [{ code: 'sequence-gap' }]
        },
        {
            mode: 'prefix', safeQuestionNumbers: [],
            fusedQuestionNumbers: ['1'], warnings: [{ code: 'sequence-rewind' }]
        }
    ]) {
        const result = Projection.projectPdfCandidate(validInput({ alignmentResult }));
        assert.equal(result.supportLevel, 'rejected');
        assert.equal(result.validation.sequenceValid, false);
    }
});

test('batch projection cannot synthesize alignment validity from field decisions', () => {
    const draft = {
        ...parsedQuestion(),
        sourceQuestionFileId: 'pdf-1',
        sourceFileId: 'pdf-1',
        sourcePage: 1,
        sourceTrace: {
            sourceFileId: 'pdf-1',
            sourcePage: 1,
            sourceKind: 'textLayer',
            evidenceId: 'question-block-1'
        }
    };
    const result = Projection.projectPdfCandidates({
        drafts: [draft],
        sources: [{
            id: 'pdf-1', fileType: 'pdf', roles: ['question'], sourceOrder: 1
        }],
        controlledWriteDecisions: [realDecision(draft)],
        alignmentResults: [],
        routeContext: { engine: 'pdf-text-layer' }
    })[0];

    assert.equal(result.validation.sequenceValid, false);
    assert.equal(result.supportLevel, 'rejected');
    assert.equal(result.controlledWrite.errors.some(error =>
        error.code === 'sequence-invalid'
    ), true);
});

test('confirming a candidate never fabricates manual provenance', () => {
    const result = Projection.projectPdfCandidate(validInput());
    assert.equal(result.fieldProvenance.stem.kind, 'deterministic-source');
    assert.equal(result.fieldProvenance.stem.manuallyEdited, false);
    assert.equal(Object.values(result.fieldProvenance).some(item =>
        item.kind === 'manual'
    ), false);
});
