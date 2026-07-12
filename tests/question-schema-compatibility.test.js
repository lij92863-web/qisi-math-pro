const test = require('node:test');
const assert = require('node:assert/strict');

const Contracts = require('../qisi-recognition-contracts.js');

test('legacy compatibility preserves content and adds only safe metadata', () => {
    const legacy = {
        question: '7',
        order: 3,
        type: '填空题',
        stem: 'Legacy stem',
        options: [],
        answer: '',
        solution: 'Legacy solution',
        images: [{ id: 'image-1' }]
    };
    const before = structuredClone(legacy);
    const structured = Contracts.legacyDraftToStructuredDraft(legacy);

    assert.deepEqual(legacy, before);
    assert.equal(structured.questionNumber, legacy.question);
    assert.equal(structured.sourceOrder, legacy.order);
    assert.equal(structured.stem, legacy.stem);
    assert.equal(structured.answer, legacy.answer);
    assert.equal(structured.solution, legacy.solution);
    assert.equal(structured.sourceId, 'legacy:unknown');
    assert.equal(structured.provenance.compatibilitySource, 'legacy');
    assert.equal(structured.provenance.manualConfirmed, false);
    assert.equal(
        structured.warnings.includes(
            'legacy-compatibility-manual-review-required'
        ),
        true
    );
    assert.deepEqual(structured.rawEvidence.legacyDraft, legacy);
});

test('compatibility does not invent a missing question number, order, or answer', () => {
    const structured = Contracts.legacyDraftToStructuredDraft({
        stem: 'Evidence without ownership'
    });
    const validation = Contracts.validateStructuredQuestionDraft(structured);

    assert.equal(structured.questionNumber, '');
    assert.equal(structured.sourceOrder, null);
    assert.equal(structured.answer, '');
    assert.equal(validation.valid, false);
    assert.deepEqual(
        new Set(validation.errors.map(error => error.path)),
        new Set(['sourceOrder', 'questionNumber', 'type'])
    );
});

test('structured-to-legacy mapping preserves fields and independent evidence', () => {
    const structured = Contracts.createStructuredQuestionDraft({
        sourceId: 'source-2',
        sourceOrder: 2,
        questionNumber: '9',
        type: '多选题',
        stem: 'Structured stem',
        options: ['A1', 'B1', 'C1', 'D1'],
        answer: 'AC',
        solution: 'Structured solution',
        images: [],
        provenance: { answer: { page: 4 } },
        confidenceByField: { answer: 0.8 },
        warnings: ['manual-review'],
        rawEvidence: { hash: 'evidence' }
    });
    const legacy = Contracts.structuredDraftToLegacyReviewDraft(structured);

    assert.equal(legacy.question, structured.questionNumber);
    assert.equal(legacy.questionNumber, structured.questionNumber);
    assert.equal(legacy.order, structured.sourceOrder);
    assert.equal(legacy.answer, structured.answer);
    assert.deepEqual(legacy.provenance, structured.provenance);
    assert.notEqual(legacy.provenance, structured.provenance);
    assert.equal(Object.isFrozen(legacy), true);
});

test('unsupported schema remains explicit and fails closed', () => {
    const candidate = Contracts.createRecognitionCandidate({
        schemaVersion: 'qisi.question.v999',
        engine: 'mock',
        requestId: 'request',
        sourceId: 'source',
        rawText: '',
        durationMs: 0
    });
    const result = Contracts.validateRecognitionCandidate(candidate);

    assert.equal(result.valid, false);
    assert.equal(result.errors[0].code, 'unsupported-schema');
    assert.equal(result.errors[0].path, 'schemaVersion');
});
