const { pdfCandidate: productionPdfCandidate } =
    require('./production-cutover-fixtures.js');

const fields = ['questionNumber', 'stem', 'options', 'answer', 'solution'];

const deterministicProvenance = sourceId => ({
    ...Object.fromEntries(fields.map(field => [field, {
        status: 'deterministic-source',
        sourceId,
        evidenceRef: `docx:${sourceId}:${field}`
    }])),
    images: { status: 'missing' }
});

const controlledProvenance = sourceId => ({
    ...Object.fromEntries(fields.map(field => [field, {
        status: 'controlled-write',
        sourceId,
        controlledWriteAccepted: true,
        controlledWriteDecisionId: `cw:${sourceId}:${field}`
    }])),
    images: { status: 'missing' }
});

const docxCandidate = (overrides = {}) => ({
    id: 'true_docx_draft_1',
    questionNumber: '1',
    type: 'single',
    stem: 'True DOCX deterministic stem',
    options: ['Alpha', 'Beta', 'Gamma', 'Delta'],
    answer: 'A',
    solution: 'True deterministic solution',
    images: [],
    warnings: [],
    rawText: 'PRIVATE_RAW_EVIDENCE_MUST_NOT_EXPORT',
    source: {
        mode: 'docx-deterministic', sourceId: 'true-docx-1',
        fileIds: ['ui-docx']
    },
    fieldProvenance: deterministicProvenance('true-docx-1'),
    recognition: null,
    ...overrides
});

const pdfCandidate = (overrides = {}) => {
    const {
        includeAnswer = false,
        includeSolution = true,
        ...candidateOverrides
    } = overrides;
    return ({
        ...productionPdfCandidate({
            id: candidateOverrides.id || 'true_pdf_draft_1',
            questionNumber: candidateOverrides.questionNumber || '1',
            includeAnswer,
            includeSolution,
            alignmentMode: 'prefix'
        }),
        recognition: null,
        ...candidateOverrides
    });
};

module.exports = {
    deterministicProvenance,
    controlledProvenance,
    docxCandidate,
    pdfCandidate
};
