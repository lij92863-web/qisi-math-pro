const test = require('node:test');
const assert = require('node:assert/strict');

const Policy = require('../qisi-formal-admission-policy.js');

const fields = [
    'questionNumber', 'stem', 'options', 'answer', 'solution', 'images'
];

const provenance = (status, extra = {}) => ({ status, ...extra });

const makeDraft = ({
    mode = 'pdf-ai',
    type = '单选题',
    answer = 'A',
    solution = 'proof',
    fieldProvenance = {}
} = {}) => ({
    id: 'draft-1',
    version: 3,
    questionNumber: '1',
    type,
    stem: 'Question stem',
    options: type.includes('选择题') || type === '单选题'
        ? ['one', 'two', 'three', 'four']
        : [],
    answer,
    solution,
    images: [],
    source: { mode, sourceId: 'source-1', batchId: 'batch-1' },
    fieldProvenance: Object.fromEntries(fields.map(field => [
        field,
        field === 'images'
            ? provenance('missing')
            : provenance('controlled-write', {
                sourceId: 'source-1',
                controlledWriteAccepted: true,
                controlledWriteDecisionId: `cw-${field}`
            })
    ]))
});

const context = (mode, extra = {}) => Policy.createAdmissionContext({
    mode,
    actorId: 'teacher-1',
    explicitConfirmation: true,
    requestId: 'request-1',
    idempotencyKey: 'confirm-1',
    evaluatedAt: '2026-07-13T00:00:00.000Z',
    source: { sourceId: 'source-1', batchId: 'batch-1' },
    ...extra
});

const errorCodes = decision => decision.errors.map(error => error.code);

test('PDF answer without controlled-write evidence is rejected', () => {
    const draft = makeDraft();
    draft.fieldProvenance.answer = provenance('controlled-write', {
        sourceId: 'source-1',
        controlledWriteAccepted: false
    });
    const result = Policy.evaluateDraftAdmission(draft, context('pdf-ai'));
    assert.equal(result.accepted, false);
    assert.ok(errorCodes(result).includes('admission-controlled-write-rejected'));
});

test('PDF rejected solution cannot enter a formal question', () => {
    const draft = makeDraft();
    draft.fieldProvenance.solution = provenance('rejected', {
        reasonCode: 'ownership-rewind'
    });
    const result = Policy.evaluateDraftAdmission(draft, context('pdf-ai'));
    assert.equal(result.accepted, false);
    assert.ok(errorCodes(result).includes('admission-field-rejected'));
});

test('teacher rewrite allows a PDF answer as field-level manual provenance', () => {
    const draft = makeDraft();
    draft.fieldProvenance.answer = provenance('manual', {
        sourceId: 'source-1',
        manualEditRevision: 4
    });
    const result = Policy.evaluateDraftAdmission(draft, context('pdf-ai'));
    assert.equal(result.accepted, true, JSON.stringify(result.errors));
    assert.equal(
        result.fieldDecisions.find(item => item.field === 'answer').status,
        'manual'
    );
});

test('click-only confirmation cannot wash a rejected field into manual', () => {
    const draft = makeDraft();
    draft.userEdited = true;
    draft.manualEdited = true;
    draft.manualConfirmed = true;
    draft.fieldProvenance.answer = provenance('rejected', {
        reasonCode: 'ownership-invalid'
    });
    const result = Policy.evaluateDraftAdmission(draft, context('pdf-ai'));
    assert.equal(result.accepted, false);
    assert.ok(errorCodes(result).includes('admission-field-rejected'));
});

test('deterministic DOCX draft is accepted without fabricated controlled-write', () => {
    const draft = makeDraft({ mode: 'docx-deterministic' });
    draft.fieldProvenance = Object.fromEntries(fields.map(field => [
        field,
        field === 'images'
            ? provenance('missing')
            : provenance('deterministic-source', {
                sourceId: 'docx-1', evidenceRef: `docx:${field}`
            })
    ]));
    const result = Policy.evaluateDraftAdmission(
        draft,
        context('docx-deterministic', {
            source: { sourceId: 'docx-1', batchId: 'batch-1' }
        })
    );
    assert.equal(result.accepted, true, JSON.stringify(result.errors));
    assert.equal(
        result.fieldDecisions.some(item => item.status === 'controlled-write'),
        false
    );
});

