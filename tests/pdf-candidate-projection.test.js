const test = require('node:test');
const assert = require('node:assert/strict');

const ControlledWrite = require('../qisi-pdf-support-controlled-write.js');

const Projection = require('../qisi-pdf-candidate-projection.js');

const buildControlledWrite = ({
    draft,
    answer = 'A',
    solution = 'because',
    includeAnswer = true,
    includeSolution = true,
    decisionId = 'cw:pdf-question:1'
} = {}) => ({
    ...ControlledWrite.buildPdfSupportFieldLevelControlledWrite({
        drafts: [draft],
        parserSafeAnswerItems: includeAnswer ? [{
            questionNumber: draft.questionNumber,
            answer,
            evidenceId: 'support-answer-1',
            sourceTrace: { page: 2, blockIds: ['answer-block-1'] }
        }] : [],
        parserSafeSolutionItems: includeSolution ? [{
            questionNumber: draft.questionNumber,
            solution,
            evidenceId: 'support-solution-1',
            sourceTrace: { page: 2, blockIds: ['solution-block-1'] }
        }] : []
    }),
    decisionId
});

const question = overrides => ({
    id: 'draft-pdf-1',
    questionNumber: '1',
    type: 'choice',
    stem: 'Which value is correct?',
    options: [
        { label: 'A', text: '1' },
        { label: 'B', text: '2' },
        { label: 'C', text: '3' },
        { label: 'D', text: '4' }
    ],
    answer: '',
    solution: '',
    images: [{ id: 'question-image-1' }],
    ...overrides
});

const fieldEvidence = () => ({
    questionNumber: { page: 1, blockIds: ['question-block-1'] },
    stem: { page: 1, blockIds: ['question-block-1'] },
    options: { page: 1, blockIds: ['question-block-1'] },
    answer: { page: 2, blockIds: ['answer-block-1'] },
    solution: { page: 2, blockIds: ['solution-block-1'] },
    images: { page: 1, blockIds: ['question-image-1'] }
});

const project = overrides => {
    const parsedQuestion = overrides?.parsedQuestion || question();
    return Projection.projectPdfCandidate({
        source: {
            sourceId: 'pdf-question',
            sourceType: 'pdf',
            sourceOrder: 1
        },
        engineResult: {
            sourceKind: 'textLayer',
            engine: 'pdf-text-layer',
            requestId: 'engine-request-1'
        },
        parsedQuestion,
        alignmentResult: {
            mode: 'full',
            safeQuestionNumbers: ['1'],
            fusedQuestionNumbers: [],
            warnings: []
        },
        controlledWriteDecision: buildControlledWrite({
            draft: parsedQuestion
        }),
        evidence: {
            fields: fieldEvidence(),
            rawEvidenceRefs: [
                { evidenceId: 'question-block-1' },
                { evidenceId: 'support-answer-1' },
                { evidenceId: 'support-solution-1' }
            ]
        },
        pageContext: { page: 1, sourceOrder: 1 },
        validation: {
            schemaValid: true,
            sequenceValid: true,
            ownershipValid: true
        },
        ...overrides
    });
};

test('projects a fully supported deterministic PDF candidate from real controlled-write output', () => {
    const result = project();

    assert.equal(result.source.mode, 'pdf-deterministic');
    assert.equal(result.source.sourceId, 'pdf-question');
    assert.equal(result.source.sourceOrder, 1);
    assert.equal(result.answer, 'A');
    assert.equal(result.solution, 'because');
    assert.equal(result.fieldProvenance.stem.kind, 'deterministic-source');
    assert.equal(result.fieldProvenance.stem.status, 'deterministic-source');
    assert.equal(result.fieldProvenance.answer.kind, 'controlled-write');
    assert.equal(result.fieldProvenance.answer.controlledWriteDecisionId, 'cw:pdf-question:1');
    assert.deepEqual(result.controlledWrite.acceptedFields, ['answer', 'solution']);
    assert.deepEqual(result.controlledWrite.rejectedFields, []);
    assert.equal(result.supportLevel, 'full');
    assert.equal(result.manualReviewRequired, false);
    assert.deepEqual(result.validation, {
        schemaValid: true,
        sequenceValid: true,
        ownershipValid: true
    });
    assert.equal(result.diagnostics.requestId, 'engine-request-1');
    assert.equal(result.diagnostics.controlledWriteDecisionId, 'cw:pdf-question:1');
    assert.equal(Object.isFrozen(result), true);
});

