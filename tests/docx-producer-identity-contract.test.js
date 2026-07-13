const test = require('node:test');
const assert = require('node:assert/strict');

const Contract = require('../qisi-docx-producer-identity-contract.js');
const Policy = require('../qisi-formal-admission-policy.js');
const Review = require('../qisi-production-review-validator.js');
const Contracts = require('../qisi-recognition-contracts.js');
const Storage = require('../qisi-storage-repository.js');
const { FakeDatabase } = require('./storage-test-harness.js');

const source = () => ({
    sourceId: 'docx-source-1',
    format: 'docx',
    filename: 'questions.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    sourceOrder: 1
});
const candidate = (overrides = {}) => ({
    id: 'draft-1',
    version: 1,
    questionNumber: '1',
    type: 'solution',
    stem: 'Prove the producer identity statement.',
    options: [],
    answer: '',
    solution: '',
    images: [],
    ...overrides
});
const decision = (overrides = {}) => ({
    accepted: true,
    decisionId: 'strict-docx:source:1:mock-engine',
    fields: ['questionNumber', 'stem', 'options'],
    method: 'strict-json-contract',
    sourceId: 'docx-source-1',
    engine: 'mock-engine',
    ...overrides
});
const vision = overrides => Contract.projectDocxVisionCandidate({
    candidate: candidate(overrides),
    source: source(),
    engine: 'mock-engine',
    page: 1,
    blockIds: ['page:1:candidate:1'],
    controlledWriteDecision: decision()
});
const deterministic = overrides => Contract.projectDeterministicDocxCandidate({
    candidate: candidate({ solution: 'Deterministic proof.', ...overrides }),
    source: source(),
    engine: 'docx-xml-importer',
    page: 1
});
const admissionContext = draft => Policy.createAdmissionContext({
    mode: draft.producer.mode,
    actorId: 'teacher-1',
    explicitConfirmation: true,
    requestId: 'request-1',
    idempotencyKey: 'confirm-1',
    evaluatedAt: '2026-07-13T00:00:00.000Z',
    source: draft.source,
    producer: draft.producer,
    route: draft.route
});
const codes = result => result.errors.map(error => error.code);

test('deterministic DOCX identity records the XML producer and source format', () => {
    const draft = deterministic();
    assert.equal(draft.source.format, 'docx');
    assert.equal(draft.producer.mode, 'deterministic-docx');
    assert.equal(draft.producer.deterministic, true);
    assert.equal(draft.route.identity, Contract.ROUTES.DOCX_DETERMINISTIC);
});

test('DOCX vision identity records vision producer without replacing source format', () => {
    const draft = vision();
    assert.equal(draft.source.format, 'docx');
    assert.equal(draft.producer.mode, 'vision-ai');
    assert.equal(draft.producer.routeId, 'docx-rendered-to-pdf-vision');
    assert.equal(draft.producer.deterministic, false);
    assert.equal(Object.hasOwn(draft.source, 'mode'), false);
});

test('DOCX render transition can never relabel the original source as PDF', () => {
    const draft = structuredClone(vision());
    draft.source.format = 'pdf';
    const result = Contract.validateCanonicalIdentity(draft);
    assert.equal(result.valid, false);
    assert.ok(codes(result).includes('docx-vision-source-contaminated'));
});

test('vision fields receive controlled-write, rejected, or missing provenance only', () => {
    const draft = vision();
    assert.deepEqual(
        [...new Set(Object.values(draft.fieldProvenance).map(item => item.kind))].sort(),
        ['controlled-write', 'missing']
    );
    assert.equal(draft.fieldProvenance.stem.controlledWriteAccepted, true);
    assert.equal(draft.fieldProvenance.stem.manuallyEdited, false);
});

test('vision output cannot claim deterministic provenance', () => {
    const draft = structuredClone(vision());
    draft.fieldProvenance.stem.kind = 'deterministic-source';
    draft.fieldProvenance.stem.status = 'deterministic-source';
    const result = Policy.evaluateDraftAdmission(draft, admissionContext(draft));
    assert.equal(result.accepted, false);
    assert.ok(codes(result).includes('admission-producer-provenance-invalid'));
});