test('pure manual question is accepted without a recognition engine', () => {
    const draft = makeDraft({
        mode: 'manual', type: '解答题', answer: '', solution: 'manual solution'
    });
    draft.recognition = null;
    draft.fieldProvenance = Object.fromEntries(fields.map(field => [
        field,
        ['options', 'answer', 'images'].includes(field)
            ? provenance('missing')
            : provenance('manual', { manualEditRevision: 1 })
    ]));
    const result = Policy.evaluateDraftAdmission(draft, context('manual'));
    assert.equal(result.accepted, true, JSON.stringify(result.errors));
});

test('imported package with an invalid schema is rejected', () => {
    const draft = makeDraft({ mode: 'imported-package' });
    draft.fieldProvenance = Object.fromEntries(fields.map(field => [
        field,
        field === 'images'
            ? provenance('missing')
            : provenance('deterministic-source', {
                sourceId: 'package-1', evidenceRef: `package:${field}`
            })
    ]));
    const result = Policy.evaluateDraftAdmission(
        draft,
        context('imported-package', {
            packageSchemaValid: false,
            source: { sourceId: 'package-1', packageHash: 'hash-1' }
        })
    );
    assert.equal(result.accepted, false);
    assert.ok(errorCodes(result).includes('admission-package-schema-invalid'));
});

test('malformed admission decision fails validation', () => {
    const draft = makeDraft();
    const validation = Policy.validateAdmissionDecision(
        { accepted: true, fieldDecisions: 'not-an-array' },
        draft,
        context('pdf-ai')
    );
    assert.equal(validation.valid, false);
    assert.ok(validation.errors.some(
        error => error.code === 'admission-decision-malformed'
    ));
});

test('missing field provenance fails closed', () => {
    const draft = makeDraft();
    delete draft.fieldProvenance.answer;
    const result = Policy.evaluateDraftAdmission(draft, context('pdf-ai'));
    assert.equal(result.accepted, false);
    assert.ok(errorCodes(result).includes('admission-provenance-missing'));
});

test('duplicate field decision is rejected', () => {
    const draft = makeDraft();
    const evaluated = Policy.evaluateDraftAdmission(draft, context('pdf-ai'));
    const duplicate = {
        ...evaluated,
        fieldDecisions: [
            ...evaluated.fieldDecisions,
            evaluated.fieldDecisions[0]
        ]
    };
    const validation = Policy.validateAdmissionDecision(
        duplicate,
        draft,
        context('pdf-ai')
    );
    assert.equal(validation.valid, false);
    assert.ok(validation.errors.some(
        error => error.code === 'admission-provenance-duplicate'
    ));
});

test('fresh policy decision validates against the same draft and context', () => {
    const draft = makeDraft();
    const admissionContext = context('pdf-ai');
    const decision = Policy.evaluateDraftAdmission(draft, admissionContext);
    const validation = Policy.validateAdmissionDecision(
        decision,
        draft,
        admissionContext
    );
    assert.equal(decision.accepted, true);
    assert.equal(validation.valid, true, JSON.stringify(validation.errors));
});

test('buildQuestionV2 preserves admission and field provenance immutably', () => {
    const draft = makeDraft();
    const admissionContext = context('pdf-ai');
    const decision = Policy.evaluateDraftAdmission(draft, admissionContext);
    const question = Policy.buildQuestionV2(draft, decision, {
        id: 'question-1',
        context: admissionContext
    });
    assert.equal(question.schemaVersion, 'qisi.question.v2');
    assert.equal(question.admission.decisionId, decision.decisionId);
    assert.equal(question.provenance.answer.status, 'controlled-write');
    assert.equal(question.source.mode, 'pdf-ai');
    assert.equal(Object.isFrozen(question), true);
    assert.equal(Object.isFrozen(question.provenance.answer), true);
});
