const test = require('node:test');
const assert = require('node:assert/strict');

const ControlledWrite = require('../qisi-pdf-support-controlled-write.js');
const Projection = require('../qisi-pdf-candidate-projection.js');

const PROVENANCE_FIELDS = [
    'questionNumber', 'stem', 'options', 'answer', 'solution', 'images'
];

function rawDraft() {
    return {
        id: 'raw-json-draft-1',
        questionNumber: '1',
        type: 'choice',
        stem: '{"questions":[{"stem":"must-not-leak"}]}',
        options: [
            { label: 'A', text: 'one' },
            { label: 'B', text: 'two' }
        ],
        answer: '',
        solution: '',
        images: [{ id: 'raw-image-1' }],
        rawJsonCandidate: true,
        sourceQuestionFileId: 'pdf-question',
        sourceFileId: 'pdf-question',
        sourcePage: 1,
        sourceTrace: {
            sourceFileId: 'pdf-question',
            sourcePage: 1,
            sourceKind: 'ocrMarkdown',
            evidenceId: 'raw-question-block-1',
            strictProtocol: {
                accepted: true,
                decisionId: 'strict:raw-json:1',
                fields: ['questionNumber', 'stem', 'options', 'images'],
                method: 'strict-json-contract'
            }
        }
    };
}

function realControlledWrite(draft) {
    return {
        ...ControlledWrite.buildPdfSupportFieldLevelControlledWrite({
            drafts: [draft],
            parserSafeAnswerItems: [{
                questionNumber: '1',
                answer: 'A',
                evidenceId: 'raw-answer-block-1'
            }],
            parserSafeSolutionItems: [{
                questionNumber: '1',
                solution: 'Because the production evidence proves it.',
                evidenceId: 'raw-solution-block-1'
            }]
        }),
        decisionId: 'cw:raw-json:1'
    };
}

function directInput(draft = rawDraft()) {
    return {
        source: {
            sourceId: 'pdf-question', sourceType: 'pdf', sourceOrder: 1
        },
        engineResult: {
            sourceKind: 'ocrMarkdown',
            engine: 'mock-strict-engine',
            strictProtocol: draft.sourceTrace.strictProtocol
        },
        parsedQuestion: draft,
        alignmentResult: {
            mode: 'full', safeQuestionNumbers: ['1'],
            fusedQuestionNumbers: [], warnings: []
        },
        controlledWriteDecision: realControlledWrite(draft),
        evidence: {
            fields: Object.fromEntries(PROVENANCE_FIELDS.map(field => [
                field,
                { page: 1, blockIds: [`raw-${field}-block-1`] }
            ])),
            rawEvidenceRefs: [
                { evidenceId: 'raw-question-block-1' },
                { evidenceId: 'raw-answer-block-1' },
                { evidenceId: 'raw-solution-block-1' }
            ]
        },
        pageContext: { page: 1, sourceOrder: 1 },
        validation: {
            schemaValid: true, sequenceValid: true, ownershipValid: true
        }
    };
}

function assertRejectedRawJson(candidate) {
    assert.equal(candidate.questionNumber, '');
    assert.equal(candidate.type, '');
    assert.equal(candidate.stem, '');
    assert.deepEqual(candidate.options, []);
    assert.equal(candidate.answer, '');
    assert.equal(candidate.solution, '');
    assert.deepEqual(candidate.images, []);
    assert.deepEqual(candidate.controlledWrite.acceptedFields, []);
    assert.equal(candidate.supportLevel, 'rejected');
    assert.equal(candidate.validation.schemaValid, false);
    assert.equal(JSON.stringify(candidate).includes('must-not-leak'), false);
    for (const field of PROVENANCE_FIELDS) {
        const provenance = candidate.fieldProvenance[field];
        assert.equal(provenance.kind, 'rejected', field);
        assert.equal(provenance.status, 'rejected', field);
        assert.notEqual(provenance.controlledWriteAccepted, true, field);
        assert.equal(provenance.reasonCode, 'raw-json-candidate', field);
    }
}

test('raw JSON rejection rebuilds every provenance entry without accepted state', () => {
    assertRejectedRawJson(Projection.projectPdfCandidate(directInput()));
});

test('legacy batch projection rejects the same raw JSON state canonically', () => {
    const draft = rawDraft();
    const [candidate] = Projection.projectPdfCandidates({
        drafts: [draft],
        sources: [{
            id: 'pdf-question', fileType: 'pdf', roles: ['question'],
            sourceOrder: 1
        }],
        controlledWriteDecisions: [realControlledWrite(draft)],
        controlledWriteDecisionId: 'cw:raw-json:combined',
        alignmentResults: [{
            mode: 'full', safeQuestionNumbers: ['1'],
            fusedQuestionNumbers: [], warnings: []
        }],
        routeContext: {
            sourceMode: 'pdf-ai', engine: 'mock-strict-engine'
        }
    });
    assertRejectedRawJson(candidate);
});