test('deterministic output cannot claim AI controlled-write provenance', () => {
    const draft = structuredClone(deterministic());
    draft.fieldProvenance.stem.kind = 'controlled-write';
    draft.fieldProvenance.stem.status = 'controlled-write';
    draft.fieldProvenance.stem.controlledWriteAccepted = true;
    draft.fieldProvenance.stem.controlledWriteDecisionId = 'fake';
    const result = Policy.evaluateDraftAdmission(draft, admissionContext(draft));
    assert.equal(result.accepted, false);
    assert.ok(codes(result).includes('admission-provenance-missing'));
});

test('missing producer identity fails canonical identity validation', () => {
    const draft = structuredClone(vision());
    delete draft.producer;
    assert.equal(Contract.validateCanonicalIdentity(draft).valid, false);
});

test('missing route identity fails canonical identity validation', () => {
    const draft = structuredClone(vision());
    delete draft.route;
    assert.equal(Contract.validateCanonicalIdentity(draft).valid, false);
});

test('missing controlled-write decision fails before review handoff', () => {
    assert.throws(() => Contract.projectDocxVisionCandidate({
        candidate: candidate(), source: source(), engine: 'mock-engine'
    }), error => error.code === 'DOCX_CONTROLLED_WRITE_MISSING');
});

test('controlled-write source mismatch fails closed', () => {
    assert.throws(() => Contract.projectDocxVisionCandidate({
        candidate: candidate(), source: source(), engine: 'mock-engine',
        controlledWriteDecision: decision({ sourceId: 'other-source' })
    }), error => error.code === 'DOCX_CONTROLLED_WRITE_SOURCE_MISMATCH');
});

test('duplicate controlled-write accepted fields are a conflict', () => {
    assert.throws(() => Contract.projectDocxVisionCandidate({
        candidate: candidate(), source: source(), engine: 'mock-engine',
        controlledWriteDecision: decision({ fields: ['stem', 'stem'] })
    }), error => error.code === 'DOCX_CONTROLLED_WRITE_CONFLICT');
});

test('present vision field outside the decision is rejected, not review-bypassed', () => {
    const draft = vision({ solution: 'uncontrolled solution' });
    assert.equal(draft.fieldProvenance.solution.status, 'rejected');
    assert.equal(draft.supportLevel, 'rejected');
    assert.equal(draft.manualReviewRequired, true);
    assert.equal(draft.canonicalReviewHandoff, false);
});

test('manualReviewRequired cannot mask a missing controlled-write decision', () => {
    assert.throws(() => Contract.projectDocxVisionCandidate({
        candidate: candidate({ manualReviewRequired: true }),
        source: source(), engine: 'mock-engine', controlledWriteDecision: null
    }), error => error.code === 'DOCX_CONTROLLED_WRITE_MISSING');
});

test('post-hoc provenance without producer-boundary evidence is rejected by review', () => {
    const draft = structuredClone(vision());
    delete draft.fieldProvenance.stem.producerBoundary;
    const validator = Review.createProductionReviewValidator({
        policy: Policy,
        clock: () => Date.parse('2026-07-13T00:00:00.000Z')
    });
    const result = validator.validate(draft);
    assert.equal(result.valid, false);
    assert.ok(codes(result).includes('admission-producer-provenance-invalid'));
});

test('exact legacy mode remains readable without mutating the record', () => {
    const legacy = { source: { mode: 'docx-deterministic', sourceId: 'legacy-1' } };
    const before = structuredClone(legacy);
    const result = Contract.resolveIdentity(legacy, { allowLegacyRead: true });
    assert.equal(result.status, 'legacy-exact');
    assert.equal(result.producer.mode, 'deterministic-docx');
    assert.deepEqual(legacy, before);
});

test('unknown legacy record is readable only as legacy-unknown', () => {
    const result = Contract.resolveIdentity({
        source: { mode: 'docx-vision-mystery', sourceId: 'legacy-1' }
    }, { allowLegacyRead: true });
    assert.equal(result.status, 'legacy-unknown');
});

test('legacy-unknown cannot pass Formal Admission', () => {
    const draft = structuredClone(deterministic());
    delete draft.producer;
    delete draft.route;
    delete draft.source.format;
    draft.source.mode = 'docx-vision-mystery';
    const context = Policy.createAdmissionContext({
        mode: 'vision-ai', actorId: 'teacher', explicitConfirmation: true,
        requestId: 'r', idempotencyKey: 'i'
    });
    const result = Policy.evaluateDraftAdmission(draft, context);
    assert.equal(result.accepted, false);
    assert.ok(codes(result).includes('admission-producer-identity-invalid'));
});

