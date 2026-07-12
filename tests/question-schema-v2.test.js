const test = require('node:test');
const assert = require('node:assert/strict');

const Contracts = require('../qisi-recognition-contracts.js');
const Policy = require('../qisi-formal-admission-policy.js');

const fields = Policy.FORMAL_FIELDS;
const time = '2026-07-13T01:00:00.000Z';

const makeQuestion = ({ mode = 'manual', type = '解答题' } = {}) => {
    const values = {
        questionNumber: '1',
        type,
        stem: 'Question stem',
        options: type === '单选题' ? ['A1', 'B1', 'C1', 'D1'] : [],
        answer: type === '单选题' ? 'A' : '',
        solution: 'Solution',
        images: []
    };
    const provenance = Object.fromEntries(fields.map(field => {
        const hasValue = Array.isArray(values[field])
            ? values[field].length > 0
            : Boolean(values[field]);
        if (!hasValue) return [field, { field, status: 'missing' }];
        if (mode === 'manual') {
            return [field, {
                field, status: 'manual', manualEditRevision: 1
            }];
        }
        if (mode === 'docx-deterministic' || mode === 'imported-package') {
            return [field, {
                field,
                status: 'deterministic-source',
                sourceId: 'source-1',
                evidenceRef: `${mode}:${field}`
            }];
        }
        return [field, {
            field,
            status: 'controlled-write',
            sourceId: 'source-1',
            controlledWriteAccepted: true,
            controlledWriteDecisionId: `cw-${field}`
        }];
    }));
    return {
        id: 'question-1',
        schemaVersion: 'qisi.question.v2',
        ...values,
        source: {
            mode,
            sourceId: 'source-1',
            batchId: 'batch-1'
        },
        admission: {
            schemaVersion: 'qisi.admission.v1',
            decisionId: 'decision-1',
            mode,
            policyVersion: 'formal-admission-r1',
            draftId: 'draft-1',
            draftVersion: 1,
            confirmedBy: 'teacher-1',
            confirmedAt: time,
            idempotencyKey: 'confirm-1'
        },
        provenance,
        recognition: mode === 'manual' ? null : {
            engine: mode === 'pdf-ai' ? 'mock-ocr' : 'docx-parser',
            engineVersion: 'fixture',
            requestIds: ['request-1'],
            candidateRefs: ['candidate-1']
        },
        createdAt: time,
        updatedAt: time,
        confirmedAt: time
    };
};

const codes = result => result.errors.map(error => error.code);

test('manual question v2 accepts nullable recognition and ISO timestamps', () => {
    const result = Contracts.validateQuestionV2(makeQuestion());
    assert.equal(result.valid, true, JSON.stringify(result.errors));
});

test('DOCX deterministic v2 does not require or fabricate controlled-write', () => {
    const question = makeQuestion({ mode: 'docx-deterministic', type: '单选题' });
    const result = Contracts.validateQuestionV2(question);
    assert.equal(result.valid, true, JSON.stringify(result.errors));
    assert.equal(
        Object.values(question.provenance).some(
            item => item.status === 'controlled-write'
        ),
        false
    );
});

test('PDF/AI v2 accepts field-scoped controlled-write evidence', () => {
    const result = Contracts.validateQuestionV2(
        makeQuestion({ mode: 'pdf-ai', type: '单选题' })
    );
    assert.equal(result.valid, true, JSON.stringify(result.errors));
});

test('numeric or out-of-order v2 timestamps fail validation', () => {
    const numeric = makeQuestion();
    numeric.updatedAt = Date.now();
    assert.ok(codes(Contracts.validateQuestionV2(numeric)).includes('invalid-time'));

    const ordered = makeQuestion();
    ordered.updatedAt = '2026-07-12T00:00:00.000Z';
    assert.ok(codes(Contracts.validateQuestionV2(ordered)).includes('time-order-invalid'));
});

test('source and admission mode mismatch fails closed', () => {
    const question = makeQuestion();
    question.admission.mode = 'pdf-ai';
    const result = Contracts.validateQuestionV2(question);
    assert.equal(result.valid, false);
    assert.ok(codes(result).includes('admission-source-mismatch'));
});

test('missing field provenance fails closed', () => {
    const question = makeQuestion();
    delete question.provenance.stem;
    const result = Contracts.validateQuestionV2(question);
    assert.equal(result.valid, false);
    assert.ok(codes(result).includes('provenance-missing'));
});

test('rejected provenance cannot accompany a formal value', () => {
    const question = makeQuestion();
    question.provenance.stem = { field: 'stem', status: 'rejected' };
    const result = Contracts.validateQuestionV2(question);
    assert.equal(result.valid, false);
    assert.ok(codes(result).includes('provenance-value-conflict'));
});

test('manual field cannot carry engine confidence', () => {
    const question = makeQuestion();
    question.provenance.stem.engineConfidence = 0.9;
    const result = Contracts.validateQuestionV2(question);
    assert.equal(result.valid, false);
    assert.ok(codes(result).includes('manual-engine-evidence-forbidden'));
});

test('DOCX field cannot claim controlled-write evidence', () => {
    const question = makeQuestion({ mode: 'docx-deterministic' });
    question.provenance.stem = {
        field: 'stem',
        status: 'controlled-write',
        controlledWriteAccepted: true,
        controlledWriteDecisionId: 'fake-cw'
    };
    const result = Contracts.validateQuestionV2(question);
    assert.equal(result.valid, false);
    assert.ok(codes(result).includes('controlled-write-mode-invalid'));
});

test('validator is non-mutating for malformed arrays and records', () => {
    const question = makeQuestion();
    question.options = 'not-an-array';
    const before = structuredClone(question);
    const result = Contracts.validateQuestionV2(question);
    assert.equal(result.valid, false);
    assert.deepEqual(question, before);
    assert.ok(codes(result).includes('invalid-type'));
});
