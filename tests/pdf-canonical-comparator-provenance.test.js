const test = require('node:test');
const assert = require('node:assert/strict');

const ControlledWrite = require('../qisi-pdf-support-controlled-write.js');
const Projection = require('../qisi-pdf-candidate-projection.js');

function candidate() {
    const draft = {
        id: 'comparator-draft-1', questionNumber: '1', type: 'solution',
        stem: 'Prove the comparator statement.', options: [],
        answer: '', solution: '', images: []
    };
    const controlledWrite = {
        ...ControlledWrite.buildPdfSupportFieldLevelControlledWrite({
            drafts: [draft],
            parserSafeAnswerItems: [{
                questionNumber: '1', answer: 'same evidence value',
                evidenceId: 'answer-evidence',
                sourceTrace: {
                    sourceFileId: 'support-pdf', sourcePage: 2,
                    blockIds: ['answer-block']
                }
            }],
            parserSafeSolutionItems: [{
                questionNumber: '1', solution: 'same evidence value',
                evidenceId: 'solution-evidence',
                sourceTrace: {
                    sourceFileId: 'support-pdf', sourcePage: 2,
                    blockIds: ['solution-block']
                }
            }]
        }),
        decisionId: 'cw:comparator:1'
    };
    return Projection.projectPdfCandidate({
        source: {
            sourceId: 'question-pdf', sourceType: 'pdf', sourceOrder: 1
        },
        engineResult: { sourceKind: 'textLayer', engine: 'pdf-text-layer' },
        parsedQuestion: draft,
        alignmentResult: {
            mode: 'full', safeQuestionNumbers: ['1'],
            fusedQuestionNumbers: [], warnings: []
        },
        controlledWriteDecision: controlledWrite,
        evidence: {
            fields: Object.fromEntries(Projection.FIELDS.map(field => [
                field,
                { page: 1, blockIds: [`question-${field}`] }
            ])),
            rawEvidenceRefs: [
                { evidenceId: 'answer-evidence' },
                { evidenceId: 'solution-evidence' }
            ]
        },
        pageContext: { page: 1, sourceOrder: 1 },
        validation: {
            schemaValid: true, sequenceValid: true, ownershipValid: true
        }
    });
}

function expectProvenanceDifference(left, right, expectedPaths) {
    const differences = Projection.compareCanonicalPdfCandidates(left, right);
    for (const path of expectedPaths) {
        const difference = differences.find(item => item.path === path);
        assert.ok(difference, path);
        assert.equal(difference.severity, 'error', path);
        assert.equal(
            difference.code,
            'pdf-canonical-provenance-mismatch',
            path
        );
    }
    assert.equal(differences.length >= expectedPaths.length, true);
}

test('answer and solution block evidence swap is a canonical error', () => {
    const left = candidate();
    const right = structuredClone(left);
    const answerBlocks = right.fieldProvenance.answer.blockIds;
    right.fieldProvenance.answer.blockIds =
        right.fieldProvenance.solution.blockIds;
    right.fieldProvenance.solution.blockIds = answerBlocks;

    expectProvenanceDifference(left, right, [
        'fieldProvenance.answer.blockIds',
        'fieldProvenance.solution.blockIds'
    ]);
});

test('per-field source id mismatch is not hidden by equal values and evidence', () => {
    const left = candidate();
    const right = structuredClone(left);
    right.fieldProvenance.stem.sourceId = 'wrong-question-source';
    expectProvenanceDifference(left, right, [
        'fieldProvenance.stem.sourceId'
    ]);
});

test('rejected fields with different reason codes are canonically different', () => {
    const left = candidate();
    const right = structuredClone(left);
    for (const value of [left, right]) {
        value.answer = '';
        value.fieldProvenance.answer = {
            kind: 'rejected', status: 'rejected', sourceId: 'support-pdf',
            page: 2, blockIds: ['answer-block'],
            controlledWriteDecisionId: 'cw:comparator:1',
            manuallyEdited: false,
            reason: 'rejected-a', reasonCode: 'rejected-a'
        };
    }
    right.fieldProvenance.answer.reason = 'rejected-b';
    right.fieldProvenance.answer.reasonCode = 'rejected-b';
    expectProvenanceDifference(left, right, [
        'fieldProvenance.answer.reasonCode'
    ]);
});

test('controlledWriteAccepted contradiction is a canonical error', () => {
    const left = candidate();
    const right = structuredClone(left);
    delete right.fieldProvenance.answer.controlledWriteAccepted;
    expectProvenanceDifference(left, right, [
        'fieldProvenance.answer.controlledWriteAccepted'
    ]);
});

test('block id order is stable but block identity is not ignored', () => {
    const left = structuredClone(candidate());
    left.fieldProvenance.stem.blockIds = ['stem-b', 'stem-a'];
    const reordered = structuredClone(left);
    reordered.fieldProvenance.stem.blockIds = ['stem-a', 'stem-b'];
    assert.deepEqual(
        Projection.compareCanonicalPdfCandidates(left, reordered),
        []
    );

    const changed = structuredClone(reordered);
    changed.fieldProvenance.stem.blockIds = ['stem-a', 'stem-c'];
    expectProvenanceDifference(left, changed, [
        'fieldProvenance.stem.blockIds'
    ]);
});