test('canonical vision draft passes Formal Admission only with producer-time evidence', () => {
    const draft = vision();
    const result = Policy.evaluateDraftAdmission(draft, admissionContext(draft));
    assert.equal(result.accepted, true, JSON.stringify(result.errors));
});

test('canonical deterministic draft passes Formal Admission without AI evidence', () => {
    const draft = deterministic();
    const result = Policy.evaluateDraftAdmission(draft, admissionContext(draft));
    assert.equal(result.accepted, true, JSON.stringify(result.errors));
    assert.equal(Object.values(draft.fieldProvenance).some(
        item => item.status === 'controlled-write'
    ), false);
});

test('formal Question v2 preserves and validates split producer identity', () => {
    const draft = vision();
    const context = admissionContext(draft);
    const decisionResult = Policy.evaluateDraftAdmission(draft, context);
    const question = Policy.buildQuestionV2(draft, decisionResult, {
        id: 'question-1', context
    });
    assert.equal(question.source.format, 'docx');
    assert.equal(question.producer.mode, 'vision-ai');
    assert.equal(question.source.mode, undefined);
    assert.equal(
        Contracts.validateQuestionV2(question).valid,
        true,
        JSON.stringify(Contracts.validateQuestionV2(question).errors)
    );
});

test('comparator reports producer mismatch as a safety difference', () => {
    const left = vision();
    const right = structuredClone(left);
    right.producer.mode = 'deterministic-docx';
    const differences = Contract.compareCanonicalDocxCandidates(left, right);
    assert.ok(differences.some(diff => diff.path === '$.producer.mode'));
    assert.ok(differences.every(diff => diff.severity === 'safety'));
});

test('comparator ignores only explicit volatile diagnostics', () => {
    const left = structuredClone(vision());
    const right = structuredClone(left);
    left.requestId = 'left';
    right.requestId = 'right';
    right.fieldProvenance.stem.reasonCode = 'changed-safety-reason';
    const differences = Contract.compareCanonicalDocxCandidates(left, right);
    assert.deepEqual(differences.map(diff => diff.path), [
        '$.fieldProvenance.stem.reasonCode'
    ]);
});

test('raw JSON and placeholders are rejected at the vision producer boundary', () => {
    assert.throws(() => vision({ stem: '{"questions":[]}' }),
        error => error.code === 'DOCX_VISION_RAW_JSON_REJECTED');
    assert.throws(() => vision({ stem: '[placeholder]' }),
        error => error.code === 'DOCX_VISION_PLACEHOLDER_REJECTED');
});

test('repository atomically preserves canonical DOCX vision identity', async () => {
    const draft = { ...structuredClone(vision()), batchId: 'batch-1', status: 'reviewed' };
    const database = new FakeDatabase({
        draftQuestions: [draft],
        draftImportBatches: [{ id: 'batch-1', submittedCount: 0 }]
    });
    const now = Date.parse('2026-07-13T00:00:00.000Z');
    const repository = Storage.createRepository(database, {
        clock: () => now,
        admission: {
            evaluateDraftAdmission: Policy.evaluateDraftAdmission,
            validateAdmissionDecision: Policy.validateAdmissionDecision,
            buildQuestionV2: Policy.buildQuestionV2,
            validateQuestionV2: Contracts.validateQuestionV2
        }
    });
    const context = admissionContext(draft);
    const policyDecision = Policy.evaluateDraftAdmission(draft, context);
    const result = await repository.confirmDraftToQuestion(
        draft.id,
        policyDecision,
        {
            expectedDraftVersion: 1,
            idempotencyKey: 'confirm-1',
            actorId: 'teacher-1',
            requestId: 'request-1',
            questionId: 'formal-1',
            context
        }
    );
    assert.equal(result.question.source.format, 'docx');
    assert.equal(result.question.producer.mode, 'vision-ai');
    assert.equal(result.question.route.identity, 'docx-rendered-to-pdf-vision');
    assert.equal(Contracts.validateQuestionV2(result.question).valid, true);
});
