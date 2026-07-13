const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ControlledWrite = require('../qisi-pdf-support-controlled-write.js');
const BlockParser = require('../qisi-pdf-support-block-parser.js');
const Aligner = require('../qisi-pdf-support-aligner.js');
const fixtures = require('./fixtures/pdf-real-case-minimal.js');

const ROOT = path.resolve(__dirname, '..');

const runProductionDecision = fixture => {
    const parserGate = ControlledWrite.buildPdfSupportParserGate({
        parsePdfSupportBlocks: BlockParser.parsePdfSupportBlocks,
        alignPdfSupport: Aligner.alignPdfSupport,
        file: { id: fixture.id, filename: `${fixture.id}.pdf` },
        expectedQuestionNumbers: fixture.expectedQuestionNumbers,
        rawTextPages: fixture.rawTextPages
    });
    const controlledWrite = ControlledWrite.buildPdfSupportFieldLevelControlledWrite({
        drafts: fixture.questionItems,
        legacySafeAnswerItems: fixture.legacySafeAnswerItems || [],
        legacySafeSolutionItems: fixture.legacySafeSolutionItems || [],
        parserSafeAnswerItems: parserGate?.answers || [],
        parserSafeSolutionItems: parserGate?.solutions || [],
        parserFusedQuestionNumbers: parserGate?.fusedQuestionNumbers || []
    });
    return { parserGate, controlledWrite };
};

test('production Bridge projection uses the real parser, aligner, and controlled-write owners', () => {
    const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    const projection = fs.readFileSync(
        path.join(ROOT, 'qisi-pdf-candidate-projection.js'), 'utf8'
    );
    assert.match(app, /PdfCandidateProjection[\s\S]*createProductionProjectionContextBuilder/);
    assert.doesNotMatch(app, /PdfSupportControlledWrite|PdfSupportBlockParser|PdfSupportAligner/);
    assert.match(projection, /createProductionProjectionContextBuilder/);
    assert.match(projection, /controlledWriteOwner\.buildPdfSupportParserGate/);
    assert.match(
        projection,
        /controlledWriteOwner[\s\S]{0,80}\.buildPdfSupportFieldLevelControlledWrite/
    );
});

test('legacy full support characterization preserves every accepted field decision', () => {
    const fixture = fixtures.realStyleSectionFixture;
    const { parserGate, controlledWrite } = runProductionDecision(fixture);
    assert.equal(parserGate.mode, 'full');
    assert.deepEqual(parserGate.fusedQuestionNumbers, []);
    assert.deepEqual(
        controlledWrite.answerQuestionNumbers,
        fixture.expected.answerDetectedNumbers
    );
    assert.deepEqual(
        controlledWrite.solutionQuestionNumbers,
        fixture.expected.solutionDetectedNumbers
    );
    assert.equal(controlledWrite.warnings.length, 0);
});

test('legacy safe-prefix characterization withholds the suffix after a missing answer', () => {
    const fixture = fixtures.missingAnswerWithSolution;
    const { parserGate, controlledWrite } = runProductionDecision(fixture);
    assert.equal(parserGate.mode, fixture.expected.mode);
    assert.deepEqual(parserGate.safeQuestionNumbers, fixture.expected.safeQuestionNumbers);
    assert.deepEqual(parserGate.fusedQuestionNumbers, fixture.expected.fusedQuestionNumbers);
    assert.deepEqual(controlledWrite.answerQuestionNumbers, ['1']);
    assert.deepEqual(controlledWrite.solutionQuestionNumbers, ['1']);
});

test('legacy missing-answer characterization does not let complete solutions unlock answers', () => {
    const fixture = fixtures.p7AnswerRejectionFixture;
    const { controlledWrite } = runProductionDecision(fixture);
    assert.deepEqual(
        controlledWrite.answerQuestionNumbers,
        fixture.expected.controlledWriteAnswerNumbers
    );
    assert.deepEqual(
        controlledWrite.solutionQuestionNumbers,
        fixture.expected.controlledWriteSolutionNumbers
    );
    assert.deepEqual(
        controlledWrite.warnings.map(item => item.questionNumber),
        fixture.expected.rejectedAnswerNumbers
    );
});

