const test = require('node:test');
const assert = require('node:assert/strict');

const Scoring = require('../scripts/benchmark/score-ocr-result.js');

const question = (overrides = {}) => ({
    page: 1,
    sourceOrder: 1,
    questionNumber: '1',
    stem: '求 x 的值',
    options: [],
    answer: '2',
    solution: '由 x+1=3 得 x=2',
    formulas: [{ rawText: 'x+1=3', latex: 'x+1=3', bbox: null }],
    images: [],
    ...overrides
});
const truthDocument = (overrides = {}) => ({
    documentId: 'doc-1',
    qualityTags: ['formula-dense'],
    questions: [question()],
    ...overrides
});

const resultDocument = (overrides = {}) => ({
    documentId: 'doc-1',
    status: 'ok',
    questions: [question()],
    safetyEvents: [],
    humanCost: {
        correctedQuestions: 0,
        correctedFields: 0,
        correctionTimeMs: 0,
        reRecognitionCount: 0,
        manualReviewRate: 0
    },
    ...overrides
});

test('R1 document scoring emits text, formula, structure, safety, and human-cost metrics without source text', () => {
    const score = Scoring.scoreDocumentR1(truthDocument(), resultDocument());
    assert.equal(score.status, 'ok');
    assert.equal(score.metrics.rawCer, 0);
    assert.equal(score.metrics.normalizedCer, 0);
    assert.equal(score.metrics.formula.tokenF1, 1);
    assert.equal(score.metrics.formula.exactMatch, 1);
    assert.equal(score.metrics.structure.questionPrecision, 1);
    assert.equal(score.metrics.structure.ownershipAccuracy, 1);
    assert.deepEqual(score.safety, {
        wrongAnswerAttachment: 0,
        wrongSolutionAttachment: 0,
        fabricatedQuestion: 0,
        rawJsonLeakage: 0,
        placeholderLeakage: 0,
        unsafeSequenceAccepted: 0,
        ownershipMismatchAccepted: 0,
        controlledWriteBypass: 0,
        formalAdmissionBypass: 0
    });
    assert.equal(JSON.stringify(score).includes('求 x 的值'), false);
    assert.equal(JSON.stringify(score).includes('由 x+1=3'), false);
});

test('R1 matching uses document, page, sourceOrder, and questionNumber rather than semantic text', () => {
    const result = resultDocument({
        questions: [question({ questionNumber: '2' })]
    });
    const score = Scoring.scoreDocumentR1(truthDocument(), result);
    assert.equal(score.metrics.structure.matchedQuestions, 0);
    assert.equal(score.metrics.structure.questionRecall, 0);
    assert.equal(score.safety.fabricatedQuestion, 1);
});

test('R1 safety keeps each fatal class separate and wrong attachments are not averaged away', () => {
    const result = resultDocument({
        questions: [question({ answer: '3', solution: 'wrong' })],
        safetyEvents: [
            { code: 'raw-json-leakage' },
            { code: 'placeholder-leakage' },
            { code: 'unsafe-sequence-accepted' },
            { code: 'ownership-mismatch-accepted' },
            { code: 'controlled-write-bypass' },
            { code: 'formal-admission-bypass' }
        ]
    });
    const score = Scoring.scoreDocumentR1(truthDocument(), result);
    assert.equal(score.safety.wrongAnswerAttachment, 1);
    assert.equal(score.safety.wrongSolutionAttachment, 1);
    assert.equal(score.safety.rawJsonLeakage, 1);
    assert.equal(score.safety.placeholderLeakage, 1);
    assert.equal(score.safety.unsafeSequenceAccepted, 1);
    assert.equal(score.safety.ownershipMismatchAccepted, 1);
    assert.equal(score.safety.controlledWriteBypass, 1);
    assert.equal(score.safety.formalAdmissionBypass, 1);
});

test('document aggregation is seeded, stratified by quality tag, and keeps timeout explicit', () => {
    const completed = Scoring.scoreDocumentR1(truthDocument(), resultDocument());
    const timeout = Scoring.scoreDocumentR1(
        truthDocument({ documentId: 'doc-2', qualityTags: ['scanned-pdf'] }),
        { documentId: 'doc-2', status: 'timeout', failure: { code: 'ocr-timeout', message: 'private source text' } }
    );
    const first = Scoring.aggregateDocumentsR1([completed, timeout], {
        seed: 17,
        bootstrapIterations: 100
    });
    const second = Scoring.aggregateDocumentsR1([completed, timeout], {
        seed: 17,
        bootstrapIterations: 100
    });
    assert.deepEqual(first, second);
    assert.equal(first.documentCount, 2);
    assert.equal(first.completedDocumentCount, 1);
    assert.equal(first.statusCounts.timeout, 1);
    assert.equal(first.promotionEligible, false);
    assert.equal(first.failures[0].code, 'ocr-timeout');
    assert.equal(JSON.stringify(first).includes('private source text'), false);
    assert.ok(first.statistics.rawCer.ci95);
    assert.ok(first.perCategory['formula-dense']);
    assert.ok(first.perCategory['scanned-pdf']);
});
