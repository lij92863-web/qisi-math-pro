const test = require('node:test');
const assert = require('node:assert/strict');

const ControlledWrite = require('../qisi-pdf-support-controlled-write.js');
const Projection = require('../qisi-pdf-candidate-projection.js');
const Policy = require('../qisi-formal-admission-policy.js');
const ReviewValidator = require('../qisi-production-review-validator.js');

const draft = () => ({
    id: 'phase5-pdf-1', questionNumber: '1', type: 'choice',
    stem: 'Phase 5 canonical producer statement.',
    options: ['1', '2', '3', '4'], answer: '', solution: '', images: []
});

function projectPdf({ sourceKind = 'ocrMarkdown', engine = 'mock-vision' } = {}) {
    const parsedQuestion = draft();
    const controlledWriteDecision = {
        ...ControlledWrite.buildPdfSupportFieldLevelControlledWrite({
            drafts: [parsedQuestion],
            parserSafeAnswerItems: [{
                questionNumber: '1', answer: 'A', evidenceId: 'answer-1',
                sourceTrace: { sourcePage: 2, blockIds: ['answer-block-1'] }
            }],
            parserSafeSolutionItems: [{
                questionNumber: '1', solution: 'proof', evidenceId: 'solution-1',
                sourceTrace: { sourcePage: 2, blockIds: ['solution-block-1'] }
            }]
        }),
        decisionId: 'cw:phase5:1'
    };
    return Projection.projectPdfCandidate({
        source: {
            sourceId: 'question-pdf', sourceType: 'pdf',
            filename: 'question.pdf', mimeType: 'application/pdf', sourceOrder: 1
        },
        engineResult: {
            sourceKind, engine,
            strictProtocol: sourceKind === 'ocrMarkdown' ? {
                accepted: true,
                decisionId: 'strict:phase5:1',
                fields: ['questionNumber', 'stem', 'options'],
                method: 'strict-json-contract'
            } : undefined
        },
        parsedQuestion,
        alignmentResult: {
            mode: 'full', safeQuestionNumbers: ['1'],
            fusedQuestionNumbers: [], warnings: []
        },
        controlledWriteDecision,
        evidence: {
            fields: Object.fromEntries(Projection.FIELDS.map(field => [
                field,
                { page: field === 'answer' || field === 'solution' ? 2 : 1,
                    blockIds: [`${field}-block`] }
            ])),
            rawEvidenceRefs: [{ evidenceId: 'question-block-1' }]
        },
        pageContext: { page: 1, sourceOrder: 1 },
        validation: {
            schemaValid: true, sequenceValid: true, ownershipValid: true
        }
    });
}

test('PDF projection records split source, producer, route, and producer-time provenance', () => {
    const candidate = projectPdf();
    assert.equal(candidate.source.format, 'pdf');
    assert.equal(Object.hasOwn(candidate.source, 'mode'), false);
    assert.equal(candidate.producer.mode, 'vision-ai');
    assert.equal(candidate.producer.routeId, 'pdf-vision-controlled-write');
    assert.equal(candidate.producer.routeReason, 'pdf-engine-controlled-write-projection');
    assert.equal(candidate.producer.engine, 'mock-vision');
    assert.equal(candidate.route.identity, candidate.producer.routeId);
    assert.equal(candidate.route.reason, candidate.producer.routeReason);
    assert.deepEqual(candidate.route.transitions.map(item => item.code), [
        'pdf-selected',
        'vision-engine-result-produced',
        'controlled-write-evaluated',
        'provenance-projected',
        'review-candidate-built'
    ]);
    for (const provenance of Object.values(candidate.fieldProvenance)) {
        assert.equal(provenance.sourceFormat, 'pdf');
        assert.equal(provenance.producerMode, 'vision-ai');
        assert.equal(provenance.routeId, candidate.producer.routeId);
        assert.equal(provenance.engine, 'mock-vision');
        assert.equal(
            provenance.producerBoundary,
            'pdf-vision-engine-output-to-candidate'
        );
        assert.ok(provenance.contractVersion);
    }
});

test('deterministic PDF producer identity cannot be confused with vision', () => {
    const candidate = projectPdf({
        sourceKind: 'textLayer', engine: 'pdf-text-layer'
    });
    assert.equal(candidate.source.format, 'pdf');
    assert.equal(candidate.producer.mode, 'deterministic-pdf');
    assert.equal(candidate.producer.routeId, 'pdf-deterministic-import');
    assert.equal(candidate.producer.deterministic, true);
    assert.equal(
        candidate.fieldProvenance.stem.producerBoundary,
        'pdf-deterministic-source-to-candidate'
    );
});

test('PDF comparator protects source, producer, route, decision, and field producer evidence', () => {
    const left = projectPdf();
    const mutations = [
        ['source.sourceId', value => { value.source.sourceId = 'wrong-source'; }],
        ['source.format', value => { value.source.format = 'docx'; }],
        ['source.sourceOrder', value => { value.source.sourceOrder = 2; }],
        ['producer.mode', value => { value.producer.mode = 'deterministic-pdf'; }],
        ['producer.routeId', value => { value.producer.routeId = 'wrong-route'; }],
        ['producer.routeReason', value => { value.producer.routeReason = 'wrong-reason'; }],
        ['producer.engine', value => { value.producer.engine = 'wrong-engine'; }],
        ['route.identity', value => { value.route.identity = 'wrong-route'; }],
        ['route.reason', value => { value.route.reason = 'wrong-reason'; }],
        ['route.transitions', value => { value.route.transitions.pop(); }],
        ['controlledWrite.decisionId', value => {
            value.controlledWrite.decisionId = 'wrong-decision';
        }],
        ['fieldProvenance.stem.sourceFormat', value => {
            value.fieldProvenance.stem.sourceFormat = 'docx';
        }],
        ['fieldProvenance.stem.producerMode', value => {
            value.fieldProvenance.stem.producerMode = 'deterministic-pdf';
        }],
        ['fieldProvenance.stem.routeId', value => {
            value.fieldProvenance.stem.routeId = 'wrong-route';
        }],
        ['fieldProvenance.stem.engine', value => {
            value.fieldProvenance.stem.engine = 'wrong-engine';
        }],
        ['fieldProvenance.stem.producerBoundary', value => {
            value.fieldProvenance.stem.producerBoundary = 'post-hoc-review';
        }]
    ];
    for (const [path, mutate] of mutations) {
        const right = structuredClone(left);
        mutate(right);
        const differences = Projection.compareCanonicalPdfCandidates(left, right);
        assert.ok(differences.some(item => item.path === path), path);
    }
});

test('PDF comparator ignores only the declared volatile diagnostic fields', () => {
    const left = projectPdf();
    const right = structuredClone(left);
    left.diagnostics = {
        requestId: 'left', timestamp: 1, duration: 1,
        temporaryPath: 'left', randomDiagnosticId: 'left'
    };
    right.diagnostics = {
        requestId: 'right', timestamp: 2, duration: 2,
        temporaryPath: 'right', randomDiagnosticId: 'right'
    };
    assert.deepEqual(Projection.compareCanonicalPdfCandidates(left, right), []);
});

test('canonical PDF passes Formal Admission only with producer-time identity evidence', () => {
    const candidate = { ...projectPdf(), version: 1 };
    const validator = ReviewValidator.createProductionReviewValidator({
        policy: Policy, clock: () => 0
    });
    assert.equal(validator.validate(candidate).valid, true);

    const forged = structuredClone(candidate);
    delete forged.producer;
    delete forged.route;
    assert.equal(validator.validate(forged).valid, false);
});