test('legacy rejected-solution characterization retains an explicit none decision', () => {
    const controlledWrite = ControlledWrite.buildPdfSupportFieldLevelControlledWrite({
        drafts: [{ questionNumber: '1', type: 'subjective', stem: 'Q1' }],
        parserSafeAnswerItems: [{ question: '1', answer: 'A' }],
        parserSafeSolutionItems: [{ question: '1', solution: 'x' }]
    });
    assert.deepEqual(controlledWrite.solutionQuestionNumbers, []);
    assert.deepEqual(
        controlledWrite.fieldDecisions.find(item => item.field === 'solution'),
        { questionNumber: '1', field: 'solution', source: 'none', reason: 'no-usable-safe-solution' }
    );
});

test('legacy answer-solution mismatch characterization fails closed', () => {
    const result = Aligner.alignPdfSupport({
        answerItems: [{ question: '1', answer: 'A' }, { question: '2', answer: 'B' }],
        solutionItems: [{ question: '1', solution: 'S1' }, { question: '3', solution: 'S3' }],
        expectedQuestionNumbers: ['1', '2', '3']
    });
    assert.notEqual(result.mode, 'full');
    assert.deepEqual(result.safeQuestionNumbers, ['1']);
    assert.equal(result.safeAnswerItems.some(item => item.question === '2'), false);
    assert.equal(result.safeSolutionItems.some(item => item.question === '3'), false);
});

test('legacy gap and rewind characterizations never accept beyond the reliable prefix', () => {
    for (const sequence of [['1', '3'], ['1', '3', '2']]) {
        const result = Aligner.alignPdfSupport({
            answerItems: sequence.map(question => ({ question, answer: `A${question}` })),
            solutionItems: sequence.map(question => ({ question, solution: `S${question}` })),
            expectedQuestionNumbers: ['1', '2', '3']
        });
        assert.notEqual(result.mode, 'full', sequence.join(','));
        assert.deepEqual(result.safeQuestionNumbers, ['1'], sequence.join(','));
    }
});

test('legacy controlled-write preserves stable formula and image evidence references', () => {
    const answer = {
        question: '1',
        answer: 'A',
        sourceTrace: { blockIds: ['block-answer-1'], sourcePage: 2 }
    };
    const solution = {
        question: '1',
        solution: String.raw`Use \frac{1}{2}.`,
        imageRefs: ['image-evidence-1'],
        sourceTrace: { blockIds: ['block-solution-1'], sourcePage: 2 }
    };
    const controlledWrite = ControlledWrite.buildPdfSupportFieldLevelControlledWrite({
        drafts: [{
            questionNumber: '1', type: 'single', stem: 'Q1',
            options: ['A. one', 'B. two']
        }],
        parserSafeAnswerItems: [answer],
        parserSafeSolutionItems: [solution]
    });
    assert.deepEqual(controlledWrite.effectiveAnswerItems[0].sourceTrace, answer.sourceTrace);
    assert.deepEqual(controlledWrite.effectiveSolutionItems[0].sourceTrace, solution.sourceTrace);
    assert.deepEqual(controlledWrite.effectiveSolutionItems[0].imageRefs, solution.imageRefs);
    assert.equal(controlledWrite.effectiveSolutionItems[0].solution, solution.solution);
});

test('legacy raw JSON candidate is not a provenance or controlled-write decision', () => {
    const controlledWrite = ControlledWrite.buildPdfSupportFieldLevelControlledWrite({
        drafts: [{ questionNumber: '1', stem: '{"questions":[{"stem":"raw"}]}' }]
    });
    assert.deepEqual(controlledWrite.answerQuestionNumbers, []);
    assert.deepEqual(controlledWrite.solutionQuestionNumbers, []);
    assert.equal(Object.hasOwn(controlledWrite, 'fieldProvenance'), false);
    assert.equal(Object.hasOwn(controlledWrite, 'supportLevel'), false);
});

test('legacy decision output has no safe default for source mode or canonical handoff', () => {
    const controlledWrite = ControlledWrite.buildPdfSupportFieldLevelControlledWrite({
        drafts: [{ questionNumber: '1', stem: 'Q1' }]
    });
    assert.equal(Object.hasOwn(controlledWrite, 'source'), false);
    assert.equal(Object.hasOwn(controlledWrite, 'manualReviewRequired'), false);
    assert.equal(Object.hasOwn(controlledWrite, 'validation'), false);
});
