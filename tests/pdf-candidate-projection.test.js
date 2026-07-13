const test = require('node:test');
const assert = require('node:assert/strict');

const ControlledWrite = require('../qisi-pdf-support-controlled-write.js');
const BlockParser = require('../qisi-pdf-support-block-parser.js');
const Aligner = require('../qisi-pdf-support-aligner.js');
const FormalAdmissionPolicy = require('../qisi-formal-admission-policy.js');
const ProductionReviewValidator = require('../qisi-production-review-validator.js');

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

    assert.equal(result.source.format, 'pdf');
    assert.equal(result.producer.mode, 'deterministic-pdf');
    assert.equal(result.source.sourceId, 'pdf-question');
    assert.equal(result.source.sourceOrder, 1);
    assert.equal(result.answer, 'A');
    assert.equal(result.solution, 'because');
    assert.equal(result.fieldProvenance.stem.kind, 'deterministic-source');
    assert.equal(result.fieldProvenance.stem.status, 'deterministic-source');
    assert.equal(result.fieldProvenance.answer.kind, 'controlled-write');
    assert.equal(result.fieldProvenance.answer.controlledWriteAccepted, true);
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

test('projects PDF AI question fields only from explicit strict-engine field decisions', () => {
    const draft = question();
    const result = project({
        parsedQuestion: draft,
        engineResult: {
            sourceKind: 'ocrMarkdown',
            engine: 'qwen-vl',
            requestId: 'strict-request-1',
            strictProtocol: {
                accepted: true,
                decisionId: 'strict:pdf-question:1',
                fields: ['questionNumber', 'stem', 'options', 'images'],
                method: 'strict-json-contract'
            }
        },
        controlledWriteDecision: buildControlledWrite({ draft })
    });

    assert.equal(result.source.format, 'pdf');
    assert.equal(result.producer.mode, 'vision-ai');
    assert.equal(result.supportLevel, 'full');
    assert.equal(result.manualReviewRequired, false);
    for (const field of ['questionNumber', 'stem', 'options', 'images']) {
        assert.equal(result.fieldProvenance[field].kind, 'controlled-write');
        assert.equal(result.fieldProvenance[field].controlledWriteAccepted, true);
        assert.equal(
            result.fieldProvenance[field].controlledWriteDecisionId,
            'strict:pdf-question:1'
        );
    }
    assert.equal(result.fieldProvenance.answer.controlledWriteDecisionId, 'cw:pdf-question:1');
    assert.deepEqual(result.controlledWrite.acceptedFields, [
        'questionNumber', 'stem', 'options', 'answer', 'solution', 'images'
    ]);
    assert.deepEqual(result.controlledWrite.rejectedFields, []);

    const review = ProductionReviewValidator
        .createProductionReviewValidator({
            policy: FormalAdmissionPolicy,
            clock: () => 0
        })
        .validate({ ...result, version: 1 });
    assert.equal(review.valid, true);
    assert.deepEqual(review.errors, []);
});

test('combines multiple real controlled-write results without changing field decisions', () => {
    const draft = question({ type: 'solution', options: [], images: [] });
    const answerDecision = buildControlledWrite({
        draft, includeAnswer: true, includeSolution: false,
        decisionId: 'cw:answer'
    });
    const solutionDecision = buildControlledWrite({
        draft, includeAnswer: false, includeSolution: true,
        decisionId: 'cw:solution'
    });
    const combined = Projection.mergeControlledWriteDecisions(
        [answerDecision, solutionDecision],
        'cw:combined'
    );

    assert.equal(combined.decisionId, 'cw:combined');
    assert.deepEqual(
        combined.fieldDecisions.map(item => [item.field, item.source]),
        [['answer', 'parser'], ['solution', 'parser']]
    );
    assert.deepEqual(combined.answerQuestionNumbers, ['1']);
    assert.deepEqual(combined.solutionQuestionNumbers, ['1']);
});

test('batch projection delegates every input to the same single-candidate owner', () => {
    const base = {
        source: { sourceId: 'pdf-question', sourceType: 'pdf', sourceOrder: 1 },
        engineResult: { sourceKind: 'textLayer', engine: 'pdf-text-layer' },
        parsedQuestion: question(),
        alignmentResult: {
            mode: 'full', safeQuestionNumbers: ['1'],
            fusedQuestionNumbers: [], warnings: []
        },
        controlledWriteDecision: buildControlledWrite({ draft: question() }),
        evidence: { fields: fieldEvidence(), rawEvidenceRefs: [] },
        pageContext: { page: 1, sourceOrder: 1 },
        validation: {
            schemaValid: true, sequenceValid: true, ownershipValid: true
        }
    };
    const results = Projection.projectPdfCandidates([base, {
        ...base,
        parsedQuestion: question({ id: 'draft-pdf-2', questionNumber: '2' }),
        alignmentResult: {
            mode: 'prefix', safeQuestionNumbers: [],
            fusedQuestionNumbers: ['2'], warnings: [{ code: 'sequence-gap' }]
        }
    }]);

    assert.equal(results.length, 2);
    assert.equal(results[0].supportLevel, 'full');
    assert.equal(results[1].supportLevel, 'rejected');
});

