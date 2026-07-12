const test = require('node:test');
const assert = require('node:assert/strict');

const Contracts = require('../qisi-recognition-contracts.js');

const validRecognitionInput = () => ({
    engine: 'mock-ocr',
    engineVersion: '1.0',
    requestId: 'request-1',
    sourceId: 'source-1',
    page: 1,
    rawText: '1. question',
    blocks: [{ text: '1. question' }],
    formulas: [],
    images: [],
    rawEvidence: { pageHash: 'hash-1' },
    engineConfidence: 0.9,
    warnings: [],
    durationMs: 12
});

const validDraftInput = () => ({
    sourceId: 'source-1',
    sourceOrder: 1,
    questionNumber: '1',
    type: 'single-choice',
    stem: 'Choose the correct value.',
    options: ['1', '2', '3', '4'],
    answer: 'A',
    solution: 'Direct calculation.',
    images: [],
    provenance: { stem: { page: 1, engine: 'mock-ocr' } },
    confidenceByField: { stem: 0.9, answer: 0.8 },
    warnings: [],
    rawEvidence: { sourceText: 'raw' }
});

test('recognition factory returns an immutable independent candidate', () => {
    const input = validRecognitionInput();
    const candidate = Contracts.createRecognitionCandidate(input);

    input.blocks[0].text = 'changed';
    input.rawEvidence.pageHash = 'changed';

    assert.equal(candidate.schemaVersion, Contracts.SCHEMA_VERSION);
    assert.equal(candidate.blocks[0].text, '1. question');
    assert.equal(candidate.rawEvidence.pageHash, 'hash-1');
    assert.equal(Object.isFrozen(candidate), true);
    assert.equal(Object.isFrozen(candidate.blocks[0]), true);
    assert.deepEqual(
        Contracts.validateRecognitionCandidate(candidate),
        { valid: true, errors: [], warnings: [] }
    );
});

test('recognition validator rejects missing linkage and invalid metrics', () => {
    const candidate = Contracts.createRecognitionCandidate({
        ...validRecognitionInput(),
        sourceId: '',
        page: 0,
        engineConfidence: 1.2,
        durationMs: -1
    });
    const result = Contracts.validateRecognitionCandidate(candidate);

    assert.equal(result.valid, false);
    assert.deepEqual(
        new Set(result.errors.map(error => error.code)),
        new Set(['missing-field', 'invalid-type', 'invalid-confidence'])
    );
});

test('structured draft factory preserves evidence and does not mutate input', () => {
    const input = validDraftInput();
    const before = structuredClone(input);
    const draft = Contracts.createStructuredQuestionDraft(input);

    assert.deepEqual(input, before);
    assert.notEqual(draft.options, input.options);
    assert.notEqual(draft.provenance, input.provenance);
    assert.deepEqual(draft.rawEvidence, input.rawEvidence);
    assert.deepEqual(
        Contracts.validateStructuredQuestionDraft(draft),
        { valid: true, errors: [], warnings: [] }
    );
});

test('structured validator rejects raw JSON, fenced wrappers, and guessed answers', () => {
    const jsonStem = Contracts.createStructuredQuestionDraft({
        ...validDraftInput(),
        stem: '{"questions":[{"stem":"unsafe"}]}'
    });
    const fencedOption = Contracts.createStructuredQuestionDraft({
        ...validDraftInput(),
        options: ['```\nunsafe wrapper\n```']
    });
    const guessedAnswer = Contracts.createStructuredQuestionDraft({
        ...validDraftInput(),
        answer: 'therefore A'
    });

    assert.equal(
        Contracts.validateStructuredQuestionDraft(jsonStem)
            .errors.some(error => error.code === 'unsafe-wrapper'),
        true
    );
    assert.equal(
        Contracts.validateStructuredQuestionDraft(fencedOption)
            .errors.some(error => error.code === 'unsafe-wrapper'),
        true
    );
    assert.equal(
        Contracts.validateStructuredQuestionDraft(guessedAnswer)
            .errors.some(error => error.code === 'ownership-invalid'),
        true
    );
});

test('validators report malformed answer types without throwing', () => {
    const malformed = Contracts.createStructuredQuestionDraft({
        ...validDraftInput(),
        answer: { guessed: 'A' }
    });

    assert.doesNotThrow(() =>
        Contracts.validateStructuredQuestionDraft(malformed)
    );
    assert.equal(
        Contracts.validateStructuredQuestionDraft(malformed)
            .errors.some(error =>
                error.code === 'invalid-type' &&
                error.path === 'answer'
            ),
        true
    );
});

test('confirmed question requires controlled-write and manual confirmation', () => {
    const base = {
        id: 'question-1',
        schemaVersion: Contracts.SCHEMA_VERSION,
        sourceMetadata: { sourceId: 'source-1' },
        questionNumber: '1',
        type: 'single-choice',
        stem: 'Question',
        options: ['1', '2', '3', '4'],
        answer: 'A',
        solution: 'Solution',
        images: [],
        knowledgePoints: [],
        difficulty: '',
        tags: [],
        recognitionEngine: 'mock-ocr',
        provenance: {},
        manualEdited: false,
        confirmedAt: '2026-07-12T00:00:00.000Z',
        createdAt: '2026-07-12T00:00:00.000Z',
        updatedAt: '2026-07-12T00:00:00.000Z'
    };

    const rejected = Contracts.validateConfirmedQuestion(base);
    assert.equal(rejected.valid, false);
    assert.equal(
        rejected.errors.some(
            error => error.code === 'controlled-write-required'
        ),
        true
    );
    assert.equal(
        rejected.errors.some(
            error => error.code === 'manual-confirmation-required'
        ),
        true
    );

    const accepted = Contracts.validateConfirmedQuestion({
        ...base,
        provenance: {
            controlledWriteAccepted: true,
            manualConfirmed: true
        }
    });
    assert.equal(accepted.valid, true);
});