test('derives prefix and safe-partial states from alignment and field decisions, not completeness percentage', () => {
    const stemOnly = question({ type: 'solution', options: [], images: [] });
    const prefix = project({
        parsedQuestion: stemOnly,
        alignmentResult: {
            mode: 'prefix', safeQuestionNumbers: ['1'],
            fusedQuestionNumbers: [], warnings: [{ code: 'sequence-prefix' }]
        },
        controlledWriteDecision: buildControlledWrite({
            draft: stemOnly, includeAnswer: false, includeSolution: false
        }),
        validation: {
            schemaValid: true, sequenceValid: true, ownershipValid: true
        }
    });
    assert.equal(prefix.supportLevel, 'prefix');
    assert.equal(prefix.manualReviewRequired, true);
    assert.equal(prefix.fieldProvenance.answer.kind, 'missing');
    assert.equal(prefix.fieldProvenance.solution.kind, 'missing');

    const missingAnswer = project({
        controlledWriteDecision: buildControlledWrite({
            draft: question(), includeAnswer: false
        })
    });
    assert.equal(missingAnswer.supportLevel, 'safe-partial');
    assert.equal(missingAnswer.answer, '');
    assert.equal(missingAnswer.fieldProvenance.answer.kind, 'missing');
    assert.equal(missingAnswer.manualReviewRequired, true);

    const rejectedSolution = project({
        controlledWriteDecision: buildControlledWrite({
            draft: question(), includeSolution: false
        })
    });
    assert.equal(rejectedSolution.supportLevel, 'safe-partial');
    assert.equal(rejectedSolution.solution, '');
    assert.equal(rejectedSolution.fieldProvenance.solution.kind, 'rejected');
    assert.equal(rejectedSolution.controlledWrite.rejectedFields.includes('solution'), true);
});

test('preserves formula fallback, image evidence, warnings, and raw evidence identities', () => {
    const result = project({
        evidence: {
            fields: fieldEvidence(),
            formulaFallback: true,
            rawEvidenceRefs: [
                { evidenceId: 'question-block-1', requestId: 'volatile-1' },
                { imageId: 'question-image-1', page: 1 }
            ]
        },
        engineResult: {
            sourceKind: 'textLayer',
            engine: 'pdf-text-layer',
            warnings: [{ code: 'formula-fallback' }]
        }
    });

    assert.equal(result.supportLevel, 'full');
    assert.equal(result.manualReviewRequired, true);
    assert.deepEqual(result.fieldProvenance.images.blockIds, ['question-image-1']);
    assert.equal(result.warnings.some(item => item.code === 'formula-fallback'), true);
    assert.deepEqual(result.rawEvidenceRefs.map(item => item.evidenceId || item.imageId), [
        'question-block-1',
        'question-image-1',
        'answer-block-1',
        'support-answer-1',
        'solution-block-1',
        'support-solution-1'
    ]);
});

test('canonical comparator reports structured safety differences and ignores only volatile values', () => {
    const left = project();
    const equalExceptVolatile = structuredClone(left);
    equalExceptVolatile.requestId = 'another-request';
    equalExceptVolatile.createdAt = 999;
    equalExceptVolatile.rawEvidenceRefs[0].requestId = 'another-evidence-request';
    assert.deepEqual(
        Projection.compareCanonicalPdfCandidates(left, equalExceptVolatile),
        []
    );

    const different = structuredClone(left);
    different.source.mode = 'pdf-ai';
    different.supportLevel = 'safe-partial';
    different.fieldProvenance.answer.kind = 'rejected';
    different.controlledWrite.acceptedFields = ['solution'];
    different.controlledWrite.rejectedFields = ['answer'];
    different.validation.ownershipValid = false;
    different.warnings.push({ code: 'ownership-failure' });
    different.rawEvidenceRefs = [{ evidenceId: 'different-block' }];

    const differences = Projection.compareCanonicalPdfCandidates(left, different);
    assert.deepEqual(differences.map(item => item.path), [
        'source.mode',
        'fieldProvenance.answer.kind',
        'controlledWrite.acceptedFields',
        'controlledWrite.rejectedFields',
        'supportLevel',
        'validation.ownershipValid',
        'warnings',
        'rawEvidenceRefs'
    ]);
    assert.equal(differences.every(item =>
        Object.hasOwn(item, 'legacyValue') &&
        Object.hasOwn(item, 'bridgeValue') &&
        ['error', 'warning'].includes(item.severity)
    ), true);
});