test('production batch adapter projects PDF drafts while preserving non-PDF drafts', () => {
    const pdf = question({
        sourceQuestionFileId: 'pdf-question',
        sourcePage: 1,
        images: [],
        sourceTrace: {
            source: 'strict-visual-page-qwen',
            model: 'qwen-vl',
            sourceFileId: 'pdf-question',
            sourcePage: 1,
            strictProtocol: {
                accepted: true,
                decisionId: 'strict:pdf-question:1',
                fields: ['questionNumber', 'stem', 'options'],
                method: 'strict-json-contract'
            }
        }
    });
    const docx = {
        id: 'draft-docx-1', questionNumber: '2', type: 'solution',
        stem: 'docx stem', options: [], answer: '', solution: '', images: [],
        sourceFileId: 'docx-question'
    };
    const results = Projection.projectPdfCandidates({
        drafts: [pdf, docx],
        sources: [
            {
                id: 'pdf-question', fileType: 'pdf', sourceOrder: 1,
                roles: ['question']
            },
            {
                id: 'docx-question', fileType: 'docx', sourceOrder: 2,
                roles: ['question']
            }
        ],
        controlledWriteDecisions: [buildControlledWrite({ draft: pdf })],
        controlledWriteDecisionId: 'cw:combined',
        alignmentResults: [{
            mode: 'full', safeQuestionNumbers: ['1'],
            fusedQuestionNumbers: [], warnings: []
        }],
        routeContext: {
            sourceMode: 'pdf-ai', engine: 'strict-visual-page-qwen'
        }
    });

    assert.equal(results.length, 2);
    assert.equal(results[0].source.format, 'pdf');
    assert.equal(results[0].producer.mode, 'vision-ai');
    assert.equal(results[0].fieldProvenance.stem.kind, 'controlled-write');
    assert.equal(results[0].fieldProvenance.answer.kind, 'controlled-write');
    assert.equal(results[0].fieldProvenance.images.kind, 'missing');
    assert.equal(results[0].supportLevel, 'safe-partial');
    assert.equal(results[0].manualReviewRequired, true);
    assert.deepEqual(results[1], docx);
});

test('production engine context builder owns real parser, aligner, and controlled-write dependencies', () => {
    const draft = question({
        sourceQuestionFileId: 'pdf-question',
        sourceFileId: 'pdf-question',
        sourcePage: 1,
        sourceTrace: {
            sourceFileId: 'pdf-question', sourcePage: 1,
            evidenceId: 'question-evidence-1', sourceKind: 'textLayer'
        }
    });
    const sources = [
        {
            id: 'pdf-question', fileType: 'pdf', sourceOrder: 1,
            roles: ['question']
        },
        {
            id: 'pdf-support', fileType: 'pdf', sourceOrder: 2,
            roles: ['answer', 'solution']
        }
    ];
    const buildContext = Projection.createProductionProjectionContextBuilder();
    const context = buildContext({
        batchId: 'batch-1',
        sources,
        engineResult: {
            drafts: [draft],
            evidences: [{
                id: 'support-evidence-1', sourceFileId: 'pdf-support',
                sourceFileName: 'support.pdf', pageNo: 1,
                roles: ['answer', 'solution'], selectedSourceKind: 'textLayer',
                textLayer: '第1题\n答案：A\n解析：because'
            }]
        }
    });
    const [result] = Projection.projectPdfCandidates(context);

    assert.equal(context.controlledWriteDecisions.length, 1);
    assert.equal(
        context.controlledWriteDecisions[0].decisionId,
        'pdf-cw:batch-1:bridge'
    );
    assert.equal(result.source.format, 'pdf');
    assert.equal(result.producer.mode, 'vision-ai');
    assert.equal(result.answer, 'A');
    assert.equal(result.solution, 'because');
    assert.equal(result.fieldProvenance.answer.kind, 'controlled-write');
    assert.equal(result.validation.sequenceValid, true);
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
    different.producer.mode = 'vision-ai';
    different.supportLevel = 'safe-partial';
    different.fieldProvenance.answer.kind = 'rejected';
    different.controlledWrite.evaluated = false;
    different.controlledWrite.acceptedFields = ['solution'];
    different.controlledWrite.rejectedFields = ['answer'];
    different.controlledWrite.errors = [{ code: 'ownership-invalid' }];
    different.validation.ownershipValid = false;
    different.warnings.push({ code: 'ownership-failure' });
    different.rawEvidenceRefs = [{ evidenceId: 'different-block' }];

    const differences = Projection.compareCanonicalPdfCandidates(left, different);
    assert.deepEqual(differences.map(item => item.path), [
        'producer.mode',
        'fieldProvenance.answer.kind',
        'controlledWrite.evaluated',
        'controlledWrite.acceptedFields',
        'controlledWrite.rejectedFields',
        'controlledWrite.errors',
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
